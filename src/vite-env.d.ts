/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço do servidor no tailnet (ver .env.example). Vazio = mesmo host. */
  readonly VITE_HUB_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
