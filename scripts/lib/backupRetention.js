/**
 * backupRetention.js — quais backups ficam no Drive.
 *
 * Sete diários cobrem "estraguei algo ontem". Não cobrem "estraguei algo há
 * duas semanas e só percebi agora" — com retenção só de 7 dias, um dado
 * corrompido que passasse despercebido por uma semana era copiado por cima de
 * todos os backups bons. Por isso, além dos diários: o mais novo de cada uma
 * das últimas semanas e de cada um dos últimos meses.
 */

export const RETENTION = { daily: 7, weekly: 4, monthly: 6 };

/** Segunda-feira (UTC) da semana do instante, como chave de agrupamento. */
function weekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

/**
 * @param {{ id: string, createdTime: string }[]} files
 * @returns {Set<string>} ids a manter; o resto pode ser apagado.
 */
export function selectRetained(files, retention = RETENTION) {
  const sorted = [...files].sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  const keep = new Set(sorted.slice(0, retention.daily).map((f) => f.id));

  const newestPer = (keyOf, limit) => {
    const seen = new Map();
    for (const f of sorted) {
      const key = keyOf(new Date(f.createdTime));
      if (!seen.has(key)) seen.set(key, f.id);
      if (seen.size === limit) break;
    }
    for (const id of seen.values()) keep.add(id);
  };
  newestPer(weekKey, retention.weekly);
  newestPer(monthKey, retention.monthly);

  return keep;
}
