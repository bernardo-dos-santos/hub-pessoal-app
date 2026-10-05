import { storageAdapter } from '../storage/storage.adapter';

const KEY_EXAM_DATE    = 'concurso.examDate';
const KEY_EDITAL_CACHE = 'concurso.editalAlertsCache';
const KEY_DISMISSED    = 'concurso.dismissedEditalAlerts';

export type EditalAlert = {
  title: string;
  url: string;
  foundKeyword: string;
  detectedAt: string;
};

export type EditalCache = {
  checkedAt: string | null;
  alerts: EditalAlert[];
};

export const concursoService = {
  getExamDate(): string | null {
    return storageAdapter.getItem<string>(KEY_EXAM_DATE) ?? null;
  },

  setExamDate(date: string): void {
    storageAdapter.setItem(KEY_EXAM_DATE, date);
  },

  getDaysUntilExam(): number | null {
    const date = this.getExamDate();
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(date + 'T00:00:00');
    return Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  },

  cacheEditalAlerts(data: EditalCache): void {
    storageAdapter.setItem(KEY_EDITAL_CACHE, data);
  },

  getCachedEditalAlerts(): EditalCache | null {
    return storageAdapter.getItem<EditalCache>(KEY_EDITAL_CACHE) ?? null;
  },

  getActiveEditalAlerts(): EditalAlert[] {
    const cache = this.getCachedEditalAlerts();
    if (!cache?.alerts?.length) return [];
    const dismissed = storageAdapter.getItem<string[]>(KEY_DISMISSED) ?? [];
    return cache.alerts.filter(
      (a) => !dismissed.includes(a.detectedAt + a.url),
    );
  },

  dismissEditalAlert(alert: EditalAlert): void {
    const dismissed = storageAdapter.getItem<string[]>(KEY_DISMISSED) ?? [];
    const key = alert.detectedAt + alert.url;
    if (!dismissed.includes(key)) {
      storageAdapter.setItem(KEY_DISMISSED, [...dismissed, key]);
    }
  },
};
