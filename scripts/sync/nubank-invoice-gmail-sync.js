/**
 * nubank-invoice-gmail-sync.js
 * Busca a fatura PDF do Nubank no Gmail, parseia e grava em public/nubank-invoice-pending.json.
 * Roda automaticamente via Task Scheduler no dia 5 de cada mês às 23:59.
 *
 * Pré-requisito: ter rodado authorize-google.js ao menos uma vez
 *               para que o token.json esteja salvo.
 *
 * Uso:
 *   node scripts/sync/nubank-invoice-gmail-sync.js
 *   node scripts/sync/nubank-invoice-gmail-sync.js --headless
 */

import { PDFParse } from 'pdf-parse';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordUnparsedEmail } from '../lib/dead-letter.js';
import { notifySyncFailure } from '../lib/notify.js';
import { searchMessages, getMessage, getAttachment, listAttachments } from '../../server/google.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR    = resolve(__dirname, '../config');
const STATE_PATH    = resolve(CONFIG_DIR, 'nubank-invoice-state.json');
const OUTPUT_PATH   = resolve(__dirname, '../../public/nubank-invoice-pending.json');

const GMAIL_QUERY = 'from:todomundo@nubank.com.br subject:"fatura do seu cartão" has:attachment filename:pdf';

// ─── Estado (dedup por messageId) ───────────────────────────────────────────

function loadState() {
  if (!existsSync(STATE_PATH)) return { processedMessageIds: [] };
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf-8')); }
  catch { return { processedMessageIds: [] }; }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ─── Parser PDF (mesmo algoritmo do nubank-invoice-parser.js) ──────────────

const MONTH_MAP = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04',
  MAI: '05', JUN: '06', JUL: '07', AGO: '08',
  SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};
const MONTHS = Object.keys(MONTH_MAP).join('|');

const RX_TX      = new RegExp(`^(\\d{2})\\s+(${MONTHS})\\s+[•\\s]+\\d{4}\\s+(.+?)\\s+R\\$\\s*([\\d.]+,\\d{2})$`);
const RX_ESTORNO = new RegExp(`^(\\d{2})\\s+(${MONTHS})\\s+Estorno de "(.+?)"\\s+[\\u2212\\-]R\\$\\s*([\\d.]+,\\d{2})$`);
const RX_YEAR    = /FATURA\s+\d{2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/;
const RX_PARCELA = /[-–]\s*Parcela\s+(\d+)\/(\d+)/i;

function parseAmount(s) {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}

function toISO(day, month, year) {
  return `${year}-${MONTH_MAP[month]}-${day.padStart(2, '0')}`;
}

function skip(line) {
  return !line.trim()
    || line.startsWith('IOF de')
    || line.startsWith('USD ')
    || line.startsWith('Conversão:')
    || line.includes('EMISSÃO E ENVIO')
    || line.includes('TRANSAÇÕES DE')
    || /^\d+ de \d+$/.test(line)
    || /^-- \d+ of \d+ --$/.test(line)
    || (/^[A-ZÁÉÍÓÚ][a-záéíóú]+\s+[A-ZÁÉÍÓÚ]/.test(line) && /R\$\s*[\d.]+,\d{2}$/.test(line) && !line.match(/^\d{2}\s/));
}

function parsePdf(text, filename) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
  let year = new Date().getFullYear().toString();
  for (const l of lines) { const m = l.match(RX_YEAR); if (m) { year = m[1]; break; } }

  const endIdx = lines.findIndex(l => l.startsWith('Pagamentos e Financiamentos'));
  const limit  = endIdx === -1 ? lines.length : endIdx;
  const txs    = [];

  let i = 0;
  while (i < limit) {
    const line = lines[i];
    if (skip(line)) { i++; continue; }

    const em = line.match(RX_ESTORNO);
    if (em) {
      const [, day, month, desc, amt] = em;
      txs.push({ date: toISO(day, month, year), description: `Estorno: ${desc}`, amount: -parseAmount(amt), isRefund: true, installment: null, source: filename });
      i++; continue;
    }

    const tm = line.match(RX_TX);
    if (tm) {
      const [, day, month, desc, amt] = tm;
      const pm = desc.match(RX_PARCELA);
      txs.push({
        date: toISO(day, month, year),
        description: desc.replace(RX_PARCELA, '').trim(),
        amount: parseAmount(amt),
        isRefund: false,
        installment: pm ? { current: parseInt(pm[1]), total: parseInt(pm[2]) } : null,
        source: filename,
      });
      i++; continue;
    }

    // Transação internacional multi-linha (sem valor na própria linha)
    if (/^\d{2}\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+[•]+\s+\d{4}\s+/.test(line)) {
      const hm = line.match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+[•\s]+\d{4}\s+(.+?)$/);
      if (hm) {
        const [, day, month, desc] = hm;
        let amount = 0;
        for (let j = i + 1; j <= i + 3 && j < limit; j++) {
          const am = lines[j].match(/^R\$\s*([\d.]+,\d{2})$/);
          if (am) { amount = parseAmount(am[1]); break; }
        }
        if (amount > 0) {
          txs.push({ date: toISO(day, month, year), description: desc.trim(), amount, isRefund: false, installment: null, source: filename });
        }
        i++;
        while (i < limit && !lines[i].match(/^\d{2}\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/)) i++;
        continue;
      }
    }
    i++;
  }
  return { year, transactions: txs };
}

