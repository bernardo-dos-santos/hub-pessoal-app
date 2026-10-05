// server/index.js
// API local + servidor de estáticos do Hub Pessoal.
// Roda em http://localhost:3001 (configurável via PORT).

import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, createReadStream } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { kvStore, materialContent, projectFiles } from './db.js';
import { generateAndSaveWeeklyPlan } from './ai-planner.js';
import { generateBriefing, getCachedBriefing } from './briefing.js';
import { pushRoutes } from './push.js';
import { runChain, testSlot, listSlotModels, clearCooldowns, CHAIN_ORDER } from './ai/chain.js';
import { readSettings, publicSettings, setSlotKey, clearSlotKey, SLOTS } from './ai/aiSettings.js';
import { PROVIDER_META } from './ai/adapters/index.js';
import { encryptionAvailable } from './crypto.js';
import { handleJarvisChat } from './jarvis.js';
import { runInitiativeTick } from './jarvis/initiative.js';
import { startJarvisScheduler, rescheduleJarvisTick } from './jarvis/scheduler.js';
import { migrateLegacyMemories } from './jarvis/memoryStore.js';
import { startJarvisTask, getJarvisTask } from './jarvis/tasks.js';
import { getJarvisConfig, setJarvisConfig, applyPreset, PRESETS, MODEL_CAPS, MACHINE_LEVELS } from './jarvis/config.js';
import { getBudgetStatus } from './jarvis/budget.js';
import { waitForCommand, deliverResult, agentStatus } from './agentBridge.js';
import { listCommands, approveCommand, rejectCommand } from './jarvis/commands.js';
import { recordLocation, listPlaces, addPlace, removePlace, lastRawLocation, getLocationContext } from './jarvis/location.js';
import { generateMonthlySummary, getMonthlySummary } from './finance-monthly-summary.js';
import { synthesizeSpeech } from './tts.js';
import { checkRepoIdentity, discoverRepos, getCommits, listBranches as listGitBranches } from './githubApi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');
const PUBLIC_DIR = resolve(__dirname, '../public');
const UPLOADS_DIR = resolve(__dirname, '../uploads/projects');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP gerenciado pelo Vite

app.use(express.json({ limit: '10mb' }));

// ─── CORS ───────────────────────────────────────────────────────────────────
// Permite APK Capacitor, dev browser (localhost:5173) e acessos via Tailscale.
// O servidor só é acessível pela rede privada do Tailscale — não há risco de
// wildcard externo.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3001',
  'capacitor://localhost',
  'http://localhost',
]);

