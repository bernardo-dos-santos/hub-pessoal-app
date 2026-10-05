/**
 * briefing.js — geração server-side do morning briefing diário.
 * Lê dados do SQLite, monta contexto dos 5 módulos e chama Gemini.
 * Salva resultado em public/briefing-today.json (cache de 6h).
 */

import { kvStore } from './db.js';
import { callAi } from './aiProvider.js';
import { getWeather } from './weather.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIEFING_PATH = resolve(__dirname, '../public/briefing-today.json');
const CACHE_HOURS = 6;

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function getKey(key) {
  const raw = kvStore.get(key);
  return raw ? safeJson(raw) : null;
}

function isCacheValid() {
  if (!existsSync(BRIEFING_PATH)) return false;
  try {
    const data = JSON.parse(readFileSync(BRIEFING_PATH, 'utf-8'));
    if (!data.generatedAt) return false;
    const age = (Date.now() - new Date(data.generatedAt).getTime()) / 3600000;
    return age < CACHE_HOURS;
  } catch { return false; }
}

function buildBriefingContext() {
  const today = new Date();
  const todayStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Financeiro
  const transactions = (getKey('finance.transactions') ?? []);
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthTxs = transactions.filter((t) => t.date?.startsWith(currentMonth));
  const income = monthTxs.filter((t) => t.kind === 'income').reduce((s, t) => s + (t.amount ?? 0), 0);
  const expenses = monthTxs.filter((t) => ['expense', 'card_purchase'].includes(t.kind)).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  // Fitness
  const workouts = getKey('fitness.workouts') ?? [];
  const lastWorkout = workouts[0];
  const daysSince = lastWorkout
    ? Math.floor((today.getTime() - new Date(lastWorkout.date + 'T00:00:00').getTime()) / 86400000)
    : null;

  // Faculdade
  const assessments = getKey('college.assessments') ?? [];
  const subjects = getKey('college.subjects') ?? [];
  const upcoming = assessments
    .filter((a) => a.status === 'scheduled' && a.date && a.date >= currentMonth)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((a) => {
      const sub = subjects.find((s) => s.id === a.subjectId);
      const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
      return `${sub?.name ?? a.subjectId}: ${a.title} (em ${daysUntil} dias)`;
    });

  // Plano semanal
  const plan = getKey('planner.weeklyPlan');
  const todayDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][today.getDay()];
  const todaySessions = plan?.sessions?.filter((s) => s.day === todayDay) ?? [];

  // Metas
  const goals = (getKey('goals.list') ?? []).filter((g) => g.status === 'active');

  // Concurso
  const examDate = getKey('concurso.examDate');
  const daysUntilExam = examDate
    ? Math.ceil((new Date(examDate).getTime() - today.getTime()) / 86400000)
    : null;

  return {
    todayStr,
    finance: { income, expenses, balance: income - expenses, monthTxCount: monthTxs.length },
    fitness: { daysSince, lastType: lastWorkout?.type ?? null },
    upcoming,
    todaySessions,
    goals: goals.slice(0, 3).map((g) => g.title),
    daysUntilExam,
  };
}

export async function generateBriefing(forceRegenerate = false) {
  if (!forceRegenerate && isCacheValid()) {
    return JSON.parse(readFileSync(BRIEFING_PATH, 'utf-8'));
  }

  const ctx = buildBriefingContext();
  // Clima é best-effort: se a API falhar, o briefing sai sem essa linha em vez
  // de falhar inteiro. Importa por causa do Cooper, que é ao ar livre.
  const weather = await getWeather();

  const prompt = `Você é um assistente pessoal do Bernardo. Gere um briefing matinal CONCISO (4-6 frases) para hoje, ${ctx.todayStr}.

Dados de hoje:
- Financeiro (${new Date().toLocaleDateString('pt-BR', { month: 'long' })}): receita R$${ctx.finance.income.toFixed(0)}, gasto R$${ctx.finance.expenses.toFixed(0)}, saldo R$${ctx.finance.balance.toFixed(0)}
- Fitness: ${ctx.fitness.daysSince === null ? 'Nenhum treino registrado' : ctx.fitness.daysSince === 0 ? 'Treinou hoje!' : `Último treino há ${ctx.fitness.daysSince} dia(s) (${ctx.fitness.lastType})`}
- Agenda do dia: ${ctx.todaySessions.length > 0 ? ctx.todaySessions.map((s) => `${s.topic} (${s.startTime})`).join(', ') : 'sem sessões planejadas'}
- Avaliações próximas: ${ctx.upcoming.length > 0 ? ctx.upcoming.join('; ') : 'nenhuma'}
- Metas ativas: ${ctx.goals.length > 0 ? ctx.goals.join(', ') : 'nenhuma'}
${ctx.daysUntilExam !== null ? `- Prova CBMSC: ${ctx.daysUntilExam} dias` : ''}
${weather ? `- Tempo em ${weather.city}: ${weather.current.temp}°C agora, ${weather.today.condition}, máx ${weather.today.max}°C / mín ${weather.today.min}°C, ${weather.today.rainChance}% de chance de chuva` : ''}

Tom: direto, motivador, sem rodeios. Mencione especificamente o que é mais urgente hoje.
${weather && weather.today.rainChance >= 50 ? 'Se houver treino ao ar livre hoje, avise sobre a chuva.' : ''}
Responda APENAS com o texto do briefing (sem JSON, sem títulos). Texto puro, sem Markdown nem asteriscos (**).`;

  const text = await callAi(prompt, { temperature: 0.4 });

  const briefing = {
    text: text.trim(),
    generatedAt: new Date().toISOString(),
    context: ctx,
  };

  writeFileSync(BRIEFING_PATH, JSON.stringify(briefing, null, 2), 'utf-8');
  return briefing;
}

export function getCachedBriefing() {
  if (!existsSync(BRIEFING_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BRIEFING_PATH, 'utf-8'));
  } catch { return null; }
}
