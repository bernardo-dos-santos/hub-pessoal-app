/**
 * pluggy-sync.js
 * Puxa contas, transações e posições de investimento via Open Finance (Pluggy)
 * e grava em public/pluggy-pending.json, no mesmo padrão dos outros syncs: o
 * script só extrai, quem importa pro Hub é o frontend (com dedup e revisão
 * pras transações; sync explícito por botão pras posições de investimento).
 *
 * Investimentos (GET /investments) respondeu 200 no tier pessoal gratuito ao
 * testar com uma conexão de corretora (Rico) — não há bloqueio de plano pago
 * conhecido pra leitura de posição. Sem posição aberta pra validar o formato
 * de verdade, então o mapeamento de type/subtype em
 * src/modules/finance/investments/services/pluggyInvestmentSyncService.ts
 * segue a documentação oficial da Pluggy, não dado real.
 *
 * Uso:
 *   node --env-file=.env scripts/sync/pluggy-sync.js
 *   node --env-file=.env scripts/sync/pluggy-sync.js --dry-run
 *   node --env-file=.env scripts/sync/pluggy-sync.js --days 90
 *
 * Requer no .env:
 *   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET
 *   PLUGGY_ITEM_IDS — ids das conexões, separados por vírgula.
 *
 * O item id é obrigatório porque `GET /items` (listar todas as conexões)
 * responde 401 no tier pessoal gratuito — só `GET /items/<id>` é liberado.
 * Pegue o id no painel do Meu Pluggy depois de conectar o banco.
 *
 * Por que Open Finance e não o parsing de e-mail: o e-mail só avisa o que o
 * banco resolve mandar (PIX, compra grande), enquanto aqui vem o extrato
 * inteiro, com categoria e id estável. O sync por e-mail segue ligado em
 * paralelo até este provar estabilidade — a deduplicação no frontend evita
 * lançamento duplicado.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../lib/logger.js';
import { notifySyncFailure } from '../lib/notify.js';

const log = createLogger('pluggy-sync');
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../../public/pluggy-pending.json');

const API = 'https://api.pluggy.ai';
const DRY_RUN = process.argv.includes('--dry-run');
const DAYS = Number(process.argv[process.argv.indexOf('--days') + 1]) || 90;
/** Data de corte fixa (YYYY-MM-DD). Tem prioridade sobre --days. */
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;
/**
 * Pede à Pluggy que vá buscar dado novo no banco (PATCH /items).
 *
 * **Não funciona nas conexões do Meu Pluggy** (tier pessoal gratuito): a API
 * responde 400 "MeuPluggy item cant be updated". Testado em 2026-08-03 nas três
 * conexões. Nesse tier a coleta só acontece pelo auto-sync a cada 24h
 * (`nextAutoSyncAt`) ou manualmente, pelo portal do Meu Pluggy.
 *
 * A flag fica pra quando houver uma conexão que aceite atualização por API —
 * mas não adianta ligá-la no agendamento hoje: além de não atualizar nada, uma
 * rodada com ela ativa devolveu uma conta vazia que voltou ao normal na
 * execução seguinte.
 */
const REFRESH = process.argv.includes('--refresh');

async function api(path, apiKey) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'X-API-KEY': apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Dispara a coleta de dado novo no banco. É assíncrona: a Pluggy responde na
 * hora e o item fica `UPDATING` por alguns minutos, então não vale esperar
 * aqui — o pedido de agora é colhido pela execução seguinte.
 *
 * A API limita a uma atualização por hora por item; estourar o limite é
 * resposta esperada, não falha do sync, e por isso só vira log.
 */
