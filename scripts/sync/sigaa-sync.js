/**
 * SIGAA Sync — Hub Pessoal (Puppeteer)
 *
 * Uso:
 *   1. Copie scripts/config/sigaa-config.example.json para scripts/config/sigaa-config.json
 *   2. Preencha login e password (o mesmo que você usa no site do SIGAA)
 *   3. Execute: node scripts/sync/sigaa-sync.js
 *   4. Importe o arquivo sigaa-export.json gerado em /faculdade/sigaa no Hub
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { notifySyncFailure } from '../lib/notify.js';
import { classifySigaaFiles } from '../lib/sigaaLinkClassifier.js';
import { callAi } from '../../server/aiProvider.js';

// Carrega variáveis do .env raiz (o servidor as tem via PM2, mas scripts standalone não)
{
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
  try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* .env ausente — variáveis devem estar no ambiente */ }
}

const BACKEND_URL = process.env.HUB_BACKEND ?? 'http://localhost:3001';

// Período de férias/entre semestres cadastrado em Faculdade > Configurações
// (college.semesterBreak, ver collegeBreakService.ts no frontend — mesma regra
// de comparação de datas duplicada aqui pela mesma razão de sempre: script
// standalone não importa TS do frontend).
async function isOnSemesterBreak() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/store/college.semesterBreak`);
    if (!res.ok) return false; // 404 = nunca configurado; outro erro = não bloqueia o sync
    const { value } = await res.json();
    if (!value?.startDate || !value?.endDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return today >= value.startDate && today <= value.endDate;
  } catch {
    return false; // backend offline — não é motivo pra pular o sync
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, '../config/sigaa-config.json');

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  console.error('[SIGAA] Arquivo de configuração não encontrado.');
  console.error(`[SIGAA] Crie o arquivo: ${configPath}`);
  process.exit(1);
}

if (!config.login || !config.password) {
  console.error('[SIGAA] Login ou senha não preenchidos em sigaa-config.json.');
  process.exit(1);
}

const BASE_URL = 'https://sig.ifsc.edu.br';
const PORTAL_URL = `${BASE_URL}/sigaa/portais/discente/discente.jsf`;

// Quando chamado com --headless (ex: pelo Task Scheduler), roda sem janela
const IS_HEADLESS = process.argv.includes('--headless');

// Normaliza espaços internos (SIGAA às vezes tem \n ou espaços extras nos links)
function norm(t) { return t.replace(/\s+/g, ' ').trim(); }

// Clica em link pelo texto exato (espaços normalizados, busca em toda a página)
async function clickByText(page, text, timeout = 8000) {
  await page.waitForFunction(
    (t) => Array.from(document.querySelectorAll('a')).some(a => a.textContent.replace(/\s+/g, ' ').trim() === t),
    { timeout },
    text
  );
  await page.evaluate((t) => {
    const link = Array.from(document.querySelectorAll('a'))
      .find(a => a.textContent.replace(/\s+/g, ' ').trim() === t);
    link?.click();
  }, text);
}

// Aguarda texto aparecer na página (útil após PostBack JSF)
async function waitForText(page, text, timeout = 15000) {
  await page.waitForFunction(
    (t) => document.body.textContent.includes(t),
    { timeout },
    text
  );
}

// Detecta a página de bloqueio do anti-bot. Checa URL e conteúdo porque o
// interstício nem sempre troca o domínio — às vezes ele é servido no próprio
// endereço do SIGAA, mantendo a URL de login intacta.
const ANTI_BOT_ERROR =
  'Bloqueado pelo anti-bot do SIGAA (página de captcha). As credenciais não ' +
  'chegaram a ser testadas — refaça o sync mais tarde ou a partir de outra rede.';

async function isAntiBotWall(page) {
  if (page.url().includes('validate.perfdrive')) return true;
  return page
    .evaluate(() => /anomaly detected|solve this captcha|hcaptcha/i.test(document.body?.innerText ?? ''))
    .catch(() => false);
}

// --- LOGIN ---
async function login(page) {
  console.log('[SIGAA] Acessando página de login...');
  await page.goto(`${BASE_URL}/sigaa/verTelaLogin.do`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // O bloqueio pode vir já aqui, no lugar da tela de login — sem essa checagem o
  // script morreria num timeout de seletor, que não diz nada sobre a causa.
  if (await isAntiBotWall(page)) throw new Error(ANTI_BOT_ERROR);

  await page.waitForSelector('input[name="user.login"]', { timeout: 60000 });

  console.log('[SIGAA] Preenchendo credenciais...');
  await page.type('input[name="user.login"]', config.login, { delay: 80 });
  await page.type('input[name="user.senha"]', config.password, { delay: 80 });

  console.log('[SIGAA] Aguardando validação Cloudflare...');
  await new Promise(r => setTimeout(r, IS_HEADLESS ? 6000 : 3000));

  // Primeira tentativa de login
  const clickEntrar = () =>
    page.click('input[value="Entrar"]')
      .catch(() => page.click('button[type="submit"]'))
      .catch(() => page.keyboard.press('Enter'));

  console.log('[SIGAA] Clicando em Entrar (1ª tentativa)...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    clickEntrar(),
  ]);

  // Bug do SIGAA: às vezes precisa de dois cliques
  if (page.url().includes('verTelaLogin')) {
    console.log('[SIGAA] Clicando em Entrar (2ª tentativa)...');
    await new Promise(r => setTimeout(r, 1000));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      clickEntrar(),
    ]);
  }

  // O SIGAA fica atrás de um anti-bot (Shape/F5, domínio "validate.perfdrive")
  // que às vezes serve uma página "ANOMALY DETECTED" com hCaptcha no lugar do
  // login. Ela precisa ser separada da falha de credencial: o sintoma é o mesmo
  // (não saiu da tela de login), mas a causa e a ação são outras — a senha nem
  // chegou a ser testada, e mandar "verifique login e senha" põe um erro falso
  // por cima do real, que é justamente o padrão que já custou semanas no
  // aiProvider. Nenhum script resolve o captcha; o sync tem que ser refeito
  // depois ou de outra rede.
  if (await isAntiBotWall(page)) throw new Error(ANTI_BOT_ERROR);

  if (page.url().includes('verTelaLogin')) {
    throw new Error('Login falhou. Verifique login e senha em sigaa-config.json.');
  }

  console.log('[SIGAA] Login realizado com sucesso.');
}

// --- EXTRAIR "MINHAS ATIVIDADES" DO PORTAL ---
async function extractMyActivities(page) {
  // Garante que estamos no portal e aguarda carregamento completo dos portlets
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500)); // portlets AJAX do SIGAA

  const result = await page.evaluate(() => {
    // Extrai data ISO de um texto como "29/05/2026 (1 dia)" ou "29/05/202623:59 (1 dia)"
    function parseDate(text) {
      const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})(\d{2}:\d{2})?/);
      if (!m) return null;
      let iso = `${m[3]}-${m[2]}-${m[1]}`;
      if (m[4]) iso += `T${m[4]}:00`;
      return iso;
    }

    function parseRows(table) {
      const activities = [];
      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) return;

        // SIGAA pode ter coluna de ícone antes da data — procura a célula com DD/MM/YYYY
        let dateCellIdx = -1;
        for (let i = 0; i < cells.length; i++) {
          if (/\d{2}\/\d{2}\/\d{4}/.test(cells[i].textContent)) {
            dateCellIdx = i;
            break;
          }
        }
        if (dateCellIdx === -1 || dateCellIdx + 1 >= cells.length) return;

        const dateText = cells[dateCellIdx].textContent.trim();
        const activityCell = cells[dateCellIdx + 1];

        // Separa por <br> para obter nome da disciplina + tipo da atividade
        const lines = activityCell.innerHTML
          .split(/<br\s*\/?>/i)
          .map(l => l.replace(/<[^>]+>/g, '').trim())
          .filter(l => l.length > 0);

        // Fallback: separa por \n se não tiver <br>
        const fallbackLines = activityCell.textContent
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);

        const resolved = lines.length >= 2 ? lines : fallbackLines;
        if (resolved.length < 2) return;

        const courseName = resolved[0];
        const activityLine = resolved[1];

        const typeMatch = activityLine.match(/^(Avalia[çc][ãa]o|Tarefa|Atividade)[:\s]+(.+)/i);
        const type = typeMatch?.[1] &&
          (typeMatch[1].toLowerCase().includes('tarefa') || typeMatch[1].toLowerCase().includes('atividade'))
          ? 'task' : 'assessment';
        const description = typeMatch?.[2]?.trim() || activityLine;

        activities.push({ courseName, type, description, date: parseDate(dateText), rawDate: dateText });
      });
      return activities;
    }

    // Estratégia 1: localiza texto "Minhas Atividades" (qualquer nó) e sobe até
    // encontrar a tabela no mesmo container (portlet do SIGAA)
    const allEls = Array.from(document.querySelectorAll('*'));
    for (const el of allEls) {
      if (!/minhas\s+atividades/i.test(el.textContent.trim())) continue;
      if (el.textContent.trim().length > 30) continue; // descarta containers grandes
      let container = el;
      for (let i = 0; i < 10; i++) {
        container = container.parentElement;
        if (!container) break;
        const table = container.querySelector('table');
        if (table) {
          const rows = parseRows(table);
          if (rows.length > 0) return { activities: rows, strategy: 1 };
        }
      }
    }

    // Estratégia 2: tabela com "Data" e "Atividade" nos cabeçalhos (th OU td)
    for (const table of document.querySelectorAll('table')) {
      const headerTexts = Array.from(table.querySelectorAll('th, td'))
        .slice(0, 6) // considera só as primeiras células
        .map(el => el.textContent.trim().toLowerCase());
      if (headerTexts.some(h => h === 'data') && headerTexts.some(h => h === 'atividade')) {
        const rows = parseRows(table);
        if (rows.length > 0) return { activities: rows, strategy: 2 };
      }
    }

    // Estratégia 3: qualquer tabela que tenha célula com DD/MM/YYYY seguida de
    // célula com texto em duas linhas (nome de disciplina + tipo de atividade)
    for (const table of document.querySelectorAll('table')) {
      const rows = parseRows(table);
      if (rows.length > 0) return { activities: rows, strategy: 3 };
    }

    // Debug: retorna estrutura de todas as tabelas
    const tablesDebug = Array.from(document.querySelectorAll('table')).slice(0, 15).map((t, i) => ({
      i,
      headers: Array.from(t.querySelectorAll('th, td')).slice(0, 4).map(el => el.textContent.trim().slice(0, 30)).join(' | '),
      rows: t.querySelectorAll('tbody tr').length,
    }));

    return { activities: [], strategy: 0, tablesDebug };
  });

  if (result.strategy === 0) {
    console.warn('[SIGAA] "Minhas Atividades" não encontrado. Estrutura de tabelas na página:');
    (result.tablesDebug || []).forEach(t => {
      console.warn(`  [tabela ${t.i}] rows=${t.rows} | cells: "${t.headers}"`);
    });
  } else {
    console.log(`[SIGAA] "Minhas Atividades" encontrado via estratégia ${result.strategy} — ${result.activities.length} atividade(s)`);
  }

  return result.activities;
}

// --- BUSCAR DADOS DAS TURMAS (nome + código + período direto do portal) ---
async function getCourseData(page) {
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  return await page.evaluate(() => {
    for (const table of document.querySelectorAll('table')) {
      const hasHeader = Array.from(table.querySelectorAll('th')).some(th =>
        th.textContent.trim().toLowerCase().includes('componente curricular')
      );
      if (!hasHeader) continue;

      return Array.from(table.querySelectorAll('tbody tr')).flatMap(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const nameLink = cells[0]?.querySelector('a');
        if (!nameLink) return [];
        const name = nameLink.textContent.trim();
        if (name.length < 3) return [];

        const rowText = row.textContent;
        const codeMatch = rowText.match(/([A-Z]{2,5}\d{4,8})/);
        const periodMatch = rowText.match(/(\d{4}\.\d)/);
        return [{ name, code: codeMatch?.[1] || '', period: periodMatch?.[1] || '' }];
      });
    }
    return [];
  });
}

// --- NAVEGAR PARA UMA DISCIPLINA (JSF PostBack) ---
// Clica no link do curso no portal e aguarda o sidebar do AVA aparecer.
// Não usa waitForNavigation: JSF pode causar redirect multi-step, partial render
// ou full-page POST sem mudança de URL — waitForNavigation criado antes do click
// resolve com qualquer atividade de rede da página (race condition).
// Em vez disso, usamos waitForFunction nos links do AVA como único árbitro.
async function navigateToCourse(page, courseName) {
  // Helper: encontra o link do curso na tabela "Componente Curricular" e clica via ElementHandle
  async function clickCourseLink(attrTag) {
    const found = await page.evaluate((name, tag) => {
      for (const table of document.querySelectorAll('table')) {
        const hasHeader = Array.from(table.querySelectorAll('th')).some(th =>
          th.textContent.trim().toLowerCase().includes('componente curricular')
        );
        if (!hasHeader) continue;
        const link = Array.from(table.querySelectorAll('tbody tr td:first-child a'))
          .find(a => a.textContent.trim() === name);
        if (link) {
          link.setAttribute('data-pp-nav', tag);
          return { href: link.href, target: link.target || '' };
        }
      }
      return null;
    }, courseName, attrTag);

    if (!found) return null;

    const handle = await page.$(`[data-pp-nav="${attrTag}"]`);
    await page.evaluate((tag) =>
      document.querySelector(`[data-pp-nav="${tag}"]`)?.removeAttribute('data-pp-nav')
    , attrTag);
    if (handle) {
      await handle.click();
    } else {
      // Fallback DOM click se o handle sumir (re-render AJAX entre mark e get)
      await page.evaluate((name) => {
        for (const table of document.querySelectorAll('table')) {
          const link = Array.from(table.querySelectorAll('a')).find(a => a.textContent.trim() === name);
          if (link) { link.click(); break; }
        }
      }, courseName);
    }
    return found;
  }

  // Helper: aguarda o sidebar do AVA aparecer (links específicos da disciplina)
  const waitAVA = (ms) => page.waitForFunction(
    () => Array.from(document.querySelectorAll('a')).some(a => {
      const t = a.textContent.replace(/\s+/g, ' ').trim();
      return t === 'Arquivos' || t === 'Plano de Ensino' || t === 'Conteúdo/Página web';
    }),
    { timeout: ms }
  ).then(() => true).catch(() => false);

  // --- Tentativa 1 ---
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  if (IS_HEADLESS) await new Promise(r => setTimeout(r, 2000));

  const linkInfo = await clickCourseLink('course');
  if (!linkInfo) throw new Error(`Disciplina "${courseName}" não encontrada no portal`);
  console.log(`[SIGAA]     link: href="${linkInfo.href.slice(0, 100)}" target="${linkInfo.target}"`);

  await new Promise(r => setTimeout(r, 800)); // aguarda form submit iniciar
  let avaLoaded = await waitAVA(20000);

  // --- Tentativa 2 (se AVA não carregou) ---
  if (!avaLoaded) {
    console.log(`[SIGAA]     ⚠ AVA não carregou em 20s — retentando (tentativa 2/2)`);
    await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 4000 : 2000)); // portlets precisam de mais tempo
    await clickCourseLink('course-retry');
    await new Promise(r => setTimeout(r, 800));
    avaLoaded = await waitAVA(20000);
  }

  await new Promise(r => setTimeout(r, IS_HEADLESS ? 400 : 200));

  // Debug: loga o estado da página
  const debug = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    links: Array.from(document.querySelectorAll('a'))
      .map(a => a.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 1 && t.length < 40)
      .slice(0, 20),
  })).catch(() => ({ url: '?', title: '?', links: [] }));
  console.log(`[SIGAA]     → URL após clique: ${debug.url}`);
  console.log(`[SIGAA]     → Links na página: ${debug.links.join(' | ')}`);

  // Frameset (raro): alguns ambientes SIGAA carregam AVA num <frame> filho.
  // _yuiResizeMonitor é um iframe 0×0 do YUI — ignorar sempre.
  if (!avaLoaded && debug.links.length <= 12) {
    const frameInfo = await page.evaluate(() =>
      Array.from(document.querySelectorAll('frame, iframe'))
        .filter(f => f.src && !f.name?.includes('yuiResize') && !f.id?.includes('yuiResize'))
        .map(f => ({ name: f.name || f.id || '', src: f.src }))
    ).catch(() => []);

    const currentUrl = page.url();
    const SKIP = /menu|topo|rodap|logo|banner|header|footer|cabec/i;
    const contentFrame =
      frameInfo.find(f => !SKIP.test(f.name) && !SKIP.test(f.src) && f.src !== currentUrl) ||
      frameInfo.find(f => f.src !== currentUrl);

    if (contentFrame?.src) {
      console.log(`[SIGAA]     → Frame de conteúdo encontrado: ${contentFrame.src.slice(0, 120)}`);
      await page.goto(contentFrame.src, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
    } else {
      console.log(`[SIGAA]     ⚠ AVA não carregou após 2 tentativas — extração pode estar incompleta`);
    }
  }
}

// --- EXTRAIR AVALIAÇÕES (sidebar direita — sem navegação, sidebar persiste) ---
async function extractExams(page) {
  return await page.evaluate(() => {
    const exams = [];

    // Formato real no HTML da sidebar: "24/0408:00:00" (dia/mês grudado com hora)
    // Seguido em elemento irmão ou próximo pelo nome: "1ª Avaliação"
    // Regex: DD/MM seguido imediatamente por HH:MM
    const DATE_RE = /^(\d{2})\/(\d{2})(\d{2}:\d{2}):\d{2}$/;

    // Itera todos os nós de texto da página procurando o padrão
    if (!document.body) return exams;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    for (let i = 0; i < textNodes.length; i++) {
      const text = textNodes[i].textContent.trim();
      const m = text.match(DATE_RE);
      if (!m) continue;

      // O nome da avaliação vem no próximo nó de texto não-vazio
      let description = '';
      for (let j = i + 1; j < Math.min(i + 5, textNodes.length); j++) {
        const next = textNodes[j].textContent.trim();
        if (next.length > 2) { description = next; break; }
      }

      if (description) {
        // Determina o ano pelo período atual (ex: 2026.1 → 2026)
        const yearMatch = document.body.textContent.match(/(\d{4})\.\d/);
        const year = yearMatch?.[1] || new Date().getFullYear();
        const date = `${year}-${m[2]}-${m[1]}`; // YYYY-MM-DD
        exams.push({ description, date });
      }
    }

    return exams;
  });
}

// --- EXTRAIR MATERIAIS ---
// Navega para "Materiais > Arquivos" no sidebar do AVA — essa sub-página lista
// TODOS os arquivos da disciplina (PDFs, slides de tópicos armazenados em
// "Conteúdo/Página web", ZIPs, etc.) numa tabela centralizada.
// Fluxo: (1) clica "Materiais" para expandir o submenu; (2) clica "Arquivos".
// Ambos os cliques usam ElementHandle (CDP) para disparar o form-submit JSF
// sem corromper o ViewState da sessão — page.goto() quebraria a sessão.
async function extractFiles(page) {
  // Passo 1: clica "Materiais" para revelar o sub-item "Arquivos".
  // Ignora links do cabeçalho do portal (href contém 'portais/discente').
  const materiaisMarked = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => {
      const t = a.textContent.replace(/\s+/g, ' ').trim();
      return (t === 'Materiais' || t === 'Material') &&
             !a.href.includes('portais/discente');
    });
    if (!link) return false;
    link.setAttribute('data-pp-nav', 'mat-expand');
    return true;
  });

  if (materiaisMarked) {
    const matHandle = await page.$('[data-pp-nav="mat-expand"]');
    await page.evaluate(() =>
      document.querySelector('[data-pp-nav="mat-expand"]')?.removeAttribute('data-pp-nav')
    );
    if (matHandle) {
      const navWait = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
      await matHandle.click();
      await navWait;
      await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
    }
  }

  // Passo 2: clica "Arquivos" (sub-item de Materiais) via ElementHandle.
  // Três estratégias para identificar o link correto no DOM:
  //   A. href contém /ava/ ou 'arquivo' (link AVA explícito)
  //   B. link "Arquivos" que é irmão de "Materiais" na árvore DOM (submenu context)
  //   C. link "Arquivos" que não aponta para portal/login (exclusão de falso-positivos)
  const arquivosStrategy = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));

    const byHref = allLinks.find(a =>
      a.textContent.replace(/\s+/g, ' ').trim() === 'Arquivos' &&
      (a.href.includes('/ava/') || a.href.toLowerCase().includes('arquivo'))
    );
    if (byHref) { byHref.setAttribute('data-pp-nav', 'arquivos'); return 'href'; }

    // Sobe a árvore a partir de "Materiais" para encontrar "Arquivos" irmão
    const matLink = allLinks.find(a => {
      const t = a.textContent.replace(/\s+/g, ' ').trim();
      return (t === 'Materiais' || t === 'Material') && !a.href.includes('portais/discente');
    });
    if (matLink) {
      let container = matLink.parentElement;
      for (let d = 0; d < 6; d++) {
        if (!container) break;
        const candidate = Array.from(container.querySelectorAll('a')).find(
          a => a !== matLink && a.textContent.replace(/\s+/g, ' ').trim() === 'Arquivos'
        );
        if (candidate) { candidate.setAttribute('data-pp-nav', 'arquivos'); return 'sibling'; }
        container = container.parentElement;
      }
    }

    // No AVA, TODOS os links da sidebar usam portais/discente/discente.jsf# como href
    // de form-submit JSF — não podemos excluir por portais/discente. Basta excluir
    // links de login/logout e aceitar qualquer link com texto "Arquivos".
    const byText = allLinks.find(a =>
      a.textContent.replace(/\s+/g, ' ').trim() === 'Arquivos' &&
      !a.href.includes('verTelaLogin') &&
      !a.href.includes('logout')
    );
    if (byText) { byText.setAttribute('data-pp-nav', 'arquivos'); return 'text'; }

    return null;
  });

  if (arquivosStrategy) {
    console.log(`[SIGAA]     [extractFiles] Navegando para "Arquivos" (estratégia: ${arquivosStrategy})`);
    // 1ª tentativa: ElementHandle (evento trusted para JSF).
    // 2ª tentativa (fallback): DOM click — mesmo que o link seja CSS-hidden,
    //   o DOM click dispara o onclick JSF e navega para ava/index.jsf que É
    //   a listagem correta de arquivos do curso (títulos em <td>, botões de
    //   download como <a><img></a> sem texto — não detectáveis antes dessa fix).
    let navegouArquivos = false;
    try {
      await page.evaluate(() =>
        document.querySelector('[data-pp-nav="arquivos"]')
          ?.scrollIntoView({ block: 'center', behavior: 'instant' })
      );
      await new Promise(r => setTimeout(r, 200));
      const arquivosHandle = await page.$('[data-pp-nav="arquivos"]');
      await page.evaluate(() =>
        document.querySelector('[data-pp-nav="arquivos"]')?.removeAttribute('data-pp-nav')
      );
      if (arquivosHandle) {
        const navWait = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
        await arquivosHandle.click();
        await navWait;
        await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
        navegouArquivos = true;
      }
    } catch {
      // ElementHandle falhou (CSS-hidden) — usa DOM click
      await page.evaluate(() =>
        document.querySelector('[data-pp-nav="arquivos"]')?.removeAttribute('data-pp-nav')
      );
      console.log('[SIGAA]     [extractFiles] ElementHandle falhou → DOM click');
      const navWait2 = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
      navegouArquivos = await page.evaluate(() => {
        const link = Array.from(document.querySelectorAll('a'))
          .find(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Arquivos');
        if (link) { link.click(); return true; }
        return false;
      });
      if (navegouArquivos) {
        await navWait2;
        await new Promise(r => setTimeout(r, IS_HEADLESS ? 1800 : 900));
      }
    }
    if (navegouArquivos) {
      console.log(`[SIGAA]     [extractFiles] "Arquivos" → ${page.url()}`);
    }
  }

  // Fallback final: "Materiais de Aula" — só roda se ainda estamos na AVA do curso
  // (sidebar ainda tem "Arquivos" = não navegamos para a listagem).
  const stillOnCourseAva = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .some(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Arquivos')
  );
  if (stillOnCourseAva) {
    const matClicked = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a =>
        a.textContent.replace(/\s+/g, ' ').trim() === 'Materiais de Aula'
      );
      if (link) { link.click(); return true; }
      return false;
    });
    if (matClicked) {
      console.log('[SIGAA]     [extractFiles] Fallback "Materiais de Aula"');
      await new Promise(r => setTimeout(r, IS_HEADLESS ? 3000 : 2000));
    }
  }

  // O navegador só COLHE: percorre o DOM e devolve dados crus. Quem decide o que
  // é arquivo e qual é a extensão é classifySigaaFiles(), no Node — lógica pura,
  // coberta por scripts/sigaa-classifier-check.js sem precisar logar no SIGAA.
  const harvest = await page.evaluate(() => {
    // ── Abordagem 1: linhas de tabela (página "Arquivos" do SIGAA) ──────────────
    // Nessa página os títulos ficam em <td> (não em <a>) e os botões de download
    // são <a><img></a> sem texto — invisíveis para a abordagem de links abaixo.
    // Estrutura: Título | Descrição (nome real do arquivo) | Tópico | [ícone DL]
    const rows = [];
    document.querySelectorAll('table tr').forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) return;

      // Exige que a linha tenha pelo menos um <a> (o botão de download)
      // Usa loop explícito (da direita para a esquerda = último <td> = ícone DL)
      let downloadLink = null;
      for (let i = cells.length - 1; i >= 0; i--) {
        const a = cells[i].querySelector('a');
        if (a && typeof a.getAttribute === 'function') { downloadLink = a; break; }
      }
      if (!downloadLink) return;

      rows.push({
        title: cells[0].textContent.replace(/\s+/g, ' ').trim(),
        desc: cells[1]?.textContent.replace(/\s+/g, ' ').trim() || '',
        topic: cells[2]?.textContent.replace(/\s+/g, ' ').trim() || '',
        onclick: downloadLink.getAttribute('onclick') || '',
        dlHref: downloadLink.href || '',
      });
    });

    // ── Abordagem 2 e fallback: todos os <a> da página, crus ───────────────────
    const links = Array.from(document.querySelectorAll('a')).map(link => ({
      text: link.textContent.trim(),
      href: link.href || '',
      rawHref: link.getAttribute('href') || '',
    }));

    return { rows, links };
  });

  return classifySigaaFiles(harvest);
}

// --- EXTRAIR NOTÍCIAS (Notícias / Notícias e Avisos na sidebar) ---
// Busca conteúdo completo clicando na lupa de cada notícia recente (≤ NEWS_CONTENT_FETCH_DAYS dias).
// Estrutura da tela de detalhe:
//   Título:  <valor>
//   Data:    <valor>
//   Texto:   <conteúdo completo>   ← alvo da extração
//   [<< Voltar]                    ← botão para voltar à lista
const NEWS_CONTENT_FETCH_DAYS = 30;

async function extractNews(page) {
  // Helper: detecta se a tabela da lista de notícias está visível
  function isNewsListVisible() {
    return Array.from(document.querySelectorAll('table tbody tr'))
      .some(row => Array.from(row.querySelectorAll('td'))
        .some(td => /\d{2}\/\d{2}\/\d{4}/.test(td.textContent)));
  }

  // Helper: clica em "Notícias" na sidebar e aguarda a tabela de lista aparecer.
  // "Notícias" causa navegação real (URL muda para NoticiaTurma/listar.jsf),
  // então waitForNavigation deve ser preparado ANTES do clique.
  async function goToNewsList() {
    // Prepara listener de navegação antes do clique para não perder o evento
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 })
      .catch(() => null); // silencia caso seja PostBack sem mudança de URL

    const clicked = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => {
        const t = a.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
        return t === 'notícias' || t === 'noticias' ||
               t.startsWith('notícia') || t.startsWith('noticia') ||
               t.includes('avisos');
      });
      if (link) { link.click(); return true; }
      return false;
    });
    if (!clicked) return false;

    await navPromise; // espera a navegação (ou timeout silencioso se PostBack)

    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('table tbody tr'))
          .some(row => Array.from(row.querySelectorAll('td'))
            .some(td => /\d{2}\/\d{2}\/\d{4}/.test(td.textContent))),
        { timeout: 8000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  // Helper: lê as linhas da tabela de notícias (título, data ISO, índice da linha)
  async function readNewsList() {
    return await page.evaluate(() => {
      for (const table of document.querySelectorAll('table')) {
        const trows = Array.from(table.querySelectorAll('tbody tr'));
        if (trows.length === 0) continue;
        const hasDates = Array.from(trows[0].querySelectorAll('td'))
          .some(c => /\d{2}\/\d{2}\/\d{4}/.test(c.textContent));
        if (!hasDates) continue;

        const rows = [];
        trows.forEach((row, rowIndex) => {
          const tds = Array.from(row.querySelectorAll('td'));
          if (tds.length < 2) return;
          let dateText = '', titleText = '';
          for (const td of tds) {
            const t = td.textContent.trim();
            if (/\d{2}\/\d{2}\/\d{4}/.test(t)) dateText = t;
            else if (t.length > 3 && !titleText) titleText = t.replace(/\s+/g, ' ').trim();
          }
          if (!titleText) return;
          const m = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          rows.push({ title: titleText, date: m ? `${m[3]}-${m[2]}-${m[1]}` : null, rowIndex });
        });
        if (rows.length > 0) return rows;
      }
      return [];
    });
  }

  // Helper: na lista, clica na lupa da linha rowIndex → aguarda "Texto:" aparecer → extrai conteúdo
  async function fetchNewsContent(rowIndex) {
    // Prepara listener de navegação ANTES do clique (lupa pode causar navegação real)
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 })
      .catch(() => null);

    // Clica na lupa (link com img cujo src/alt menciona "lupa"/"visual", ou último link da linha)
    const clicked = await page.evaluate((idx) => {
      for (const table of document.querySelectorAll('table')) {
        const trows = Array.from(table.querySelectorAll('tbody tr'));
        if (trows.length === 0) continue;
        if (!Array.from(trows[0].querySelectorAll('td'))
            .some(c => /\d{2}\/\d{2}\/\d{4}/.test(c.textContent))) continue;
        const row = trows[idx];
        if (!row) return false;
        const links = Array.from(row.querySelectorAll('a'));
        const lupa = links.find(a => {
          const img = a.querySelector('img');
          if (!img) return false;
          const s = (img.src + img.alt + (a.title || '')).toLowerCase();
          return s.includes('lupa') || s.includes('magnif') || s.includes('visuali');
        }) || links[links.length - 1]; // fallback: último link (geralmente a lupa)
        if (lupa) { lupa.click(); return true; }
        return false;
      }
      return false;
    }, rowIndex);

    if (!clicked) { console.log(`[extractNews]   ✗ lupa não encontrada na linha ${rowIndex}`); return null; }

    await navPromise; // aguarda navegação real (ou timeout silencioso se PostBack)

    // Aguarda label "Texto:" em td OU th (SIGAA usa os dois dependendo da versão)
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('td, th'))
          .some(el => el.textContent.replace(/\s+/g, ' ').trim().startsWith('Texto')),
        { timeout: 8000 }
      );
    } catch {
      // Debug: mostra URL e trecho do body para diagnóstico
      const info = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        snippet: document.body?.innerText?.replace(/\s+/g, ' ').trim().substring(0, 300) ?? '',
      })).catch(() => ({ url: '?', title: '?', snippet: '?' }));
      console.log(`[extractNews]   ✗ timeout "Texto:" na linha ${rowIndex} | URL: ${info.url}`);
      console.log(`[extractNews]   snippet: ${info.snippet}`);
      return null;
    }

    // Extrai conteúdo da célula/elemento ao lado do label "Texto:"
    return await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('td, th'));
      for (let i = 0; i < allEls.length; i++) {
        if (allEls[i].textContent.replace(/\s+/g, ' ').trim().startsWith('Texto')) {
          // Se é th, pega o td irmão; se é td, pega o próximo td
          const contentEl = allEls[i].tagName === 'TH'
            ? allEls[i].nextElementSibling
            : allEls[i + 1];
          const raw = contentEl?.textContent?.replace(/\s+/g, ' ').trim();
          return raw || null;
        }
      }
      return null;
    });
  }

  // Helper: clica em "<< Voltar" e aguarda a tabela de lista reaparecer
  async function clickVoltar() {
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'))
        .find(el => (el.textContent || el.value || '').replace(/\s+/g, ' ').includes('Voltar'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) return false;
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('table tbody tr'))
          .some(row => Array.from(row.querySelectorAll('td'))
            .some(td => /\d{2}\/\d{2}\/\d{4}/.test(td.textContent))),
        { timeout: 8000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  try {
    if (!await goToNewsList()) return [];

    const newsRows = await readNewsList();
    if (newsRows.length === 0) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEWS_CONTENT_FETCH_DAYS);

    const result = [];

    for (let i = 0; i < newsRows.length; i++) {
      const row = newsRows[i];
      const isRecent = row.date ? new Date(row.date) >= cutoff : true;

      if (!isRecent) {
        result.push({ title: row.title, date: row.date, content: null });
        continue;
      }

      console.log(`[SIGAA]       → Buscando conteúdo: "${row.title}"`);
      const content = await fetchNewsContent(row.rowIndex);
      result.push({ title: row.title, date: row.date, content });

      // Volta para a lista antes do próximo item recente (se houver)
      const nextHasRecent = newsRows.slice(i + 1).some(r => !r.date || new Date(r.date) >= cutoff);
      if (nextHasRecent) {
        const ok = await clickVoltar();
        if (!ok) await goToNewsList(); // fallback: re-clica "Notícias" na sidebar
      }
    }

    return result;

  } catch (err) {
    console.error('[extractNews] Erro:', err.message);
    return [];
  }
}

// --- EXTRAIR NOTAS (Alunos > Ver Notas na sidebar) ---
// "Alunos" é um header de accordion (não um <a>) — precisa DOM click para expandir.
// "Ver Notas" é um link JSF numa sidebar com overflow; usa DOM click para contornar
// o bounding-box check do Puppeteer (que falha quando o link fica "fora" do scroll).
async function extractGrades(page) {
  try {
    // Passo 1: expande o accordion "Alunos" clicando no elemento de texto exato
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === 'Alunos') {
          // Tenta o próprio nó, depois o pai imediato (span/li/a que envolve o texto)
          const target = node.parentElement;
          target?.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1000 : 600));

    // Passo 2: verifica se "Ver Notas" está presente
    const hasVerNotas = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .some(a => /ver\s*notas/i.test(a.textContent.replace(/\s+/g, ' ').trim()))
    );
    if (!hasVerNotas) {
      console.log('[SIGAA]     [extractGrades] "Ver Notas" não encontrado — pulando.');
      return [];
    }

    // Passo 3: DOM click direto — bypassa o bounding-box check do Puppeteer.
    // Links JSF do SIGAA têm href="#" com onclick; o DOM click dispara o handler.
    const navPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null);
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a'))
        .find(a => /ver\s*notas/i.test(a.textContent.replace(/\s+/g, ' ').trim()));
      link?.click();
    });
    await navPromise;
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));

    // Passo 4: aguarda a tabela de notas carregar
    await page.waitForFunction(
      () => document.body.textContent.includes('Matriculados') ||
            document.body.textContent.includes('Resultado Parcial') ||
            document.body.textContent.includes('Resultado Final'),
      { timeout: 12000 }
    );
  } catch (err) {
    console.log(`[SIGAA]     [extractGrades] Falha: ${err.message}`);
    return [];
  }

  return await page.evaluate(() => {
    const skipNames = new Set(['Faltas', 'Sit.', 'Situação', 'Matrícula Nome', 'Matrícula', 'Nome', '']);

    const table = Array.from(document.querySelectorAll('table')).find(t =>
      t.textContent.includes('Alunos Matriculados') ||
      t.textContent.includes('Resultado Parcial') ||
      t.textContent.includes('Resultado Final')
    );
    if (!table) return [];

    const allRows = Array.from(table.querySelectorAll('tr'));

    // ── Passo 1: mapeia colIndex → { topName, subName } considerando colspan/rowspan ──
    // Cada célula de dado (<td>) na linha do aluno tem um colIndex fixo (0…N).
    // Os <th> do cabeçalho podem ter colspan (cobre várias colunas) e rowspan
    // (ocupa a mesma coluna na linha 2 de cabeçalhos, impedindo sub-cabeçalhos lá).

    const colMap = new Map(); // colIndex → { topName, subName }

    // Linha 1 de cabeçalhos
    const row1Ths = Array.from(allRows[0]?.querySelectorAll('th') ?? []);
    const rowspanCols = new Set(); // colunas já ocupadas por rowspan≥2 da linha 1
    let ci = 0;
    for (const th of row1Ths) {
      const colspan = parseInt(th.getAttribute('colspan') || '1');
      const rowspan = parseInt(th.getAttribute('rowspan') || '1');
      const name = th.textContent.trim();
      for (let k = 0; k < colspan; k++) {
        colMap.set(ci + k, { topName: name, subName: null });
        if (rowspan >= 2) rowspanCols.add(ci + k);
      }
      ci += colspan;
    }

    // Linha 2 de cabeçalhos (sub-cabeçalhos, ex: A1/A2/A3/Nota ou PA1/PA2/PA3/Nota)
    // Os <th> da linha 2 preenchem apenas as colunas NÃO ocupadas por rowspan da linha 1.
    if (allRows.length >= 2) {
      const row2Ths = Array.from(allRows[1]?.querySelectorAll('th') ?? []);
      if (row2Ths.length > 0) {
        let subCi = 0;
        for (const th of row2Ths) {
          while (rowspanCols.has(subCi)) subCi++; // pula colunas do rowspan
          const subName = th.textContent.trim();
          if (colMap.has(subCi)) colMap.get(subCi).subName = subName;
          subCi++;
        }
      }
    }

    // ── Passo 2: linha do aluno (primeira <tr> com <td>s suficientes) ──────────
    let studentRow = null;
    for (const row of allRows) {
      const tds = row.querySelectorAll('td');
      if (tds.length >= 2) { studentRow = row; break; }
    }
    if (!studentRow) return [];
    const cells = Array.from(studentRow.querySelectorAll('td'));

    // ── Passo 3: agrupa colunas por topName → subGrades ──────────────────────
    const grouped = new Map(); // topName → [{ subName, value }]
    for (const [idx, { topName, subName }] of colMap) {
      if (skipNames.has(topName)) continue;
      const cell = cells[idx];
      const raw = cell?.textContent.trim().replace(',', '.');
      const value = parseFloat(raw);
      if (!grouped.has(topName)) grouped.set(topName, []);
      grouped.get(topName).push({ subName, value: isNaN(value) ? null : value });
    }

    // ── Passo 4: constrói o array de notas ────────────────────────────────────
    const grades = [];
    for (const [topName, subs] of grouped) {
      const isRecovery = /recupera/i.test(topName);
      const nonNull = subs.filter(s => s.value !== null);

      if (subs.length === 1) {
        // Coluna simples
        if (nonNull.length > 0) {
          grades.push({ name: topName, value: nonNull[0].value, type: 'grade', isRecovery, subGrades: [] });
        }
      } else {
        // Coluna composta (colspan > 1): sub-notas + valor efetivo = "Nota" ou último não-nulo
        const subGrades = nonNull.map(s => ({ name: s.subName ?? '', value: s.value }));
        const notaEntry = subs.find(s => s.subName === 'Nota' && s.value !== null);
        const effectiveValue = notaEntry?.value ?? nonNull[nonNull.length - 1]?.value ?? null;
        if (subGrades.length > 0) {
          grades.push({ name: topName, value: effectiveValue, type: 'grade', isRecovery: false, subGrades });
        }
      }
    }

    return grades;
  });
}

// --- EXTRAIR FREQUÊNCIA ---
// Clica em "Frequência" na sidebar e extrai "Faltas" e "Total de Faltas disponíveis".
async function extractAttendance(page) {
  try {
    const hasFreq = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .some(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Frequência')
    );
    if (!hasFreq) return null;

    const navPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a'))
        .find(a => a.textContent.replace(/\s+/g, ' ').trim() === 'Frequência');
      link?.click();
    });
    await navPromise;
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1000 : 600));

    return await page.evaluate(() => {
      const text = document.body.innerText;
      // "Total de Faltas:" = faltas já cometidas
      // "Máximo de Faltas Permitido" = limite máximo de faltas
      const faltasMatch = text.match(/Total de Faltas:\s*(\d+)/i);
      const maxMatch = text.match(/M[aá]ximo de Faltas[^:\n]*:\s*(\d+)/i);
      if (!faltasMatch) return null;
      const lines = text.split('\n');
      const fi = lines.findIndex(l => /Total de Faltas/i.test(l));
      const ctx = lines.slice(Math.max(0, fi - 1), fi + 4).join(' | ');
      return {
        absences: parseInt(faltasMatch[1]),
        totalAllowed: maxMatch ? parseInt(maxMatch[1]) : null,
      };
    });
  } catch { return null; }
}

// --- EXTRAIR PLANO DE ENSINO ---
// "Plano de Ensino" fica sob o accordion "Turma" na sidebar (mesma lógica do "Alunos").
// Extrai o texto de avaliação/critérios/pesos para enriquecer a exibição de notas no Hub.
async function extractPlan(page) {
  try {
    // Expande "Turma" (header de accordion, não um <a>)
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim() === 'Turma') {
          node.parentElement?.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1000 : 600));

    const hasPlan = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .some(a => /plano\s*de\s*ensino/i.test(a.textContent.replace(/\s+/g, ' ').trim()))
    );
    if (!hasPlan) return '';

    // DOM click (mesmo padrão de extractGrades — bypassa bounding-box check)
    const navPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a'))
        .find(a => /plano\s*de\s*ensino/i.test(a.textContent.replace(/\s+/g, ' ').trim()));
      link?.click();
    });
    await navPromise;
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1200 : 600));

    // Extrai o conteúdo central da página do plano
    const planText = await page.evaluate(() => {
      const content = document.querySelector('#conteudo, .conteudo, main, #formPlano, form[id*="plano"]')
        ?? document.body;
      const lines = [];
      for (const el of content.querySelectorAll('td, th, p, li, h1, h2, h3, h4')) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t.length > 3 && t.length < 800) lines.push(t);
      }
      return lines.filter((l, i) => l !== lines[i - 1]).join('\n').slice(0, 8000);
    });

    return planText;
  } catch {
    return '';
  }
}

// --- PARSE DO PLANO DE ENSINO VIA IA ---
// Transforma o planText bruto em JSON estruturado com avaliações, pesos e tópicos.
// NÃO usa datas do plano — professores raramente as atualizam corretamente.
// gradeColumns: nomes das colunas reais do SIGAA (ex: ["Resultado Parcial 1", "Resultado Parcial 2", ...])
// Passando isso, o AI não pode inventar um número menor de assessments do que os existentes.
async function parsePlan(planText, courseName, gradeColumns = []) {
  if (!planText) return null;

  // Hint de colunas reais do SIGAA — evita o AI inventar número menor de assessments
  const partialCols = gradeColumns.filter(c => /resultado parcial/i.test(c));
  const columnsHint = partialCols.length > 0
    ? `\nCOLUNAS REAIS DO SIGAA (use exatamente esses nomes em resultsKey, um assessment por coluna):\n${partialCols.map((c, i) => `  ${i + 1}. "${c}"`).join('\n')}\n`
    : '';

  const prompt = `Você é um parser de planos de ensino do IFSC (Instituto Federal de Santa Catarina).
