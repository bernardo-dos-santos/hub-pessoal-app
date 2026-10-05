import { type CsvParseOptions, type CsvParseResult, type CsvRow } from '../../types/import';
import { removeAccents } from '../../utils/financeText';

export function detectCsvDelimiter(text: string) {
  const usefulLines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 10);

  if (usefulLines.length === 0) {
    return ',';
  }

  const commaCount = usefulLines.reduce((total, line) => total + countDelimiter(line, ','), 0);
  const semicolonCount = usefulLines.reduce((total, line) => total + countDelimiter(line, ';'), 0);

  return semicolonCount > commaCount ? ';' : ',';
}

export function normalizeCsvHeader(header: string) {
  return removeAccents(String(header || ''))
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function findHeaderRow(lines: string[][], expectedHeaders: string[] = []) {
  if (expectedHeaders.length === 0) {
    return lines.findIndex((line) => line.some((cell) => cell.trim()));
  }

  const normalizedExpected = expectedHeaders.map(normalizeCsvHeader);

  return lines.findIndex((line) => {
    const normalizedLine = line.map(normalizeCsvHeader);
    return normalizedExpected.some((header) => normalizedLine.includes(header));
  });
}

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  const delimiter = options.delimiter ?? detectCsvDelimiter(text);
  const errors: string[] = [];
  const warnings: string[] = [];
  const records = parseCsvRecords(String(text || '').replace(/^\uFEFF/, ''), delimiter);
  const nonEmptyRecords = options.skipEmptyLines === false ? records : records.filter((row) => row.some((cell) => cell.trim()));
  const headerRowIndex = options.headerRowIndex ?? findHeaderRow(nonEmptyRecords, options.expectedHeaders);

  if (headerRowIndex < 0) {
    return {
      rows: [],
      headers: [],
      delimiter,
      totalRows: 0,
      errors: ['Header CSV não encontrado.'],
      warnings,
    };
  }

  const headers = nonEmptyRecords[headerRowIndex].map(normalizeCsvHeader);
  const dataRecords = nonEmptyRecords.slice(headerRowIndex + 1);
  const rows = dataRecords.reduce<CsvRow[]>((mappedRows, record, recordIndex) => {
    if (record.length !== headers.length) {
      warnings.push(`Linha ${recordIndex + headerRowIndex + 2}: quantidade de colunas diferente do header.`);
    }

    if (record.length === 0 || record.every((cell) => !cell.trim())) {
      return mappedRows;
    }

    const row = headers.reduce<CsvRow>((currentRow, header, index) => {
      currentRow[header] = record[index]?.trim() ?? '';
      return currentRow;
    }, {});

    mappedRows.push(row);
    return mappedRows;
  }, []);

  return {
    rows,
    headers,
    delimiter,
    totalRows: rows.length,
    errors,
    warnings,
  };
}

export function parseCsvToObjects(text: string, options: CsvParseOptions = {}) {
  return parseCsv(text, options);
}

export function parseBrazilianMoney(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }

  const raw = String(value ?? '').trim();

  if (!raw) {
    return 0;
  }

  const negativeByParentheses = raw.startsWith('(') && raw.endsWith(')');
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized) || 0;

  return negativeByParentheses ? -Math.abs(parsed) : parsed;
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

function parseCsvRecords(text: string, delimiter: string) {
  const records: string[][] = [];
  let line = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"') {
      line += '""';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      line += char;
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      records.push(parseCsvLine(line, delimiter));
      line = '';
      continue;
    }

    line += char;
  }

  if (line.length > 0 || text.endsWith('\n') || text.endsWith('\r')) {
    records.push(parseCsvLine(line, delimiter));
  }

  return records;
}
