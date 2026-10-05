import { storageAdapter } from '../../../core/storage/storage.adapter';
import type { ChatMessage } from '../types/chat';

const STORAGE_KEY = 'study.chats';

type ChatStore = Record<string, ChatMessage[]>;

function load(): ChatStore {
  const raw = storageAdapter.getItem<ChatStore>(STORAGE_KEY);
  return raw ?? {};
}

function save(store: ChatStore): void {
  storageAdapter.setItem(STORAGE_KEY, store);
}

export const studyChatService = {
  listMessages(contentId: string): ChatMessage[] {
    return load()[contentId] ?? [];
  },

  addMessage(contentId: string, msg: ChatMessage): void {
    const store = load();
    if (!store[contentId]) store[contentId] = [];
    store[contentId].push(msg);
    save(store);
  },

  clear(contentId: string): void {
    const store = load();
    delete store[contentId];
    save(store);
  },
};