Analise o texto do plano de ensino abaixo e retorne APENAS um objeto JSON válido, sem markdown, sem \`\`\`json.
${columnsHint}
REGRAS IMPORTANTES:
- NÃO inclua datas de nenhum tipo (os professores raramente atualizam as datas corretamente).
- "resultsKey" é SEMPRE o nome exato da coluna no sistema SIGAA: "Resultado Parcial 1", "Resultado Parcial 2", etc. (nunca a descrição da avaliação). O mapeamento é por ordem de aparição: primeira avaliação = "Resultado Parcial 1", segunda = "Resultado Parcial 2", etc.
- "label" é o nome curto usado no plano: "AV1", "AV2", "A1", "Trabalho 1", etc.
- Deve existir exatamente um assessment para cada coluna listada acima — nem mais, nem menos.
- Se a fórmula for média aritmética simples (ex: NF = (AV1+AV2+AV3)/3), weight de cada = 1/N onde N é o número de colunas.
- Se houver pesos diferentes explícitos no plano (ex: AV1×0.3, AV4×0.1), use-os exatamente.
- weights de todos os assessments devem somar 1.0.
- recovery.policy = "replaces" se a recuperação SUBSTITUI completamente a nota da AV (peso 10.0, ou "substitui", ou "no lugar de"). policy = "averages" SOMENTE se o plano explicitamente diz que faz média entre AV e recuperação.
- Para sub-componentes (ex: A1, A2, A3 dentro de Resultado Parcial 1): esses são sub-grades de uma mesma avaliação, NÃO assessments separados. O "resultsKey" do conjunto deve ser "Resultado Parcial 1".

Formato de saída:
{
  "passingGrade": 6,
  "minAttendance": 75,
  "finalFormula": "(AV1+AV2+AV3)/3",
  "assessments": [
    {
      "label": "AV1",
      "resultsKey": "Resultado Parcial 1",
      "weight": 0.333,
      "unitNumbers": [1, 2, 3],
      "topics": ["Números reais", "Funções reais de uma variável", "Limites e continuidade"]
    }
  ],
  "recovery": {
    "policy": "replaces",
    "maxGrade": 10,
    "coversAll": false
  }
}

Disciplina: ${courseName}

Plano de Ensino:
${planText.slice(0, 6000)}`;

  try {
    const raw = await callAi(prompt, { temperature: 0.2 });
    if (!raw) return null;
    // Remove eventual markdown fence que a IA pode incluir mesmo pedindo pra não
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.log(`[SIGAA]     [parsePlan] Falha no parse: ${err.message}`);
    return null;
  }
}