// Tailscale usa o CGNAT 100.64.0.0/10 — IPs sempre começam com 100.
const TAILSCALE_ORIGIN_RE = /^https?:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/;
// Acesso pelo nome MagicDNS do tailnet (ex: desktop-xxx.tailXXXX.ts.net:3001).
const TAILSCALE_MAGICDNS_RE = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net(:\d+)?$/i;
// Qualquer porta em localhost — dev roda em portas variadas (Vite 5173, ferramentas
// de preview escolhem outras como 3000, servidor Express em 3001). Localhost já é
// confiável na camada de auth (isTrustedRemote), então confiar em qualquer porta
// aqui não abre brecha nova — só evita 403 de CORS em dev.
const LOCALHOST_ORIGIN_RE = /^https?:\/\/localhost(:\d+)?$/;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin)
    || TAILSCALE_ORIGIN_RE.test(origin)
    || TAILSCALE_MAGICDNS_RE.test(origin)
    || LOCALHOST_ORIGIN_RE.test(origin);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    // curl, Postman, scripts server-side — sem header Origin
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Origem desconhecida — rejeita
    return res.status(403).json({ error: 'Origin não permitida.' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-File-Name');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Auth ────────────────────────────────────────────────────────────────────
// Localhost (app + scripts) e a rede Tailscale (malha privada autenticada)
// passam sem token. Qualquer outra origem exige Authorization: Bearer <HUB_API_KEY>.
const HUB_API_KEY = process.env.HUB_API_KEY;
if (!HUB_API_KEY) {
  console.warn('[server] AVISO: HUB_API_KEY não configurada — auth desabilitada para requisições externas.');
}

// Confia em localhost e no range CGNAT do Tailscale (100.64.0.0/10 → 100.64–127.x.x).
// O Tailscale já é a camada de autenticação: só quem está no tailnet do Bernardo
// alcança esses IPs, então o celular/notebook via Tailscale dispensa o Bearer.
function isTrustedRemote(rawIp) {
  const ip = (rawIp ?? '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  const m = /^100\.(\d{1,3})\./.exec(ip);
  if (m) {
    const second = Number(m[1]);
    return second >= 64 && second <= 127;
  }
  return false;
}

app.use('/api', (req, res, next) => {
  if (!HUB_API_KEY) return next();
  if (isTrustedRemote(req.socket.remoteAddress)) return next();
  const auth = req.headers.authorization ?? '';
  if (auth === `Bearer ${HUB_API_KEY}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

// ─── Rate limiting ───────────────────────────────────────────────────────────
function makeLimit(max, windowMs) {
  return rateLimit({
    max,
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições — tente novamente em breve.' },
  });
}

const limits = {
  jarvis:   makeLimit(20, 60_000),
  ai:       makeLimit(10, 60_000),
  tts:      makeLimit(40, 60_000),
  backup:   makeLimit(2,  60 * 60_000),
  planner:  makeLimit(5,  60_000),
  store:    makeLimit(30, 60_000),
};

// ─── API ────────────────────────────────────────────────────────────────────

// Snapshot completo do store (usado no boot do app).
app.get('/api/store', limits.store, (_req, res) => {
  const raw = kvStore.getAll();
  const parsed = {};
  for (const [key, value] of Object.entries(raw)) {
    try {
      parsed[key] = JSON.parse(value);
    } catch {
      parsed[key] = value;
    }
  }
  res.json(parsed);
});

// Lê uma chave específica.
app.get('/api/store/:key', (req, res) => {
  const { key } = req.params;
  const raw = kvStore.get(key);
  if (raw === null || raw === undefined) return res.status(404).json({ error: 'Key não encontrada.' });
  try {
    res.json({ value: JSON.parse(raw) });
  } catch {
    res.json({ value: raw });
  }
});

// Grava/atualiza uma chave. Body: { value: <qualquer JSON> }
app.put('/api/store/:key', (req, res) => {
  const { key } = req.params;
  if (!isHubKey(key)) {
    return res.status(400).json({ error: `Key inválida: "${key}". Use prefixos hub conhecidos.` });
  }
  if (!('value' in (req.body ?? {}))) {
    return res.status(400).json({ error: 'Body deve conter { value }.' });
  }
  kvStore.set(key, JSON.stringify(req.body.value));
  res.json({ ok: true });
});

app.delete('/api/store/:key', (req, res) => {
  const { key } = req.params;
  if (!isHubKey(key)) {
    return res.status(400).json({ error: `Key inválida: "${key}". Use prefixos hub conhecidos.` });
  }
  kvStore.delete(key);
  res.json({ ok: true });
});

// ─── Backup ─────────────────────────────────────────────────────────────────

const HUB_KEY_PREFIXES = ['finance.', 'fitness.', 'college.', 'concurso.', 'rpg.', 'study.', 'goals.', 'ai.', 'planner.', 'hub.', 'push.', 'jarvis.', 'projects.'];

function isHubKey(key) {
  return HUB_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// Exporta todos os dados do hub como JSON.
app.get('/api/backup/export', limits.backup, (_req, res) => {
  const raw = kvStore.getAll();
  const data = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isHubKey(key)) continue;
    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }
  }
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'Hub Pessoal',
    data,
  });
});

// Importa um backup JSON para o banco SQLite.
app.post('/api/backup/import', limits.backup, (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup.data !== 'object') {
    return res.status(400).json({ error: 'Corpo inválido — esperado { data: {...} }.' });
  }
  let restored = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(backup.data)) {
    if (!isHubKey(key)) { skipped++; continue; }
    try {
      kvStore.set(key, JSON.stringify(value));
      restored++;
    } catch (err) {
      console.warn(`[backup] falha ao restaurar "${key}":`, err.message);
      skipped++;
    }
  }
  res.json({ ok: true, restored, skipped });
});

// ─── IA: cadeia Secundária → Principal → Fallback ───────────────────────────

// Status HTTP por causa: 'unconfigured' é o usuário não ter preenchido a tela
// (400, a UI manda ele configurar), o resto é o provedor tendo falhado (502).
const aiStatusFor = (err) => (err?.kind === 'unconfigured' ? 400 : 502);

app.post('/api/ai/complete', limits.ai, async (req, res) => {
  const { prompt, temperature = 0.4, system, maxOutputTokens } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Campo "prompt" obrigatório.' });
  }
  try {
    const result = await runChain(prompt, {
      temperature: Number(temperature),
      system: typeof system === 'string' ? system : undefined,
      maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(aiStatusFor(err)).json({ error: err.message ?? 'Erro na IA.' });
  }
});

/** Provedores disponíveis — a tela monta o seletor a partir daqui. */
app.get('/api/ai/providers', (_req, res) => res.json({ providers: PROVIDER_META }));

/**
 * O que o browser não consegue saber sozinho: se cada slot tem chave guardada
 * (a chave mora na tabela `secrets`, fora do kv_store) e se o servidor tem
 * cifragem configurada.
 */
app.get('/api/ai/status', (_req, res) => {
  res.json({ settings: publicSettings(), encryption: encryptionAvailable(), chainOrder: CHAIN_ORDER });
});

app.post('/api/ai/keys', (req, res) => {
  const { slot, apiKey } = req.body ?? {};
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: `Slot inválido: ${slot}` });
  if (typeof apiKey !== 'string' || !apiKey.trim()) return res.status(400).json({ error: 'Chave vazia.' });
  try {
    setSlotKey(slot, apiKey);
    clearCooldowns(); // chave nova merece uma tentativa, mesmo que a antiga tenha estourado a cota
    res.json({ settings: publicSettings() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ai/keys/:slot', (req, res) => {
  const { slot } = req.params;
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: `Slot inválido: ${slot}` });
  clearSlotKey(slot);
  res.json({ settings: publicSettings() });
});

// `provider`/`model`/`baseUrl` são opcionais e, quando vêm, valem mais que o
// que está salvo: assim a tela testa a combinação que está na tela, sem correr
// com o PUT assíncrono do storageAdapter. A chave nunca vem no corpo.
app.post('/api/ai/test', limits.ai, async (req, res) => {
  const { slot, provider, model, baseUrl } = req.body ?? {};
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: `Slot inválido: ${slot}` });
  try {
    res.json(await testSlot(slot, { provider, model, baseUrl }));
  } catch (err) {
    res.status(aiStatusFor(err)).json({ error: err.message ?? 'Erro ao testar.' });
  }
});

// Modelos que a chave/instância daquele slot aceita de fato. Vale para os três
// provedores: nome de modelo fixo no código vira 404 quando o provedor aposenta
// a série (Gemini 2.5, 19/08), e perguntar é a única fonte confiável.
app.post('/api/ai/models', limits.ai, async (req, res) => {
  const { slot, provider, baseUrl } = req.body ?? {};
  if (!SLOTS.includes(slot)) return res.status(400).json({ error: `Slot inválido: ${slot}` });
  try {
    res.json({ models: await listSlotModels(slot, { provider, baseUrl }) });
  } catch (err) {
    res.status(aiStatusFor(err)).json({ error: err.message ?? 'Erro ao listar modelos.' });
  }
});

// ─── Planner IA (server-side) ────────────────────────────────────────────────

app.post('/api/planner/generate', limits.planner, async (req, res) => {
  // Respeita o interruptor de geração automática (planner.autoGenerate, mexido
  // pela tela do plano semanal). Sem isto o job agendado de domingo recriaria o
  // plano que o usuário acabou de apagar — e pareceria que o botão não funciona.
  // `force` deixa a geração manual passar mesmo com o automático desligado.
  if (!req.body?.force) {
    const raw = kvStore.get('planner.autoGenerate');
    if (raw !== null && raw !== undefined && JSON.parse(raw) === false) {
      return res.json({ skipped: true, reason: 'Geração automática desligada pelo usuário.' });
    }
  }
  try {
    const result = await generateAndSaveWeeklyPlan();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro ao gerar plano.' });
  }
});

// ─── Push Notifications ──────────────────────────────────────────────────────

app.get('/api/push/vapid-public-key', (req, res) => pushRoutes.getPublicKey(req, res));
app.post('/api/push/subscribe', (req, res) => pushRoutes.subscribe(req, res));
app.post('/api/push/unsubscribe', (req, res) => pushRoutes.unsubscribe(req, res));
app.post('/api/push/send', (req, res) => pushRoutes.sendNotification(req, res));

// ─── Briefing diário ─────────────────────────────────────────────────────────

app.get('/api/briefing/today', (_req, res) => {
  const cached = getCachedBriefing();
  if (!cached) return res.status(404).json({ error: 'Sem briefing gerado ainda.' });
  res.json(cached);
});

app.post('/api/briefing/generate', async (req, res) => {
  try {
    const briefing = await generateBriefing(true);
    res.json({ ok: true, text: briefing.text, generatedAt: briefing.generatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro ao gerar briefing.' });
  }
});

// ─── JARVIS Chat ─────────────────────────────────────────────────────────────

const JarvisMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(32_000),
  /**
   * Foto anexada à mensagem (Fase 13), em base64 sem o prefixo `data:`.
   *
   * Só os quatro formatos que a API da Anthropic aceita — mandar outro é 400.
   * O teto de 7M caracteres corresponde ao limite de 5 MB por imagem da API
   * depois do inchaço de ~33% do base64; o `express.json` já está em 10mb, que
   * cobre isso com folga. O cliente ainda reduz a foto antes de mandar, então
   * na prática isto é só a rede de segurança.
   */
  image: z.object({
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    data: z.string().min(1).max(7_000_000),
  }).optional(),
});

const JarvisChatSchema = z.object({
  messages: z.array(JarvisMessageSchema).min(1).max(50),
});

// ─── Finance — resumo mensal ─────────────────────────────────────────────────

app.get('/api/finance/monthly-summary/:yyyyMM', (req, res) => {
  const { yyyyMM } = req.params;
  if (!/^\d{4}-\d{2}$/.test(yyyyMM)) {
    return res.status(400).json({ error: 'Formato inválido. Use YYYY-MM.' });
  }
  const summary = getMonthlySummary(yyyyMM);
  if (!summary) return res.status(404).json({ error: 'Resumo não encontrado para este mês.' });
  res.json(summary);
});

app.post('/api/finance/monthly-summary/generate', limits.ai, async (req, res) => {
  const { month } = req.body ?? {};
  try {
    const summary = await generateMonthlySummary(month ?? null);
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Jarvis ──────────────────────────────────────────────────────────────────

app.post('/api/jarvis/chat', limits.jarvis, async (req, res) => {
  const parsed = JarvisChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() });
  }
  // Negociado pelo Accept: o cliente novo pede SSE, mas o caminho JSON
  // continua valendo (APK antigo, curl, e o fallback Gemini/Ollama que não
  // transmite de qualquer jeito).
  const wantsStream = (req.headers.accept ?? '').includes('text/event-stream');

  if (!wantsStream) {
    try {
      const { text, affectedKeys } = await handleJarvisChat(parsed.data.messages);
      res.json({ text, affectedKeys });
    } catch (err) {
      res.status(500).json({ error: err.message ?? 'Erro no JARVIS.' });
    }
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Sem isto, um proxy no meio (o do Vite em dev, por exemplo) pode segurar o
  // corpo inteiro e entregar tudo de uma vez — matando o efeito do streaming.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { text, affectedKeys } = await handleJarvisChat(parsed.data.messages, {
      onTextDelta: (delta) => send('delta', { text: delta }),
    });
    send('done', { text, affectedKeys });
  } catch (err) {
    // Já respondemos 200 com os headers de SSE, então erro vira evento — não
    // dá pra trocar o status depois de flushHeaders.
    send('error', { error: err.message ?? 'Erro no JARVIS.' });
  }
  res.end();
});

// Disparo manual do tick proativo (Fase 2) — mesma auth do resto de /api
// (linha ~104: localhost/Tailscale passam livre, resto exige Bearer). Sem
// rate limit dedicado: é uso manual de teste, não algo que o app chama.
app.post('/api/jarvis/tick', async (_req, res) => {
  try {
    const result = await runInitiativeTick();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro no tick do JARVIS.' });
  }
});

// Tarefas compostas em background (Fase 4) — devolve o id na hora, o
// trabalho roda fora deste request. Mesma auth do resto de /api.
const JarvisTaskSchema = z.object({ goal: z.string().min(1).max(2000) });

app.post('/api/jarvis/task', limits.jarvis, (req, res) => {
  const parsed = JarvisTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() });
  }
  const started = startJarvisTask(parsed.data.goal);
  // 402 é o status certo aqui: o pedido é válido, o que falta é orçamento.
  if (!started.ok) return res.status(402).json({ error: started.reason });
  res.json({ taskId: started.taskId });
});

app.get('/api/jarvis/task/:id', (req, res) => {
  const task = getJarvisTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada.' });
  res.json(task);
});

// ─── Ponte com o agente da máquina (Fase 8) ──────────────────────────────────
// O agente CONECTA aqui (long-poll), em vez de escutar numa porta e esperar ser
// chamado. Ver server/agentBridge.js para o porquê da inversão.

const AGENT_TOKEN = process.env.AGENT_TOKEN;

/**
 * Autorização do agente: token compartilhado próprio, independente do
 * middleware de /api (que libera localhost/Tailscale sem credencial). Aqui a
 * credencial é sempre exigida — o objetivo da inversão é justamente parar de
 * confiar em "de que rede veio".
 */
function requireAgentToken(req, res, next) {
  if (!AGENT_TOKEN) return res.status(503).json({ error: 'AGENT_TOKEN não configurado no servidor.' });
  if (req.headers.authorization !== `Bearer ${AGENT_TOKEN}`) {
    return res.status(401).json({ error: 'Token do agente inválido.' });
  }
  next();
}

app.get('/api/agent/poll', requireAgentToken, async (req, res) => {
  const command = await waitForCommand(String(req.query.deviceId ?? 'default'));
  // 204 = nada a fazer agora; o agente reabre o poll. Corpo vazio em vez de
  // erro porque timeout de long-poll é operação normal, não falha.
  if (!command) return res.status(204).end();
  res.json({ command });
});

const AgentResultSchema = z.object({
  commandId: z.string().min(1),
  result: z.object({ ok: z.boolean() }).passthrough(),
});

app.post('/api/agent/result', requireAgentToken, (req, res) => {
  const parsed = AgentResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Payload inválido.' });
  const accepted = deliverResult(parsed.data.commandId, parsed.data.result);
  res.json({ accepted });
});

app.get('/api/agent/status', (_req, res) => res.json(agentStatus()));

// ─── Localização (Fase 13) ───────────────────────────────────────────────────
// O aparelho manda a coordenada; o servidor guarda e resolve para nome de
// lugar. Só o nome chega ao contexto do Jarvis — ver server/jarvis/location.js.

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

app.post('/api/jarvis/location', (req, res) => {
  const parsed = LocationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Coordenada inválida.' });
  res.json(recordLocation(parsed.data));
});

app.get('/api/jarvis/places', (_req, res) => {
  res.json({ places: listPlaces(), last: getLocationContext() });
});

const PlaceSchema = z.object({
  name: z.string().min(1).max(40),
  // Ausentes = "salvar o lugar onde estou agora", usando a última posição
  // recebida. É o caminho normal pelo app; passar coordenada é para o caso de
  // cadastrar um lugar onde não se está.
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  radiusM: z.number().positive().max(5000).optional(),
});

app.post('/api/jarvis/places', (req, res) => {
  const parsed = PlaceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });

  const { name, radiusM } = parsed.data;
  let { lat, lon } = parsed.data;
  if (lat === undefined || lon === undefined) {
    const last = lastRawLocation();
    if (!last) return res.status(400).json({ error: 'Nenhuma posição conhecida ainda — abra o app no celular primeiro.' });
    lat = last.lat;
    lon = last.lon;
  }

  const result = addPlace({ name, lat, lon, radiusM });
  res.status(result.ok ? 200 : 400).json(result);
});

app.delete('/api/jarvis/places/:id', (req, res) => res.json(removePlace(req.params.id)));

// Fila de aprovação: o Jarvis pede, o Bernardo libera vendo o texto exato.
// Estas rotas ficam sob a auth normal de /api — quem aprova é o dono do Hub,
// não o agente.
app.get('/api/jarvis/commands', (_req, res) => res.json({ commands: listCommands() }));

app.post('/api/jarvis/commands/:id/approve', async (req, res) => {
  const result = await approveCommand(req.params.id);
  res.status(result.ok ? 200 : 400).json(result);
});

app.post('/api/jarvis/commands/:id/reject', (req, res) => {
  const result = rejectCommand(req.params.id);
  res.status(result.ok ? 200 : 400).json(result);
});

// ─── Config e orçamento do Jarvis (Fase 6) ───────────────────────────────────

app.get('/api/jarvis/config', (_req, res) => {
  res.json({ config: getJarvisConfig(), budget: getBudgetStatus(), presets: Object.keys(PRESETS), models: MODEL_CAPS, machineLevels: MACHINE_LEVELS });
});

const JarvisPresetSchema = z.object({ preset: z.string().min(1) });

app.post('/api/jarvis/config/preset', (req, res) => {
  const parsed = JarvisPresetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Payload inválido.' });
  try {
    res.json({ config: applyPreset(parsed.data.preset), budget: getBudgetStatus() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/jarvis/config', (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Payload inválido.' });
  try {
    // Mexer em qualquer dial tira do preset: a config deixa de ser "o Médio" e
    // passa a ser a sua. Sem isso a tela mostraria "Médio" com valores que não
    // são os do Médio.
    const config = setJarvisConfig({ ...req.body, preset: 'custom' });
    // Intervalo novo só vale já se o timer for refeito — a janela e o
    // orçamento são lidos dentro do próprio tick, então não precisam disto.
    if (req.body.tick?.intervalMinutes !== undefined) rescheduleJarvisTick();
    res.json({ config, budget: getBudgetStatus() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── TTS — voz do Jarvis (Azure Neural) ──────────────────────────────────────

app.post('/api/tts', limits.tts, async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 5000) {
    return res.status(400).json({ error: 'Campo "text" obrigatório (1–5000 caracteres).' });
  }
  try {
    const audio = await synthesizeSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro ao gerar voz.' });
  }
});

// ─── Log de commits (GitHub API) ─────────────────────────────────────────────
// Alimenta a tela "Atividade" de cada Projeto: log de commits do repositório
// escolhido na criação do projeto, direto da API do GitHub (não depende de o
// repo estar clonado na mesma máquina que roda o backend, nem fica
// desatualizado por clone parado). Sem tentar mapear commit → frente — isso é
// a camada 1, em gitActivitySyncService.js no frontend. Requer GITHUB_TOKEN
// no .env (fine-grained, Contents + Metadata, somente leitura).

// Repositórios do usuário no GitHub — alimenta o seletor na criação de um Projeto.
app.get('/api/git/repos', limits.store, async (_req, res) => {
  try {
    res.json({ repos: await discoverRepos() });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro ao procurar repositórios.' });
  }
});

// Confere se um projeto ainda aponta pro mesmo repositório — pelo `id`, que
// não muda nem com rename (repositório apagado ou fora do alcance do token
// vira "não existe mais", os dois casos indistinguíveis de propósito).
app.get('/api/git/verify', limits.store, async (req, res) => {
  const repoId = Number(req.query.repoId);
  if (!Number.isFinite(repoId)) {
    return res.status(400).json({ error: 'Parâmetro "repoId" obrigatório.' });
  }
  try {
    res.json(await checkRepoIdentity(repoId));
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Erro ao verificar o repositório.' });
  }
});

app.get('/api/git/branches', limits.store, async (req, res) => {
  const { repo } = req.query;
  if (typeof repo !== 'string' || !repo) {
    return res.status(400).json({ error: 'Parâmetro "repo" obrigatório (formato dono/nome).' });
  }
  try {
    res.json({ branches: await listGitBranches(repo) });
  } catch (err) {
    res.status(err.status === 404 ? 404 : 500).json({ error: err.message ?? 'Erro ao listar branches.' });
  }
});

app.get('/api/git/log', limits.store, async (req, res) => {
  const { repo, branch, order, limit } = req.query;
  if (typeof repo !== 'string' || !repo) {
    return res.status(400).json({ error: 'Parâmetro "repo" obrigatório (formato dono/nome).' });
  }
  try {
    const commits = await getCommits(repo, {
      branch: typeof branch === 'string' && branch ? branch : undefined,
      order: order === 'asc' ? 'asc' : 'desc',
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ commits });
  } catch (err) {
    res.status(err.status === 404 ? 404 : 400).json({ error: err.message ?? 'Erro ao ler o log do git.' });
  }
});

// ─── Logs de automação ───────────────────────────────────────────────────────

const LOGS_PATH = resolve(__dirname, '../logs/sync-log.json');

app.get('/api/logs', (_req, res) => {
  try {
    const raw = existsSync(LOGS_PATH) ? readFileSync(LOGS_PATH, 'utf-8') : '[]';
    const entries = JSON.parse(raw);
    res.json(Array.isArray(entries) ? entries.slice(0, 200) : []);
  } catch {
    res.json([]);
  }
});

// ─── Arquivos de Projeto ──────────────────────────────────────────────────────
// Bytes ficam em disco (uploads/projects/<projectId>/), fora do hub.db — anexar
// "arquivos importantes" não deveria inflar o snapshot completo do store
// (GET /api/store, usado no boot e no backup). Metadado mora numa tabela SQLite
// própria (project_files), não no kv_store — mesmo espírito de material_content,
// que já separa conteúdo pesado do resto do store.
//
// Sem multer: mesmo padrão de /api/materials/:id/extract (express.raw + o
// Content-Type do próprio arquivo), com o nome vindo do header X-File-Name já
// que o corpo cru não carrega isso.

function projectFileDto(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    frontId: row.front_id ?? undefined,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

// Só aceita o formato de id gerado por generateId('project') — barra path traversal
// em join(UPLOADS_DIR, projectId) sem precisar validar contra o store.
function isSafeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
}

function safeFileName(name) {
  return name.replace(/[/\\]/g, '_').slice(-180);
}

app.get('/api/projects/:projectId/files', limits.store, (req, res) => {
  if (!isSafeId(req.params.projectId)) return res.status(400).json({ error: 'projectId inválido.' });
  res.json({ files: projectFiles.listByProject(req.params.projectId).map(projectFileDto) });
});

app.post('/api/projects/:projectId/files', limits.store, express.raw({ type: '*/*', limit: '20mb' }), (req, res) => {
  const { projectId } = req.params;
  if (!isSafeId(projectId)) return res.status(400).json({ error: 'projectId inválido.' });
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'Envie o arquivo no corpo da requisição.' });
  }
  const rawName = req.get('X-File-Name');
  if (!rawName) return res.status(400).json({ error: 'Header "X-File-Name" obrigatório.' });
  let fileName;
  try {
    fileName = safeFileName(decodeURIComponent(rawName));
  } catch {
    return res.status(400).json({ error: 'Header "X-File-Name" inválido.' });
  }
  const frontIdParam = req.query.frontId;
  const frontId = typeof frontIdParam === 'string' && frontIdParam && isSafeId(frontIdParam) ? frontIdParam : null;

  const file = {
    id: `pfile-${randomUUID()}`,
    projectId,
    frontId,
    fileName,
    mimeType: req.get('Content-Type') || 'application/octet-stream',
    sizeBytes: req.body.length,
    createdAt: new Date().toISOString(),
  };
  const dir = join(UPLOADS_DIR, projectId);
  mkdirSync(dir, { recursive: true });
  file.storagePath = join(dir, `${file.id}-${fileName}`);
  writeFileSync(file.storagePath, req.body);
  projectFiles.insert(file);

  res.status(201).json({
    id: file.id, projectId: file.projectId, frontId: file.frontId ?? undefined,
    fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, createdAt: file.createdAt,
  });
});

// `?inline=1` troca o Content-Disposition para `inline`. Sem isso o navegador
// é obrigado a baixar e o visualizador não consegue exibir nada — `attachment`
// continua o padrão, para o botão "baixar" seguir baixando.
app.get('/api/projects/files/:fileId/download', limits.store, (req, res) => {
  const file = projectFiles.get(req.params.fileId);
  if (!file || !existsSync(file.storage_path)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${file.file_name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  createReadStream(file.storage_path).pipe(res);
});

/**
 * Metadados úteis de um PDF anexado — páginas, palavras e as primeiras linhas.
 *
 * Usa `pdf-parse`, que já é dependência do projeto por causa do
 * /api/materials/:id/extract da Faculdade. Zero IA: é leitura de estrutura do
 * arquivo, não interpretação do conteúdo.
 */
app.get('/api/projects/files/:fileId/pdf-info', limits.store, async (req, res) => {
  const file = projectFiles.get(req.params.fileId);
  if (!file || !existsSync(file.storage_path)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  if (!file.file_name.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'O arquivo não é um PDF.' });
  }
  const parser = new PDFParse({ data: readFileSync(file.storage_path) });
  try {
    const result = await parser.getText();
    // getText() intercala marcadores "-- 1 of 2 --" entre as páginas; sem tirar,
    // eles entrariam na contagem de palavras e apareceriam na prévia.
    const text = (result.text ?? '').replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const preview = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5).join('\n');
    res.json({ pages: result.total ?? null, words, preview });
  } catch (err) {
    // PDF protegido ou corrompido não pode derrubar a tela — o visualizador
    // ainda consegue renderizar mesmo sem os metadados.
    console.warn(`[projects] falha ao ler metadados do PDF: ${err.message}`);
    res.status(422).json({ error: 'Não foi possível ler os metadados deste PDF.' });
  } finally {
    await parser.destroy();
  }
});

app.delete('/api/projects/files/:fileId', limits.store, (req, res) => {
  const file = projectFiles.get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  try {
    if (existsSync(file.storage_path)) unlinkSync(file.storage_path);
  } catch (err) {
    console.warn(`[projects] falha ao apagar arquivo em disco: ${err.message}`);
  }
  projectFiles.delete(req.params.fileId);
  res.json({ ok: true });
});

// ─── Materiais ───────────────────────────────────────────────────────────────

app.get('/api/materials/:id/text', (req, res) => {
  const content = materialContent.get(req.params.id);
  if (!content) return res.status(404).json({ error: 'Sem texto para este material.' });
  res.json({ text: content.text, extractedAt: content.extracted_at });
});

app.post('/api/materials/:id/extract', express.raw({ type: 'application/pdf', limit: '25mb' }), async (req, res) => {
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'Envie o PDF no corpo (Content-Type: application/pdf).' });
  }
  try {
    const parser = new PDFParse({ data: req.body });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.trim();
    materialContent.set(req.params.id, text);
    res.json({ ok: true, chars: text.length });
  } catch (err) {
    res.status(500).json({ error: `Falha ao extrair texto do PDF: ${err.message}` });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, keys: kvStore.count() }));

// ─── Estáticos (build do Vite) ───────────────────────────────────────────────

/**
 * Os arquivos `*-pending.json` são gravados pelos scripts de sync a cada rodada,
 * direto em `public/`. Como só o `dist/` era servido, o app enxergava a cópia
 * congelada no último build: com o sync do banco rodando a cada 15 minutos, o
 * frontend chegava a ficar quase uma hora atrás do que já estava em disco, e um
 * sync recém-executado parecia não ter trazido nada.
 *
 * Servir `public/` antes do `dist/` resolve na origem — os dois diretórios têm o
 * mesmo conteúdo fora esses arquivos, que em `public/` estão sempre mais novos.
 */
if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
}

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(resolve(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Hub Pessoal rodando em http://localhost:${PORT} (todas as interfaces)`);
  console.log(`[server] ${kvStore.count()} chaves no banco.`);
  if (!existsSync(DIST_DIR)) {
    console.log('[server] dist/ ausente — rode "npm run build" para servir o app pelo backend.');
  }
  // Migra `jarvis.memories` (lista de fatos no kv, com teto de 60) para
  // /memories/perfil.md. Idempotente: apaga a chave antiga, então a segunda
  // execução não encontra nada para migrar.
  const { migrated } = migrateLegacyMemories();
  if (migrated > 0) console.log(`[jarvis] ${migrated} memória(s) antiga(s) migrada(s) para /memories/perfil.md.`);

  // Migra a chave de IA da versão de um provedor só, ANTES de qualquer cliente
  // conectar: o browser escreve `ai.settings` pelo storageAdapter, e se ele
  // chegasse primeiro sobrescreveria a configuração antiga sem que a chave
  // tivesse sido movida para a tabela `secrets`.
  if (!encryptionAvailable()) {
    // Comando para gerar a chave: veja o cabeçalho de server/crypto.js.
    console.warn('[ai] CREDENTIALS_ENCRYPTION_KEY ausente — chaves de IA não podem ser guardadas. Gere uma chave de 32 bytes em base64 (instruções em server/crypto.js).');
  } else {
    readSettings();
  }

  startJarvisScheduler();
});
