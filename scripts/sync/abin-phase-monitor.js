/**
 * abin-phase-monitor.js
 * Usa IA para detectar automaticamente em qual etapa o concurso da ABIN está,
 * pesquisando nas fontes oficiais (gov.br/abin, MGI).
 *
 * Roda via Task Scheduler: todo dia às 08h00.
 * Output: public/abin-phase.json
 *
 * Registrar no Task Scheduler (PowerShell como admin):
 *   $action = New-ScheduledTaskAction -Execute "node" `
 *     -Argument '--env-file=.env "C:\Users\Bernardo\Documents\Finance App\scripts\sync\abin-phase-monitor.js"' `
 *     -WorkingDirectory "C:\Users\Bernardo\Documents\Finance App"
 *   $trigger = New-ScheduledTaskTrigger -Daily -At "08:00"
 *   Register-ScheduledTask -TaskName "HubPessoal-AbinPhase" -Action $action -Trigger $trigger -RunLevel Highest
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callAi } from '../../server/aiProvider.js';
import { notifySyncFailure } from '../lib/notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUTPUT_PATH = resolve(ROOT, 'public/abin-phase.json');
const CACHE_HOURS = 20; // Não re-checar se rodou nas últimas 20h

// ── Etapas do concurso ABIN (índice 0–4) ─────────────────────────────────────

const MILESTONE_LABELS = [
  'Pedido protocolado no MGI',
  'Aguardando autorização',
  'Edital publicado',
  'Provas realizadas',
  'Nomeações / Resultado final',
];

/** milestoneIndex → estudo recomendado (1=Base Jurídica, 2=Conteúdo ABIN, 3=Sprint pós-edital) */
const STUDY_PHASE_MAP = [1, 1, 2, 3, 3];

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toLocaleString('pt-BR')}] ${msg}`);
}

function isCacheValid() {
  if (!existsSync(OUTPUT_PATH)) return false;
  try {
    const data = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
    if (!data.checkedAt) return false;
    const ageHours = (Date.now() - new Date(data.checkedAt).getTime()) / 3600000;
    return ageHours < CACHE_HOURS;
  } catch { return false; }
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000); // limita para não explodir o prompt
}

// ── Fontes de pesquisa ────────────────────────────────────────────────────────

const SOURCES = [
  { name: 'ABIN — Notícias', url: 'https://www.gov.br/abin/pt-br/assuntos/noticias' },
  { name: 'MGI — Concursos',  url: 'https://www.gov.br/gestao/pt-br/acesso-a-informacao/concursos-publicos' },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (isCacheValid()) {
    log('Cache válido — nada a fazer.');
    return;
  }

  log('Iniciando detecção de fase do concurso ABIN...');

  // Coleta texto das fontes
  const snippets = [];
  for (const source of SOURCES) {
    log(`Acessando: ${source.name}`);
    try {
      const html = await fetchPage(source.url);
      const text = extractText(html);
      snippets.push(`=== ${source.name} (${source.url}) ===\n${text}`);
    } catch (err) {
      log(`  → Erro ao acessar ${source.url}: ${err.message}`);
    }
  }

  if (snippets.length === 0) {
    log('Nenhuma fonte acessível — abortando.');
    return;
  }

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const prompt = `Você é um analista de concursos públicos brasileiros. Data de hoje: ${today}.

Analise os trechos de sites abaixo e determine em qual etapa o concurso da ABIN (Agência Brasileira de Inteligência) para Oficial de Inteligência está atualmente.

ETAPAS POSSÍVEIS (responda com o número da etapa):
0 = Pedido em análise / nenhuma novidade
1 = Aguardando autorização do governo (pedido feito ao MGI, mas ainda sem autorização)
2 = Edital publicado (concurso autorizado e edital disponível)
3 = Provas realizadas (aplicação das provas já ocorreu)
4 = Resultado final / nomeações publicadas

TRECHOS DOS SITES:
${snippets.join('\n\n')}

Responda APENAS em JSON válido com esta estrutura exata:
{
  "milestoneIndex": <número 0–4>,
  "milestoneLabel": "<texto descritivo da etapa atual>",
  "evidence": "<trecho ou informação do site que justifica a etapa>",
  "studyPhaseRecommendation": <1, 2 ou 3>,
  "summary": "<2 frases sobre o status atual do concurso>"
}

Regras:
- Se não houver informação relevante, retorne milestoneIndex: 1 (aguardando autorização)
- studyPhaseRecommendation: 1 = Base Jurídica, 2 = Conteúdo ABIN, 3 = Sprint pós-edital
- milestoneIndex 0–1 → studyPhaseRecommendation: 1
- milestoneIndex 2 → studyPhaseRecommendation: 2
- milestoneIndex 3–4 → studyPhaseRecommendation: 3`;

  log('Chamando IA para análise...');

  let result;
  try {
    const raw = await callAi(prompt, { temperature: 0.1 });

    // Extrai JSON da resposta
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('IA não retornou JSON válido');
    result = JSON.parse(jsonMatch[0]);

    // Valida campos obrigatórios
    if (typeof result.milestoneIndex !== 'number') throw new Error('Campo milestoneIndex inválido');
    result.milestoneIndex = Math.max(0, Math.min(4, result.milestoneIndex));

    // Garante studyPhaseRecommendation consistente com o mapa
    if (!result.studyPhaseRecommendation) {
      result.studyPhaseRecommendation = STUDY_PHASE_MAP[result.milestoneIndex] ?? 1;
    }
    if (!result.milestoneLabel) {
      result.milestoneLabel = MILESTONE_LABELS[result.milestoneIndex];
    }
  } catch (err) {
    log(`Erro ao processar resposta da IA: ${err.message}`);
    // Salva status padrão em caso de falha
    result = {
      milestoneIndex: 1,
      milestoneLabel: MILESTONE_LABELS[1],
      evidence: null,
      studyPhaseRecommendation: 1,
      summary: 'Não foi possível obter informações atualizadas. Status padrão mantido.',
    };
  }

  const output = {
    checkedAt: new Date().toISOString(),
    ...result,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  log(`Concluído — Etapa ${output.milestoneIndex}: ${output.milestoneLabel}`);
  if (output.summary) log(`Resumo: ${output.summary}`);
}

main().catch(async (err) => {
  console.error('Erro fatal:', err);
  await notifySyncFailure('abin-phase-monitor', err);
  process.exit(1);
});
