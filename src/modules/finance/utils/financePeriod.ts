const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function createMonthDate(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function isValidMonthKey(monthKey: string | null | undefined): monthKey is string {
  return Boolean(monthKey && monthKeyPattern.test(monthKey));
}

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousMonthKey(monthKey: string) {
  const date = createMonthDate(isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey());
  date.setMonth(date.getMonth() - 1);
  return getCurrentMonthKey(date);
}

export function getNextMonthKey(monthKey: string) {
  const date = createMonthDate(isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey());
  date.setMonth(date.getMonth() + 1);
  return getCurrentMonthKey(date);
}

export function formatMonthLabel(monthKey: string) {
  const safeMonthKey = isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey();
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(createMonthDate(safeMonthKey));
}

export function getMonthKeyFromQuery(monthKey: string | null | undefined) {
  return isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey();
}

export function withMonthParam(path: string, monthKey: string) {
  return withFinanceFilters(path, { month: monthKey });
}

export type FinanceUrlFilters = {
  month?: string;
  category?: string;
  view?: string;
};

export function withFinanceFilters(path: string, filters: FinanceUrlFilters) {
  const searchParams = new URLSearchParams();

  if (filters.month) {
    searchParams.set('month', isValidMonthKey(filters.month) ? filters.month : getCurrentMonthKey());
  }

  if (filters.category?.trim()) {
    searchParams.set('category', filters.category.trim());
  }

  if (filters.view?.trim()) {
    searchParams.set('view', filters.view.trim());
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function withReimbursementsParams(monthKey: string) {
  return withFinanceFilters('/financeiro/transacoes', { month: monthKey, view: 'reembolsos' });
}

export function withMonthAndCategoryParams(path: string, monthKey: string, category?: string) {
  return withFinanceFilters(path, { month: monthKey, category });
}

export function withoutFinanceFilter(path: string, filters: FinanceUrlFilters, filter: keyof FinanceUrlFilters) {
  const nextFilters = { ...filters };
  delete nextFilters[filter];
  return withFinanceFilters(path, nextFilters);
}

export function clearFinanceFilters(path: string) {
  return withFinanceFilters(path, {});
}
