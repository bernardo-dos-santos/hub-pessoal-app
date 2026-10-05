import { storageAdapter } from '../storage/storage.adapter';
import { generateId } from '../../shared/utils/generateId';

const INBOX_KEY = 'jarvis.inbox';
const MAX_INBOX = 100;

export type InboxItemKind = 'observation' | 'action_taken' | 'question' | 'task_result';

/**
 * Desfazer genérico por item — cobre os dois casos do plano ("criação → guarda
 * o id criado; desfazer remove" e "edição → guarda o valor anterior; desfazer
 * restaura") sem precisar de um handler por domínio. Quem cria o item de
 * inbox decide qual dos dois descreve a ação que tomou.
 */
export type InboxUndo =
  | { type: 'remove_by_id'; key: string; id: string }
  | { type: 'restore_value'; key: string; previousValue: unknown };

export type InboxItem = {
  id: string;
  kind: InboxItemKind;
  title: string;
  body?: string;
  createdAt: string;
  readAt: string | null;
  undo?: InboxUndo;
  relatedKeys?: string[];
};

export type NewInboxItem = Omit<InboxItem, 'id' | 'createdAt' | 'readAt'>;

/**
 * Uma novidade some da caixa no fim do dia SEGUINTE ao que foi criada.
 *
 * O que o Jarvis registra sozinho é quase sempre momentâneo — "a sessão começa
 * em 26 minutos", "corre antes da chuva". No dia seguinte isso não é
 * informação, é entulho: ocupa o painel e faz o aviso que importa se perder no
 * meio.
 *
 * Nada é apagado: o item continua em `list()`, com o desfazer intacto. O que
 * expira é a *insistência* — ele para de contar como não lido e de aparecer no
 * painel.
 *
 * E o que for cronicamente importante não se perde: o tick roda várias vezes
 * por dia e volta a levantar o assunto enquanto ele existir. "Onze dias sem
 * treinar" reaparece amanhã porque continua verdade; "faltam 26 minutos para a
 * sessão" não reaparece porque deixou de ser.
 */
const INBOX_TTL_DAYS = 1;

function isStale(item: InboxItem, now: number): boolean {
  const created = new Date(item.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const limite = new Date(created);
  limite.setDate(limite.getDate() + INBOX_TTL_DAYS + 1);
  limite.setHours(0, 0, 0, 0);
  return now >= limite.getTime();
}

function readItems(): InboxItem[] {
  return storageAdapter.getItem<InboxItem[]>(INBOX_KEY) ?? [];
}

function writeItems(items: InboxItem[]): void {
  storageAdapter.setItem(INBOX_KEY, items.slice(0, MAX_INBOX));
}

export const jarvisInboxService = {
  list(): InboxItem[] {
    return readItems().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  unread(): InboxItem[] {
    const now = Date.now();
    return this.list().filter((i) => !i.readAt && !isStale(i, now));
  },

  /** Só o que já venceu — para inspeção; o painel usa `unread()`. */
  stale(): InboxItem[] {
    const now = Date.now();
    return this.list().filter((i) => !i.readAt && isStale(i, now));
  },

  unreadCount(): number {
    return this.unread().length;
  },

  add(item: NewInboxItem): InboxItem {
    const created: InboxItem = {
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    writeItems([created, ...readItems()]);
    return created;
  },

  markRead(id: string): void {
    const items = readItems();
    const item = items.find((i) => i.id === id);
    if (!item || item.readAt) return;
    item.readAt = new Date().toISOString();
    writeItems(items);
  },

  markAllRead(): void {
    const now = new Date().toISOString();
    writeItems(readItems().map((i) => (i.readAt ? i : { ...i, readAt: now })));
  },

  remove(id: string): void {
    writeItems(readItems().filter((i) => i.id !== id));
  },

  /**
   * Aplica o desfazer descrito no item (se houver) e remove o item da inbox.
   * `restore_value` sobrescreve a chave inteira — funciona tanto pra objeto
   * único quanto pra array, contanto que `previousValue` tenha sido guardado
   * no formato certo por quem criou o item.
   */
  undo(id: string): void {
    const items = readItems();
    const item = items.find((i) => i.id === id);
    const undo = item?.undo;
    if (!undo) return;

    if (undo.type === 'remove_by_id') {
      const arr = storageAdapter.getItem<Array<{ id: string }>>(undo.key) ?? [];
      storageAdapter.setItem(undo.key, arr.filter((x) => x.id !== undo.id));
    } else {
      storageAdapter.setItem(undo.key, undo.previousValue);
    }

    this.remove(id);
  },
};
