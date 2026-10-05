import { storageAdapter } from '../storage/storage.adapter';
import { apiUrl } from '../config/backendConfig';

/**
 * Configuração dos três slots de IA.
 *
 * A parte não-secreta (provedor, modelo, URL do Ollama) é um valor normal do
 * storageAdapter, em `ai.settings`. A CHAVE não passa por aqui: o kv_store
 * inteiro é sincronizado para o browser, então ela vive na tabela `secrets` do
 * servidor, cifrada, e só é manipulada pelas rotas /api/ai/keys.
 *
 * Invariante que sustenta o `isReady()` síncrono: um slot só é gravado em
 * `ai.settings` DEPOIS que a chave dele foi aceita pelo servidor (quando o
 * provedor exige chave). Slot presente, portanto, é slot utilizável — a tela de
 * Configurações é quem garante isso, em `saveSlot()`.
 */

export type AiProviderName = 'anthropic' | 'gemini' | 'ollama';

export type AiSlotId = 'principal' | 'secundaria' | 'fallback';

export type AiSlotConfig = {
  provider: AiProviderName;
  model: string;
  /** Só para provedores locais (Ollama). Resolvida a partir do servidor. */
  baseUrl: string | null;
};

export type AiSettings = Record<AiSlotId, AiSlotConfig | null>;

/** Metadados de um provedor, servidos por GET /api/ai/providers. */
export type AiProviderMeta = {
  id: AiProviderName;
  label: string;
  hint: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  keyUrl: string | null;
  defaultModel: string;
  defaultBaseUrl: string | null;
  suggestedModels: string[];
};

export type AiSlotStatus = AiSlotConfig & { hasKey: boolean };

export type AiStatus = {
  settings: Record<AiSlotId, AiSlotStatus | null>;
  /** O servidor tem CREDENTIALS_ENCRYPTION_KEY? Sem ela não dá para salvar chave. */
  encryption: boolean;
  /** Ordem de tentativa real, vinda do servidor — a tela não guarda cópia dela. */
  chainOrder: AiSlotId[];
};

const KEY_SETTINGS = 'ai.settings';

export const AI_SLOTS: AiSlotId[] = ['principal', 'secundaria', 'fallback'];

export const AI_SLOT_LABEL: Record<AiSlotId, string> = {
  principal: 'Principal',
  secundaria: 'Secundária',
  fallback: 'Fallback',
};

/** Sugestão inicial de provedor por papel. Só um default de tela — cada slot
 *  aceita qualquer provedor. */
export const AI_SLOT_DEFAULT_PROVIDER: Record<AiSlotId, AiProviderName> = {
  principal: 'anthropic',
  secundaria: 'gemini',
  fallback: 'ollama',
};

export const AI_SLOT_HELP: Record<AiSlotId, string> = {
  principal: 'Obrigatório. Sem ele o Hub não tem IA — nenhuma função de IA aparece.',
  secundaria: 'Opcional. É por onde toda chamada começa: gasta a cota gratuita antes da paga.',
  fallback: 'Opcional. Última tentativa, quando os dois anteriores falham.',
};

function emptySettings(): AiSettings {
  return { principal: null, secundaria: null, fallback: null };
}

export const aiConfig = {
  getSettings(): AiSettings {
    return storageAdapter.getItem<AiSettings>(KEY_SETTINGS) ?? emptySettings();
  },

  getSlot(slot: AiSlotId): AiSlotConfig | null {
    return this.getSettings()[slot] ?? null;
  },

  setSlot(slot: AiSlotId, config: AiSlotConfig | null): AiSettings {
    const settings = { ...this.getSettings(), [slot]: config };
    storageAdapter.setItem(KEY_SETTINGS, settings);
    return settings;
  },

  /**
   * A IA está pronta? Depende só do slot Principal: "sem chave, sem IA" — não
   * há queda para chave global do servidor, para o custo da IA de um usuário
   * não cair no dono da máquina.
   */
  isReady(): boolean {
    return this.getSlot('principal') !== null;
  },

  /**
   * Provedor que provavelmente vai atender a próxima chamada: o primeiro slot
   * configurado na ordem de tentativa. Serve para decisões que dependem da
   * capacidade do modelo (quanto contexto cabe), não para roteamento — quem
   * roteia é o servidor.
   *
   * A ordem vem do servidor, que é quem a executa; sem servidor no ar, cai na
   * ordem de declaração, que começa pelo Principal.
   */
  async getLikelyProvider(): Promise<AiProviderName | null> {
    const settings = this.getSettings();
    const status = cachedStatus ?? (await aiKeys.getStatus().catch(() => null));
    for (const slot of status?.chainOrder ?? AI_SLOTS) {
      const config = settings[slot];
      if (config) return config.provider;
    }
    return null;
  },
};

// ── Rotas que tocam no que é secreto ou vive só no servidor ──────────────────

/** Última resposta de /api/ai/status. Evita ir à rede a cada consulta de ordem. */
let cachedStatus: AiStatus | null = null;

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}.`);
  return data;
}

export const aiKeys = {
  /** Provedores suportados, com modelos sugeridos e o que cada um exige. */
  async listProviders(): Promise<AiProviderMeta[]> {
    const data = await json<{ providers: AiProviderMeta[] }>(await fetch(apiUrl('/api/ai/providers')));
    return data.providers;
  },

  /** Quais slots têm chave guardada (o browser não consegue ver a tabela `secrets`). */
  async getStatus(): Promise<AiStatus> {
    cachedStatus = await json<AiStatus>(await fetch(apiUrl('/api/ai/status')));
    return cachedStatus;
  },

  async saveKey(slot: AiSlotId, apiKey: string): Promise<void> {
    await json(await fetch(apiUrl('/api/ai/keys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, apiKey }),
    }));
  },

  async clearKey(slot: AiSlotId): Promise<void> {
    await json(await fetch(apiUrl(`/api/ai/keys/${slot}`), { method: 'DELETE' }));
  },

  /**
   * Ping real naquele slot. `config` é a combinação que está na tela, que vale
   * mais que a salva — a gravação de `ai.settings` é assíncrona, e testar logo
   * depois de salvar leria a configuração anterior.
   */
  async test(slot: AiSlotId, config: AiSlotConfig): Promise<{ ok: boolean; text: string; provider: string; model: string }> {
    return json(await fetch(apiUrl('/api/ai/test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, ...config }),
    }));
  },

  /** Modelos que aquela chave/instância aceita de verdade. */
  async listModels(slot: AiSlotId, config: Pick<AiSlotConfig, 'provider' | 'baseUrl'>): Promise<string[]> {
    const data = await json<{ models: string[] }>(await fetch(apiUrl('/api/ai/models'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, ...config }),
    }));
    return data.models;
  },
};