// ─── Gmail: baixar PDF da fatura ────────────────────────────────────────────

async function fetchLatestInvoicePdf() {
  const messages = await searchMessages(GMAIL_QUERY, 3);
  if (!messages.length) {
    console.log('[invoice-sync] Nenhum email de fatura encontrado.');
    return null;
  }

  const state = loadState();
  // Pega a mensagem mais recente não processada
  for (const msg of messages) {
    if (state.processedMessageIds.includes(msg.id)) {
      console.log(`[invoice-sync] Mensagem ${msg.id} já processada — pulando.`);
      continue;
    }

    const full = await getMessage(msg.id);
    const pdf = listAttachments(full).find((a) =>
      a.filename.toLowerCase().endsWith('.pdf') || a.mimeType === 'application/pdf',
    );

    if (!pdf) {
      console.log(`[invoice-sync] Mensagem ${msg.id} sem PDF anexo — pulando.`);
      continue;
    }

    return {
      messageId: msg.id,
      filename: pdf.filename || `Nubank_fatura_${msg.id}.pdf`,
      buffer: await getAttachment(msg.id, pdf.attachmentId),
    };
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[invoice-sync] Iniciando sincronização de fatura PDF Nubank...');

  const invoice = await fetchLatestInvoicePdf();
  if (!invoice) {
    console.log('[invoice-sync] Nenhuma fatura nova para processar.');
    return;
  }

  console.log(`[invoice-sync] Baixando fatura: ${invoice.filename}`);

  const parser = new PDFParse({ data: invoice.buffer });
  const result = await parser.getText();
  await parser.destroy();

  const { year, transactions } = parsePdf(result.text, invoice.filename);

  if (transactions.length === 0) {
    // PDF baixou mas o parser não reconheceu nenhuma linha — provável mudança de layout
    recordUnparsedEmail('invoice-sync', {
      emailId: invoice.messageId,
      subject: invoice.filename,
      snippet: result.text,
    });
    console.warn('[invoice-sync] Fatura parseada com 0 transações — registrada em logs/unparsed-emails.json');
    await notifySyncFailure('invoice-sync', new Error(`Fatura ${invoice.filename} parseada com 0 transações.`));
  }

  const output = {
    exportedAt: new Date().toISOString(),
    sourceFile: invoice.filename,
    invoiceYear: year,
    transactions,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  // Marca como processado
  const state = loadState();
  state.processedMessageIds = [invoice.messageId, ...state.processedMessageIds].slice(0, 12);
  saveState(state);

  console.log(`[invoice-sync] ${transactions.length} transações extraídas → public/nubank-invoice-pending.json`);
  console.log('[invoice-sync] Concluído.');
}

main().catch(async (err) => {
  console.error('[invoice-sync] Erro:', err.message);
  await notifySyncFailure('invoice-sync', err);
  process.exit(1);
});
