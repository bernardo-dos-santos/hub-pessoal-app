import { Capacitor } from '@capacitor/core';

/**
 * URL base do backend.
 * - Web/PC: '' (usa URLs relativas, proxy do Vite faz o roteamento)
 * - APK (Capacitor): nome MagicDNS do servidor Tailscale quando ativo
 *
 * Usa o nome MagicDNS (não o IP) para não quebrar se o Tailscale reatribuir o IP.
 */
// HTTPS via `tailscale serve` (porta 443), não http://…:3001 — contexto seguro é
// o que libera microfone/notificação no WebView do APK.
// O endereço vem do .env (VITE_HUB_BACKEND) e não do código-fonte: é o nome da
// máquina do servidor dentro do tailnet e não precisa estar no repositório.
export const TAILSCALE_BACKEND: string = import.meta.env.VITE_HUB_BACKEND ?? '';

let _base = '';

export function setBackendBase(url: string): void {
  _base = url.replace(/\/$/, '');
}

/** Retorna a URL completa para um path de API (ex: '/api/store'). */
export function apiUrl(path: string): string {
  return `${_base}${path}`;
}

/**
 * True quando o app está rodando como APK via Capacitor.
 *
 * Pergunta ao próprio Capacitor em vez de deduzir pela presença de
 * `window.Capacitor`. O global NÃO serve como sinal: `@capacitor/core` executa
 * `win.Capacitor = createCapacitor(win)` no momento em que o módulo carrega,
 * em qualquer ambiente — e ele carrega no bundle web porque `JarvisChat`
 * importa câmera, localização e share target, e o painel do Jarvis é global no
 * `AppLayout`.
 *
 * O efeito de checar o global era grave e silencioso: `isCapacitorApp()`
 * respondia `true` no navegador, o `bootstrapStore` apontava o backend para o
 * Tailscale, e o `npm run dev` passava a ler e ESCREVER no hub.db de produção
 * do servidor dedicado — sem nenhum sinal na tela. Somava-se a isso o passo de
 * merge do bootstrap, que empurra para o servidor toda chave do localStorage
 * ausente no snapshot remoto.
 *
 * `isNativePlatform()` devolve true só em android/ios; no navegador o próprio
 * Capacitor já respondia `getPlatform() === 'web'`.
 */
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  // Fallback: APK sem server.url carrega de capacitor:// ou file://
  const proto = window.location.protocol;
  return proto === 'capacitor:' || proto === 'file:';
}
