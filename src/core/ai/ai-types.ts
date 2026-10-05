export type AiCompleteOptions = {
  /** Temperatura 0–1. Default 0.4. Use baixo (0.2) para saídas estruturadas. */
  temperature?: number;
  /** Instrução de sistema opcional. */
  system?: string;
  /** Máximo de tokens de saída. */
  maxOutputTokens?: number;
};

/** Cada módulo pode expor um resumo textual dos seus dados para o "Pergunte ao Hub". */
export type AiContextProvider = {
  moduleId: string;
  getAiContext(): string;
};
