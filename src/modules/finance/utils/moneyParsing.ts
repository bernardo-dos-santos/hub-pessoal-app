/**
 * Reads an amount the way a person in Brazil writes it — and the formats bank
 * exports throw at us. Returns null when it can't tell, so the caller can say
 * "valor ilegível" instead of storing R$ 0 (what `Number(x) || 0` did).
 *
 *   "1.234,56"  → 1234.56     "1.200"   → 1200 (thousands, not 1,2)
 *   "15,90"     → 15.9        "15.90"   → 15.9
 *   "1,234.56"  → 1234.56     "R$ -8,00" → -8
 *   "1.234,56-" → -1234.56    "(30,00)" → -30
 */
export function parseMoneyText(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw.replace(/^R\$\s*/i, '')) || /-\s*$/.test(raw) || /\bR\$\s*-/.test(raw);
  let digits = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(digits)) return null;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the last one is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    digits = digits.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    // Only commas: one is the decimal (pt-BR); several are thousands.
    digits = (digits.match(/,/g) ?? []).length > 1 ? digits.split(',').join('') : digits.replace(',', '.');
  } else if (lastDot !== -1) {
    // Only dots: several, or one followed by exactly 3 digits, are thousands ("1.200").
    const dots = (digits.match(/\./g) ?? []).length;
    if (dots > 1 || /^\d{1,3}\.\d{3}$/.test(digits)) digits = digits.split('.').join('');
  }

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}
