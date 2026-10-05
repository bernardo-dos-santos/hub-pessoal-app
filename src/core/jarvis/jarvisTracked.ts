import { storageAdapter } from '../storage/storage.adapter';
import { generateId } from '../../shared/utils/generateId';

const TRACKED_KEY = 'jarvis.tracked';

/**
 * "Coisas que o Jarvis decidiu acompanhar" — camada de dados da Fase 3. Ainda
 * sem UI própria e sem nada que escreva aqui: o tick da Fase 2 (track/untrack/
 * list_tracked) é quem povoa isso. Existe agora só pra a Fase 2 não precisar
 * mexer em schema quando chegar.
 */
export type TrackedStatus = 'active' | 'done';

export type TrackedItem = {
  id: string;
  what: string;
  why: string;
  createdAt: string;
  checkAfter: string;
  status: TrackedStatus;
};

export type NewTrackedItem = Omit<TrackedItem, 'id' | 'createdAt' | 'status'>;

function readItems(): TrackedItem[] {
  return storageAdapter.getItem<TrackedItem[]>(TRACKED_KEY) ?? [];
}

function writeItems(items: TrackedItem[]): void {
  storageAdapter.setItem(TRACKED_KEY, items);
}

export const jarvisTrackedService = {
  list(): TrackedItem[] {
    return readItems().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listActive(): TrackedItem[] {
    return this.list().filter((i) => i.status === 'active');
  },

  /** Itens ativos cujo `checkAfter` já passou — prontos pra serem revisitados. */
  due(today = new Date().toISOString()): TrackedItem[] {
    return this.listActive().filter((i) => i.checkAfter <= today);
  },

  add(item: NewTrackedItem): TrackedItem {
    const created: TrackedItem = {
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    writeItems([created, ...readItems()]);
    return created;
  },

  markDone(id: string): void {
    writeItems(readItems().map((i) => (i.id === id ? { ...i, status: 'done' } : i)));
  },

  remove(id: string): void {
    writeItems(readItems().filter((i) => i.id !== id));
  },
};
