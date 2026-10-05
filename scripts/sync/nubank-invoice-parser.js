// nubank-invoice-parser.js
// Parseia o PDF de fatura do Nubank e gera public/nubank-invoice-pending.json
//
// Uso: node scripts/sync/nubank-invoice-parser.js <caminho-do-pdf>
// Exemplo: node scripts/sync/nubank-invoice-parser.js "C:\Users\Bernardo\Downloads\Nubank_2026-05-12.pdf"
//
// Output: public/nubank-invoice-pending.json

import { PDFParse } from 'pdf-parse';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUTPUT_PATH = resolve(ROOT, 'public/nubank-invoice-pending.json');

const MONTH_MAP = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04',
  MAI: '05', JUN: '06', JUL: '07', AGO: '08',
  SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};

const MONTHS = Object.keys(MONTH_MAP).join('|');

// Regex: "05 ABR •••• 7467 Descrição R$ 49,94"
const RX_TX = new RegExp(
  `^(\\d{2})\\s+(${MONTHS})\\s+[•\\s]+\\d{4}\\s+(.+?)\\s+R\\$\\s*([\\d.]+,\\d{2})$`,
);

// Regex: "07 ABR Estorno de "Descrição" −R$ 52,78"  (− = U+2212)
const RX_ESTORNO = new RegExp(
  `^(\\d{2})\\s+(${MONTHS})\\s+Estorno de "(.+?)"\\s+[\\u2212\\-]R\\$\\s*([\\d.]+,\\d{2})$`,
);

// Regex: extrai ano da linha "FATURA 12 MAI 2026"
const RX_FATURA_YEAR = /FATURA\s+\d{2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/;

// Regex: parcela  "- Parcela 2/2"
const RX_PARCELA = /[-–]\s*Parcela\s+(\d+)\/(\d+)/i;

function parseAmount(str) {
  // "1.234,56" → 1234.56
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function toISODate(day, month, year) {
  return `${year}-${MONTH_MAP[month]}-${day.padStart(2, '0')}`;
}

function shouldSkip(line) {
  if (!line.trim()) return true;
  if (line.startsWith('IOF de')) return true;
  if (line.startsWith('USD ')) return true;
  if (line.startsWith('Conversão:')) return true;
  if (line.includes('EMISSÃO E ENVIO')) return true;
  if (line.includes('TRANSAÇÕES DE')) return true;
  if (/^\d+ de \d+$/.test(line)) return true;
  if (/^-- \d+ of \d+ --$/.test(line)) return true;
  if (/^[A-ZÁÉÍÓÚ][a-záéíóú]+\s+[A-ZÁÉÍÓÚ]/.test(line) && /R\$\s*[\d.]+,\d{2}$/.test(line) && !line.match(/^\d{2}\s/)) return true;
  return false;
}

function parsePdfText(text, pdfFilename) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
  const transactions = [];

  // Extrai ano da fatura
  let invoiceYear = new Date().getFullYear().toString();
  for (const line of lines) {
    const m = line.match(RX_FATURA_YEAR);
    if (m) { invoiceYear = m[1]; break; }
  }

  // Determina limite: para no bloco de "Pagamentos e Financiamentos"
  let endIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Pagamentos e Financiamentos')) {
      endIndex = i;
      break;
    }
  }

  let i = 0;
  while (i < endIndex) {
    const line = lines[i];

    if (shouldSkip(line)) { i++; continue; }

    // Estorno
    const estornoMatch = line.match(RX_ESTORNO);
    if (estornoMatch) {
      const [, day, month, description, amountStr] = estornoMatch;
      transactions.push({
        date: toISODate(day, month, invoiceYear),
        description: `Estorno: ${description}`,
        amount: -parseAmount(amountStr), // negativo = crédito/estorno
        isRefund: true,
        installment: null,
        source: pdfFilename,
      });
      i++;
      continue;
    }

    // Transação normal
    const txMatch = line.match(RX_TX);
    if (txMatch) {
      const [, day, month, description, amountStr] = txMatch;
      const parcelaMatch = description.match(RX_PARCELA);
      const cleanDesc = description.replace(RX_PARCELA, '').trim();
      transactions.push({
        date: toISODate(day, month, invoiceYear),
        description: cleanDesc,
        amount: parseAmount(amountStr),
        isRefund: false,
        installment: parcelaMatch
          ? { current: parseInt(parcelaMatch[1]), total: parseInt(parcelaMatch[2]) }
          : null,
        source: pdfFilename,
      });
      i++;
      continue;
    }

    // Linha internacional multi-linha: próxima linha é "USD X.XX" → pular até achar "R$ X,XX"
    // A própria linha da transação não tem o valor (que fica 2 linhas depois)
    if (/^\d{2}\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+[•]+\s+\d{4}\s+/.test(line)) {
      // Transação internacional: próximas linhas têm "USD X.XX", "Conversão: ...", "R$ X,XX"
      const headerMatch = line.match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+[•\s]+\d{4}\s+(.+?)$/);
      if (headerMatch) {
        const [, day, month, description] = headerMatch;
        // Busca "R$ X,XX" nas próximas 3 linhas
        let amount = 0;
        for (let j = i + 1; j <= i + 3 && j < endIndex; j++) {
          const amtMatch = lines[j].match(/^R\$\s*([\d.]+,\d{2})$/);
          if (amtMatch) { amount = parseAmount(amtMatch[1]); break; }
        }
        if (amount > 0) {
          transactions.push({
            date: toISODate(day, month, invoiceYear),
            description: description.trim(),
            amount,
            isRefund: false,
            installment: null,
            source: pdfFilename,
          });
        }
        // Avança além das linhas extras (USD, Conversão, R$)
        i++;
        while (i < endIndex && !lines[i].match(/^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+/)) i++;
        continue;
      }
    }

    i++;
  }

  return { invoiceYear, transactions };
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Uso: node nubank-invoice-parser.js <caminho-do-pdf>');
    console.error('Exemplo: node scripts/sync/nubank-invoice-parser.js "C:\\Users\\Bernardo\\Downloads\\Nubank_2026-05-12.pdf"');
    process.exit(1);
  }

  const resolvedPath = resolve(pdfPath);
  console.log(`[nubank-invoice-parser] Lendo: ${resolvedPath}`);

  const buffer = await readFile(resolvedPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const filename = resolvedPath.split(/[/\\]/).pop();
  const { invoiceYear, transactions } = parsePdfText(result.text, filename);

  const output = {
    exportedAt: new Date().toISOString(),
    sourceFile: filename,
    invoiceYear,
    transactions,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`[nubank-invoice-parser] ${transactions.length} transações extraídas → public/nubank-invoice-pending.json`);
  console.log('[nubank-invoice-parser] Amostra das primeiras 5:');
  transactions.slice(0, 5).forEach(t =>
    console.log(`  ${t.date}  ${t.description.padEnd(35)} R$ ${t.amount.toFixed(2)}`)
  );
}

main().catch(err => {
  console.error('[nubank-invoice-parser] Erro:', err.message);
  process.exit(1);
});