async function requestItemRefresh(itemId, apiKey) {
  try {
    const res = await fetch(`${API}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      log.info(`Atualização pedida para o item ${itemId.slice(0, 8)} — chega na próxima rodada.`);
      return;
    }

    const body = await res.text().catch(() => '');
    log.info(`Item ${itemId.slice(0, 8)} sem atualização agora (${res.status}): ${body.slice(0, 120)}`);
  } catch (err) {
    log.error(`Falha ao pedir atualização do item ${itemId.slice(0, 8)}: ${err.message}`);
  }
}

async function authenticate() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes no .env.');
  }
  const res = await fetch(`${API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Auth falhou: ${res.status}`);
  const { apiKey } = await res.json();
  return apiKey;
}

/**
 * A v2 é estrita com querystring: só `accountId` e `dateFrom` passam —
 * `pageSize`, `limit`, `cursor`, `itemId` e `from` todos devolvem 400 (e o
 * /transactions v1, que aceitava, foi descontinuado). A paginação vem pronta
 * no campo `next`, então não se monta o cursor à mão.
 */
async function fetchAllTransactions(accountId, apiKey, fromDate) {
  const all = [];
  let path = `/v2/transactions?accountId=${accountId}&dateFrom=${fromDate}`;
  let guard = 0;
  while (path && guard++ < 50) {
    const page = await api(path, apiKey);
    all.push(...(page.results ?? []));
    path = page.next ? (page.next.startsWith('http') ? new URL(page.next).pathname + new URL(page.next).search : page.next) : null;
  }
  return all;
}

/**
 * GET /investments é paginado por página (total/totalPages/page), diferente do
 * /v2/transactions (que pagina por cursor em `next`) — e é consultado por itemId,
 * não por accountId (accountId devolve 400 "itemId must be a UUID").
 */
async function fetchAllInvestments(itemId, apiKey) {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await api(`/investments?itemId=${itemId}&page=${page}`, apiKey);
    all.push(...(result.results ?? []));
    totalPages = result.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return all;
}

function toPendingInvestment(investment, item) {
  return {
    id: investment.id,
    type: investment.type ?? null,
    subtype: investment.subtype ?? null,
    name: investment.name,
    balance: investment.balance ?? null,
    amount: investment.amount ?? null,
    value: investment.value ?? null,
    quantity: investment.quantity ?? null,
    amountOriginal: investment.amountOriginal ?? null,
    amountProfit: investment.amountProfit ?? null,
    currencyCode: investment.currencyCode ?? null,
    date: investment.date ?? null,
    institution: item.connector?.name ?? null,
  };
}

/**
 * Nome da outra ponta de um PIX/TED.
 *
 * A descrição do Open Finance vem seca ("TRANSF ENVIADA PIX"), sem dizer com
 * quem foi — mas o nome está em `paymentData`. Sem puxá-lo de lá, toda
 * transferência fica indistinguível das outras e nenhuma regra por nome de
 * pessoa consegue casar.
 */
function counterpartName(tx) {
  const isIncoming = Number(tx.amount) > 0;
  const name = isIncoming ? tx.paymentData?.payer?.name : tx.paymentData?.receiver?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function describeTransaction(tx) {
  const base = tx.description ?? '';
  const counterpart = counterpartName(tx);
  // Anexa em vez de substituir: mantém o texto do banco (que o usuário
  // reconhece no extrato) e ainda dá à regra o nome pra casar.
  if (!counterpart) return base;
  return base.toLowerCase().includes(counterpart.toLowerCase()) ? base : `${base} - ${counterpart}`;
}

function toPendingTransaction(tx, account, item) {
  return {
    // id estável da Pluggy — é a chave de deduplicação no import.
    externalId: tx.id,
    date: tx.date,
    description: describeTransaction(tx),
    originalDescription: tx.descriptionRaw ?? tx.description,
    counterpart: counterpartName(tx),
    // Pluggy usa negativo pra saída, igual à convenção do Hub.
    amount: tx.amount,
    currency: tx.currencyCode,
    // Categoria da própria Pluggy — o Hub ainda aplica as regras dele por cima.
    pluggyCategory: tx.category ?? null,
    pluggyCategoryId: tx.categoryId ?? null,
    // PENDING vira POSTED depois; importar pendente geraria valor que muda sozinho.
    status: tx.status ?? null,
    type: tx.type ?? null,
    merchant: tx.merchant?.name ?? null,
    account: {
      id: account.id,
      type: account.type,          // BANK | CREDIT
      subtype: account.subtype,
      name: account.name,
      number: account.number ?? null,
    },
    institution: item.connector?.name ?? null,
  };
}

async function main() {
  const apiKey = await authenticate();
  // `--from` fixa o começo do histórico; `--days` é janela deslizante. A data
  // fixa evita que o recorte ande sozinho a cada execução, o que traria
  // transações mais antigas de volta pra fila de revisão sem ninguém pedir.
  const fromDate = FROM ?? new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);

  const itemIds = (process.env.PLUGGY_ITEM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (itemIds.length === 0) {
    log.info('PLUGGY_ITEM_IDS vazio no .env — nada a sincronizar.');
    return;
  }

  const items = [];
  for (const id of itemIds) {
    try {
      items.push(await api(`/items/${id}`, apiKey));
    } catch (err) {
      // Um id inválido não pode derrubar os outros bancos conectados.
      log.error(`Item ${id} não pôde ser lido: ${err.message}`);
    }
  }

  const accounts = [];
  const transactions = [];
  const investments = [];

  for (const item of items) {
    if (item.status === 'LOGIN_ERROR' || item.status === 'OUTDATED') {
      // Consentimento vencido ou credencial mudou: sem isto o sync ficaria
      // "verde" sem trazer nada, e o problema só apareceria na falta de dado.
      log.error(`Conexão "${item.connector?.name}" com status ${item.status} — precisa reconectar no Pluggy.`);
      continue;
    }

    for (const account of (await api(`/accounts?itemId=${item.id}`, apiKey)).results ?? []) {
      accounts.push({
        id: account.id,
        type: account.type,
        subtype: account.subtype,
        name: account.name,
        balance: account.balance,
        currency: account.currencyCode,
        institution: item.connector?.name ?? null,
        creditLimit: account.creditData?.creditLimit ?? null,
        dueDate: account.creditData?.balanceDueDate ?? null,
      });

      // Uma conta que falha não pode derrubar as outras: janela muito longa faz
      // a paginação de alguns bancos responder 403 no meio, e sem este try o
      // sync inteiro morria — nenhuma conta era gravada, nem as que já tinham
      // respondido.
      try {
        const txs = await fetchAllTransactions(account.id, apiKey, fromDate);
        for (const tx of txs) transactions.push(toPendingTransaction(tx, account, item));
        log.info(`${item.connector?.name} / ${account.name}: ${txs.length} transação(ões) desde ${fromDate}.`);
      } catch (err) {
        log.error(`${item.connector?.name} / ${account.name}: falhou ao ler transações — ${err.message}`);
      }
    }

    // Investimentos são consultados por itemId direto (não por conta) — uma
    // corretora conectada pode não ter nenhuma posição aberta, o que é normal.
    const itemInvestments = await fetchAllInvestments(item.id, apiKey);
    for (const investment of itemInvestments) investments.push(toPendingInvestment(investment, item));
    if (itemInvestments.length > 0) {
      log.info(`${item.connector?.name}: ${itemInvestments.length} posição(ões) de investimento.`);
    }

    // Pedido feito depois da leitura, de propósito: colhe-se o que a execução
    // anterior mandou buscar e já se encomenda a próxima leva.
    if (REFRESH && !DRY_RUN) {
      await requestItemRefresh(item.id, apiKey);
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    fromDate,
    accounts,
    transactions,
    investments,
  };

  if (DRY_RUN) {
    log.info(`[dry-run] ${accounts.length} conta(s), ${transactions.length} transação(ões), ${investments.length} posição(ões) — nada gravado.`);
    console.log(JSON.stringify({ ...payload, transactions: payload.transactions.slice(0, 3) }, null, 2));
    return;
  }

  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  log.info(`${accounts.length} conta(s), ${transactions.length} transação(ões), ${investments.length} posição(ões) gravadas em ${OUT_PATH}.`);
}

main().catch(async (err) => {
  log.error(`Falhou: ${err.message}`);
  await notifySyncFailure('pluggy-sync', err).catch(() => {});
  process.exit(1);
});
