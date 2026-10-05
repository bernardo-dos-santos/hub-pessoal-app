import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type CollegeAlert } from '../types/alert';

const STORAGE_KEY = 'college.alerts';

/** Dias a considerar como "recente" para mostrar o aviso */
export const ALERT_RECENCY_DAYS = 14;

let memoryAlerts: CollegeAlert[] | null = null;

function readAlerts(): CollegeAlert[] {
  return storageAdapter.getItem<CollegeAlert[]>(STORAGE_KEY) ?? memoryAlerts ?? [];
}

function writeAlerts(alerts: CollegeAlert[]): void {
  memoryAlerts = alerts;
  storageAdapter.setItem(STORAGE_KEY, alerts);
}

/**
 * Gera o hash de deduplicação para um aviso.
 * Mesmo aviso repostado com a mesma data não cria duplicata.
 */
export function buildSigaaHash(subjectId: string, title: string, date: string | null | undefined): string {
  return `${subjectId}::${title.trim().toLowerCase()}::${date ?? ''}`;
}

export const alertService = {
  listAlerts(): CollegeAlert[] {
    return readAlerts();
  },

  listActiveAlerts(): CollegeAlert[] {
    return readAlerts().filter((a) => !a.dismissedAt);
  },

  /**
   * Cria um alerta somente se o hash ainda não existir no storage.
   * Retorna null quando ignorado por duplicata.
   */
  createAlertIfNew(input: {
    subjectId?: string;
    subjectName?: string;
    title: string;
    content?: string;
    date?: string;
    sigaaHash: string;
  }): CollegeAlert | null {
    const existing = readAlerts();
    const existingIndex = existing.findIndex((a) => a.sigaaHash === input.sigaaHash);

    if (existingIndex !== -1) {
      // Já existe — se não tinha conteúdo e agora tem, atualiza silenciosamente
      if (!existing[existingIndex].content && input.content) {
        const updated = existing.map((a, i) =>
          i === existingIndex
            ? { ...a, content: input.content, updatedAt: new Date().toISOString() }
            : a,
        );
        writeAlerts(updated);
      }
      return null;
    }

    const now = new Date().toISOString();
    const alert: CollegeAlert = {
      ...input,
      createdAt: now,
      id: generateId(),
      source: 'sigaa_news',
      updatedAt: now,
    };

    writeAlerts([alert, ...existing]);
    return alert;
  },

  dismiss(id: string): void {
    const alerts = readAlerts().map((a) =>
      a.id === id ? { ...a, dismissedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : a,
    );
    writeAlerts(alerts);
  },

  dismissAll(): void {
    const now = new Date().toISOString();
    const alerts = readAlerts().map((a) =>
      a.dismissedAt ? a : { ...a, dismissedAt: now, updatedAt: now },
    );
    writeAlerts(alerts);
  },

  /** Remove todos os avisos de uma disciplina. Retorna quantos saíram. */
  removeBySubject(subjectId: string): number {
    const alerts = readAlerts();
    const remaining = alerts.filter((alert) => alert.subjectId !== subjectId);
    if (remaining.length === alerts.length) return 0;
    writeAlerts(remaining);
    return alerts.length - remaining.length;
  },

  clearAlerts(): void {
    memoryAlerts = null;
    storageAdapter.removeItem(STORAGE_KEY);
  },
};