// --- DOWNLOAD E EXTRAÇÃO DE PDF ---

// Clica num link de arquivo NA página autenticada e captura o PDF.
// Usa três estratégias em paralelo:
//   1. CDP download (Content-Disposition: attachment) → salva em diretório temp
//   2. response.buffer() na página atual (PDF inline, sem attachment)
//   3. Captura de nova aba (target="_blank") — resposta interceptada no novo tab
// Retorna Buffer ou null.
async function clickAndDownloadPdf(page, browser, linkTitle) {
  const downloadDir = join(tmpdir(), `sigaa-pdf-${Date.now()}`);
  mkdirSync(downloadDir, { recursive: true });

  // Estratégia 1: CDP download para arquivos com Content-Disposition: attachment
  const cdp = await page.createCDPSession();
  try {
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
    });
  } catch {
    try {
      // Browser.setDownloadBehavior requer browserContextId no Chrome 115+
      const browserContext = page.browserContext();
      await cdp.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir,
        eventsEnabled: false,
        browserContextId: browserContext.id ?? undefined,
      });
    } catch { /* ignora */ }
  }

  // Estratégia 2: response.buffer() para PDFs servidos inline na página atual
  let inlineBuffer = null;
  const onResponse = async (response) => {
    if (inlineBuffer) return;
    const ct = response.headers()['content-type'] ?? '';
    if (!ct.includes('pdf') && !ct.includes('octet-stream')) return;
    try {
      const buf = await response.buffer();
      if (buf && buf.length > 500) inlineBuffer = buf;
    } catch { /* buffer já consumido ou request interceptado pelo Chrome */ }
  };
  page.on('response', onResponse);

  // Estratégia 3: nova aba (target="_blank") — SIGAA frequentemente abre PDFs assim
  let newTabBuffer = null;
  let newTabPage = null;
  const onTargetCreated = async (target) => {
    if (newTabBuffer || target.type() !== 'page') return;
    try {
      const newPage = await target.page();
      if (!newPage) return;
      newTabPage = newPage;

      // Captura via response listener na nova aba
      newPage.on('response', async (response) => {
        if (newTabBuffer) return;
        const ct = response.headers()['content-type'] ?? '';
        if (!ct.includes('pdf') && !ct.includes('octet-stream')) return;
        try {
          const buf = await response.buffer();
          if (buf && buf.length > 500) newTabBuffer = buf;
        } catch {}
      });

      // Aguarda a aba carregar (até 12 s)
      await newPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => {});

      // Fallback: se não capturou via response, tenta fetch direto com cookies da sessão
      if (!newTabBuffer) {
        const tabUrl = newPage.url();
        if (tabUrl && tabUrl.startsWith('http') && !tabUrl.includes('about:blank')) {
          try {
            const cookies = await page.cookies();
            const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            const resp = await fetch(tabUrl, { headers: { Cookie: cookieHeader } });
            const ct = resp.headers.get('content-type') ?? '';
            if (ct.includes('pdf') || ct.includes('octet-stream')) {
              const arrayBuf = await resp.arrayBuffer();
              const buf = Buffer.from(arrayBuf);
              if (buf.length > 500) newTabBuffer = buf;
            }
          } catch { /* fetch falhou */ }
        }
      }
    } catch { /* nova aba falhou */ }
  };
  browser.on('targetcreated', onTargetCreated);

  try {
    // Encontra o link de download pelo título:
    //   Estratégia A: <a> cujo texto é exatamente o título (páginas Materiais de Aula)
    //   Estratégia B: <a> (botão ícone sem texto) na linha da tabela onde
    //                 o primeiro <td> tem o título (página Arquivos do AVA)
    const found = await page.evaluate((title) => {
      // A: link por texto
      let link = Array.from(document.querySelectorAll('a'))
        .find(a => a.textContent.trim() === title);

      if (!link) {
        // B: botão ícone na linha da tabela
        for (const row of document.querySelectorAll('tr')) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 2) continue;
          if (cells[0].textContent.replace(/\s+/g, ' ').trim() !== title) continue;
          // Pega o primeiro <a> encontrado da direita para a esquerda (último = ícone DL)
          for (let i = cells.length - 1; i >= 0; i--) {
            const a = cells[i].querySelector('a');
            if (a) { link = a; break; }
          }
          if (link) break;
        }
      }

      if (!link) return false;
      link.scrollIntoView({ block: 'center', behavior: 'instant' });
      link.setAttribute('data-pp-dl', 'target');
      return true;
    }, linkTitle);
    await new Promise(r => setTimeout(r, 200));

    if (!found) return null;

    const linkHandle = await page.$('[data-pp-dl="target"]');
    await page.evaluate(() => {
      document.querySelector('[data-pp-dl="target"]')?.removeAttribute('data-pp-dl');
    });
    if (!linkHandle) return null;
    await linkHandle.click();

    // Aguarda por até 12 s: arquivo no disco, buffer inline OU nova aba
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (inlineBuffer || newTabBuffer) break;
      try {
        const files = readdirSync(downloadDir)
          .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
        if (files.length > 0) break;
      } catch { /* diretório vazio */ }
    }
  } finally {
    page.off('response', onResponse);
    browser.off('targetcreated', onTargetCreated);
    if (newTabPage) await newTabPage.close().catch(() => {});
    await cdp.detach().catch(() => {});
  }

  // Prefere buffer da nova aba (caso mais comum no SIGAA)
  if (newTabBuffer) {
    rmSync(downloadDir, { recursive: true, force: true });
    return newTabBuffer;
  }

  // Buffer inline (PDF servido no mesmo tab)
  if (inlineBuffer) {
    rmSync(downloadDir, { recursive: true, force: true });
    return inlineBuffer;
  }

  // Fallback: arquivo salvo no disco (Content-Disposition: attachment)
  try {
    const files = readdirSync(downloadDir)
      .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
    if (files.length > 0) {
      const buf = readFileSync(join(downloadDir, files[0]));
      rmSync(downloadDir, { recursive: true, force: true });
      return buf.length > 500 ? buf : null;
    }
  } catch { /* diretório vazio */ }

  rmSync(downloadDir, { recursive: true, force: true });
  return null;
}

