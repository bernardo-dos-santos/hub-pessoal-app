export function getCurrentSemester(date = new Date()) {
  const year = date.getFullYear();
  const semester = date.getMonth() < 6 ? 1 : 2;

  return `${year}.${semester}`;
}

export function isIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);

  return todayKey(date);
}

export function compareDateKeys(firstDate: string, secondDate: string) {
  return firstDate.localeCompare(secondDate);
}

export function isDateBetween(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

