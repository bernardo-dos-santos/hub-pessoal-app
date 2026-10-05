export function generateId(prefix = 'entity') {
  return `${prefix}-${crypto.randomUUID()}`;
}