// Clica no link do arquivo, baixa o PDF e envia ao backend para extração de texto.
// Requer que `page` esteja na página de materiais da disciplina (arquivosUrl).
// Depois de cada clique, renavega para arquivosUrl para garantir que o próximo
// link ainda esteja disponível (SIGAA abre PDFs inline, mudando a URL do tab).
// Retorna true em caso de sucesso, false caso contrário.
async function extractAndSavePdf(page, browser, file, arquivosUrl) {
  // Pula se o texto já foi extraído
  try {
    const check = await fetch(`${BACKEND_URL}/api/materials/${file.id}/text`);
    if (check.ok) {
      console.log(`[SIGAA]     [PDF] "${file.title}" já extraído, pulando.`);
      return true;
    }
  } catch {
    console.warn(`[SIGAA]     [PDF] Backend offline — pulando "${file.title}".`);
    return false;
  }

  // Garante que estamos na página de listagem antes de clicar
  if (arquivosUrl && page.url() !== arquivosUrl) {
    await page.goto(arquivosUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
  }

  console.log(`[SIGAA]     [PDF] Baixando "${file.title}"...`);
  const urlBefore = page.url();
  let buffer;
  try {
    buffer = await clickAndDownloadPdf(page, browser, file.title);
  } catch (err) {
    console.warn(`[SIGAA]     [PDF] Erro ao clicar em "${file.title}": ${err.message}`);
    // Volta para a listagem se a página navegou antes do erro
    if (arquivosUrl && page.url() !== urlBefore) {
      await page.goto(arquivosUrl, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
    }
    return false;
  }

  // Se a página navegou para fora da lista (PDF inline no mesmo tab), volta
  if (arquivosUrl && page.url() !== urlBefore) {
    await page.goto(arquivosUrl, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, IS_HEADLESS ? 1500 : 800));
  }

  if (!buffer) {
    console.warn(`[SIGAA]     [PDF] Não foi possível baixar "${file.title}".`);
    return false;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/materials/${file.id}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: buffer,
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`[SIGAA]     [PDF] "${file.title}" extraído: ${data.chars} chars`);
      return true;
    }
    console.warn(`[SIGAA]     [PDF] Backend rejeitou "${file.title}": ${JSON.stringify(data)}`);
  } catch (err) {
    console.warn(`[SIGAA]     [PDF] Erro ao enviar "${file.title}": ${err.message}`);
  }
  return false;
}

