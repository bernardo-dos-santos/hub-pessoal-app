import {
  type ParseStructuredRowsResult,
  type ParserProfile,
  type ParserValidationResult,
  type RawTransactionDraft,
  type StructuredTransactionRow,
} from '../../types/import';

export function parseAmountFromStructuredRow(row: StructuredTransactionRow, _profile: ParserProfile) {
  const rawAmount = row.amount ?? row.value;

  if (rawAmount !== undefined && rawAmount !== '') {
    return parseMoney(rawAmount);
  }

  const entry = parseMoney(row.entryAmount ?? 0);
  const exit = parseMoney(row.exitAmount ?? 0);

  if (entry > 0) {
    return entry;
  }

  if (exit > 0) {
    return -Math.abs(exit);
  }

  return 0;
}

export function validateStructuredRow(row: StructuredTransactionRow, profile: ParserProfile): ParserValidationResult {
  return profile.validateRow(row);
}

export function mapStructuredRowToDraft(row: StructuredTransactionRow, profile: ParserProfile): RawTransactionDraft {
  return profile.mapRowToDraft(row);
}

export function parseStructuredRows(rows: StructuredTransactionRow[], profile: ParserProfile): ParseStructuredRowsResult {
  const drafts: RawTransactionDraft[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  rows.forEach((row, index) => {
    const validation = validateStructuredRow(row, profile);
    const rowLabel = `Linha ${index + 1}`;

    validation.errors.forEach((error) => errors.push(`${rowLabel}: ${error}`));
    validation.warnings.forEach((warning) => warnings.push(`${rowLabel}: ${warning}`));

    if (!validation.valid) {
      return;
    }

    drafts.push(mapStructuredRowToDraft(row, profile));
  });

  return {
    totalRows: rows.length,
    drafts,
    errors,
    warnings,
    profileId: profile.id,
  };
}

function parseMoney(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }

  const raw = String(value ?? '').trim();

  if (!raw) {
    return 0;
  }

  const negativeByParentheses = raw.startsWith('(') && raw.endsWith(')');
  const compact = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(compact) || 0;

  return negativeByParentheses ? -Math.abs(parsed) : parsed;
}
