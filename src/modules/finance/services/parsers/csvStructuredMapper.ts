import {
  type CsvParseOptions,
  type CsvRow,
  type ParserProfile,
  type StructuredTransactionRow,
} from '../../types/import';
import { normalizeCsvHeader, parseCsv } from './csvParser';

const structuredKeys: Array<keyof Omit<StructuredTransactionRow, 'raw'>> = [
  'date',
  'description',
  'amount',
  'value',
  'entryAmount',
  'exitAmount',
  'details',
  'identifier',
  'category',
  'account',
  'institution',
];

export function mapCsvRowsToStructuredRows(csvRows: CsvRow[], profile: ParserProfile): StructuredTransactionRow[] {
  return csvRows.map((csvRow) => {
    const structuredRow: StructuredTransactionRow = { raw: csvRow };

    structuredKeys.forEach((key) => {
      const value = findCsvValue(csvRow, key, profile);

      if (value !== undefined && value !== '') {
        structuredRow[key] = value;
      }
    });

    return structuredRow;
  });
}

export function parseCsvToStructuredRows(text: string, profile: ParserProfile, options: CsvParseOptions = {}) {
  const expectedHeaders = options.expectedHeaders ?? getProfileExpectedHeaders(profile);
  const parsed = parseCsv(text, { ...options, expectedHeaders });

  return {
    ...parsed,
    structuredRows: mapCsvRowsToStructuredRows(parsed.rows, profile),
    profileId: profile.id,
  };
}

function findCsvValue(csvRow: CsvRow, key: keyof Omit<StructuredTransactionRow, 'raw'>, profile: ParserProfile) {
  const aliases = [key, ...(profile.csvColumnAliases?.[key] ?? [])].map((alias) => normalizeCsvHeader(String(alias)));
  const matchedHeader = aliases.find((alias) => Object.prototype.hasOwnProperty.call(csvRow, alias));

  return matchedHeader ? csvRow[matchedHeader] : undefined;
}

function getProfileExpectedHeaders(profile: ParserProfile) {
  const aliases = Object.values(profile.csvColumnAliases ?? {}).flat();
  return aliases.length > 0 ? aliases : ['data', 'date', 'descricao', 'description'];
}