// --- MAIN ---
async function run() {
  if (IS_HEADLESS) {
    console.log('[SIGAA] Modo headless ativado (agendado).');
  }

  if (await isOnSemesterBreak()) {
    console.log('[SIGAA] Dentro do período de férias cadastrado (Faculdade > Configurações) — sync pulado, sem abrir navegador.');
    return;
  }

  // Carrega o último export para reutilizar parsedPlan já processados (evita chamar a IA de novo)
  const lastExportPath = resolve(process.cwd(), 'sigaa-export.json');
  let lastExportCourses = [];
  try {
    const raw = JSON.parse(readFileSync(lastExportPath, 'utf-8'));
    lastExportCourses = raw?.courses ?? [];
    const cached = lastExportCourses.filter(c => c.parsedPlan).length;
    if (cached > 0) console.log(`[SIGAA] Cache de planos: ${cached} disciplina(s) já parseada(s).`);
  } catch { /* primeiro run — sem cache */ }

  function getCachedPlan(courseName) {
    return lastExportCourses.find(
      c => c.title.toLowerCase() === courseName.toLowerCase()
    )?.parsedPlan ?? null;
  }

  const browser = await puppeteer.launch({
    // Sempre headless: false — o SIGAA/Cloudflare detecta o headless nativo do Chrome
    // e serve uma página reduzida. Em modo "agendado" (--headless), a janela é
    // posicionada fora da tela (-32000,-32000) para ficar invisível ao usuário.
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      ...(IS_HEADLESS ? [
        '--window-position=-32000,-32000', // janela off-screen = invisível
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ] : []),
    ],
  });

  const page = await browser.newPage();
  // Viewport alto garante que todos os elementos do AVA (sidebar, listas longas)
  // tenham bounding-box calculado corretamente pelo Chrome mesmo com --disable-gpu
  // e janela off-screen. ElementHandle.click() verifica bounding-box antes de clicar
  // — sem isso, links "fora do viewport" retornam "not clickable".
  await page.setViewport({ width: 1280, height: 3000 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    await login(page);

    // Pega nome do estudante da página do portal
    await page.goto(PORTAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const studentName = await page.evaluate(() =>
      document.querySelector('.info-nome, [class*="nome-usuario"], #identificacaoUsuario span')
        ?.textContent.trim() ||
      document.body.textContent.match(/BERNARDO|[A-Z]{2,}\s[A-Z]{2,}\s[A-Z]{2,}/)?.[0] ||
      'Estudante'
    );
    console.log(`[SIGAA] Logado como: ${studentName}`);

    const courses = await getCourseData(page);
    console.log(`[SIGAA] ${courses.length} turma(s) encontrada(s): ${courses.map(c => c.name).join(', ')}`);

    if (courses.length === 0) {
      console.warn('[SIGAA] Nenhuma turma encontrada. Verifique se está no período letivo ativo.');
    }

    // ── Modo de inspeção: testa só extractGrades em todas as disciplinas ──────
    if (process.argv.includes('--test-grades')) {
      console.log('\n[SIGAA] --test-grades: testando extração de notas em cada disciplina...\n');
      for (const course of courses) {
        console.log(`[SIGAA] → ${course.name}`);
        try {
          await navigateToCourse(page, course.name);

          // Plano de Ensino antes de notas — sidebar "Turma" só está acessível da página
          // principal do curso AVA (não da página "Ver Notas" onde extractGrades navega).
          const cached = getCachedPlan(course.name);
          let planText = '';
          let parsedPlan = null;

          if (cached) {
            console.log(`[SIGAA]   📄 Plano: cache hit — pulando extração e parse.`);
            parsedPlan = cached;
          } else {
            // Colunas do export anterior servem como âncora (nomes são estáveis entre syncs)
            const prevGradeColumns = lastExportCourses
              .find(c => c.title.toLowerCase() === course.name.toLowerCase())
              ?.grades?.map(g => g.name) ?? [];
            planText = await extractPlan(page);
            if (planText) {
              const preview = planText.slice(0, 200).replace(/\n/g, ' | ');
              console.log(`[SIGAA]   📄 Plano (${planText.length} chars): ${preview}…`);
            } else {
              console.log('[SIGAA]   📄 Plano: não encontrado.');
            }
            parsedPlan = await parsePlan(planText, course.name, prevGradeColumns);
          }

          const attendance = await extractAttendance(page);
          if (attendance) {
            console.log(`[SIGAA]   🗓 Frequência: ${attendance.absences} falta(s) / ${attendance.totalAllowed ?? '?'} máximo`);
          } else {
            console.log('[SIGAA]   🗓 Frequência: não encontrada.');
          }

          const grades = await extractGrades(page);

          if (parsedPlan) {
            console.log(`[SIGAA]   🔍 Plano parseado:`);
            console.log(`[SIGAA]      passingGrade=${parsedPlan.passingGrade} | minAttendance=${parsedPlan.minAttendance}% | formula=${parsedPlan.finalFormula ?? '?'}`);
            console.log(`[SIGAA]      recovery: policy=${parsedPlan.recovery?.policy ?? '?'} | maxGrade=${parsedPlan.recovery?.maxGrade ?? '?'} | coversAll=${parsedPlan.recovery?.coversAll ?? '?'}`);
            (parsedPlan.assessments ?? []).forEach(a => {
              const units = a.unitNumbers?.length ? ` | unidades=[${a.unitNumbers.join(',')}]` : '';
              const topics = a.topics?.length ? ` | tópicos=[${a.topics.join(', ')}]` : '';
              console.log(`[SIGAA]      ${a.label}: resultsKey="${a.resultsKey}" | weight=${a.weight}${units}${topics}`);
            });
          } else {
            console.log('[SIGAA]   🔍 Plano: não parseado.');
          }

          if (grades.length > 0) {
            console.log(`[SIGAA]   ✓ ${grades.length} nota(s):`);
            // Enriquece com label do parsedPlan para o inspect ficar completo
            grades.forEach(g => {
              const planEntry = parsedPlan?.assessments?.find(
                a => a.resultsKey.toLowerCase() === g.name.toLowerCase()
              );
              const label = planEntry ? ` → ${planEntry.label}` : '';
              const sub = g.subGrades?.length > 0
                ? ` (${g.subGrades.map(s => `${s.name}=${s.value}`).join(', ')})`
                : '';
              const rec = g.isRecovery ? ' [REC]' : '';
              const weight = planEntry ? ` peso=${(planEntry.weight * 100).toFixed(0)}%` : '';
              console.log(`[SIGAA]     ${g.name}${label}: ${g.value}${sub}${rec}${weight}`);
            });
          } else {
            console.log('[SIGAA]   ✗ Nenhuma nota encontrada.');
          }
        } catch (err) {
          console.log(`[SIGAA]   ✗ Erro: ${err.message}`);
        }
      }
      console.log('\n[SIGAA] --test-grades concluído.');
      return;
    }

    // Extrai "Minhas Atividades" do portal (avaliações + tarefas de todas as disciplinas)
    const allActivities = await extractMyActivities(page);
    console.log(`[SIGAA] ${allActivities.length} atividade(s) encontrada(s) em "Minhas Atividades"`);

    let periodGlobal = '';
    const exportedCourses = [];

    for (const course of courses) {
      const { name: courseName, code: courseCode, period: coursePeriod } = course;
      if (coursePeriod) periodGlobal = coursePeriod;
      console.log(`[SIGAA]  → Processando: ${courseName} | código: ${courseCode || '?'} | período: ${coursePeriod || '?'}`);

      try {
        // Uma única navegação para a disciplina — sidebar persiste em todas as subpáginas
        await navigateToCourse(page, courseName);

        // Avaliações: usa "Minhas Atividades" do portal + fallback da sidebar
        const portalExams = allActivities
          .filter(a => a.type === 'assessment' && a.courseName === courseName)
          .map(a => ({ description: a.description, date: a.date }));

        const sidebarExams = portalExams.length === 0 ? await extractExams(page) : [];
        const exams = portalExams.length > 0 ? portalExams : sidebarExams;
        console.log(`[SIGAA]     ${exams.length} avaliação(ões)`);

        // Tarefas (vem do portal, sem navegação extra)
        const tasks = allActivities
          .filter(a => a.type === 'task' && a.courseName === courseName)
          .map(a => ({ description: a.description, date: a.date }));
        console.log(`[SIGAA]     ${tasks.length} tarefa(s)`);

        // Materiais — clica "Materiais" na sidebar (sidebar persiste entre subpáginas)
        const files = await extractFiles(page);
        console.log(`[SIGAA]     ${files.length} arquivo(s)`);

        // Extração de texto dos PDFs — page está na aba "Arquivos" após extractFiles.
        // Salva a URL atual para renavegar entre downloads (SIGAA pode abrir PDFs
        // inline no mesmo tab, fazendo a URL mudar e quebrando os downloads seguintes).
        const arquivosUrl = page.url();
        const TEST_PDF_LIMIT = process.argv.includes('--test-pdf') ? 1 : Infinity;
        let pdfExtracted = 0;
        for (const file of files) {
          if (!file.isPdf) continue;
          if (pdfExtracted >= TEST_PDF_LIMIT) break;
          const ok = await extractAndSavePdf(page, browser, file, arquivosUrl);
          if (ok) pdfExtracted++;
        }
        if (files.some(f => f.isPdf)) {
          console.log(`[SIGAA]     ${pdfExtracted} PDF(s) com texto extraído`);
        }

        // Notícias — clica "Notícias" / "Notícias e Avisos" na sidebar
        const news = await extractNews(page);
        console.log(`[SIGAA]     ${news.length} notícia(s)`);

        // Plano de Ensino — pula extração e parse se já existe no cache do último export
        // (deve rodar ANTES de extractGrades para que o sidebar "Turma" ainda esteja acessível)
        const cachedPlan = getCachedPlan(courseName);
        let planText = '';
        let parsedPlan = null;

        if (cachedPlan) {
          console.log(`[SIGAA]     plano: cache hit — pulando IA.`);
          parsedPlan = cachedPlan;
        } else {
          // Colunas do export anterior servem como âncora para o parsePlan
          // (nomes de coluna são estáveis — não mudam entre syncs)
          const prevGradeColumns = lastExportCourses
            .find(c => c.title.toLowerCase() === courseName.toLowerCase())
            ?.grades?.map(g => g.name) ?? [];
          planText = await extractPlan(page);
          console.log(`[SIGAA]     plano: ${planText ? planText.length + ' chars' : 'não encontrado'}`);
          parsedPlan = await parsePlan(planText, courseName, prevGradeColumns);
          console.log(`[SIGAA]     parsedPlan: ${parsedPlan ? (parsedPlan.assessments?.length ?? 0) + ' avaliações' : 'não parseado'}`);
        }

        // Frequência — clica "Frequência" na sidebar (antes das notas, sidebar ainda acessível)
        const attendance = await extractAttendance(page);
        if (attendance) {
          console.log(`[SIGAA]     frequência: ${attendance.absences} falta(s) / ${attendance.totalAllowed ?? '?'} disponíveis`);
        }

        // Notas — clica "Alunos" > "Ver Notas" na sidebar
        const grades = await extractGrades(page);
        console.log(`[SIGAA]     ${grades.length} nota(s)`);

        exportedCourses.push({
          id: courseCode || String(exportedCourses.length + 1),
          title: courseName,
          code: courseCode || '',
          period: coursePeriod || periodGlobal,
          schedule: '',
          exams,
          tasks,
          // Exporta apenas campos públicos dos arquivos (url/isPdf são internos do sync)
          files: files.map(({ id, title, description }) => ({ id, title, description })),
          news,
          planText: planText || undefined,
          parsedPlan: parsedPlan ?? undefined,
          grades,
          absences: attendance?.absences,
          totalAllowedAbsences: attendance?.totalAllowed ?? undefined,
        });
      } catch (err) {
        console.warn(`[SIGAA]     Erro em "${courseName}": ${err.message}`);
        await page.screenshot({ path: `sigaa-error-${courseName.slice(0, 10)}.png` }).catch(() => {});
      }
    }

    const output = {
      exportedAt: new Date().toISOString(),
      studentName,
      period: periodGlobal,
      courses: exportedCourses,
    };

    const json = JSON.stringify(output, null, 2);

    // Exportação manual (compatibilidade)
    const outputPath = resolve(process.cwd(), 'sigaa-export.json');
    writeFileSync(outputPath, json, 'utf-8');

    // Auto-import pelo Hub (Vite serve /public/* na raiz)
    const pendingPath = resolve(process.cwd(), 'public', 'sigaa-pending.json');
    writeFileSync(pendingPath, json, 'utf-8');

    console.log(`\n[SIGAA] Exportação concluída: ${outputPath}`);
    console.log(`[SIGAA] Auto-import disponível em: ${pendingPath}`);
  } catch (err) {
    console.error('[SIGAA] Erro:', err.message);
    await page.screenshot({ path: 'sigaa-debug.png' }).catch(() => {});
    console.error('[SIGAA] Screenshot salvo em sigaa-debug.png');
    await notifySyncFailure('sigaa-sync', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

const GLOBAL_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutos máximo
const globalKill = setTimeout(async () => {
  console.error('[SIGAA] Timeout global atingido (12min) — encerrando processo.');
  await notifySyncFailure('sigaa-sync', new Error('Timeout global de 12 minutos atingido'));
  process.exit(1);
}, GLOBAL_TIMEOUT_MS);
globalKill.unref(); // não impede o processo de sair normalmente se terminar antes

run().finally(() => clearTimeout(globalKill));
