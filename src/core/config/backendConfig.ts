import { Capacitor } from '@capacitor/core';

/**
 * URL base do backend.
 * - Web/PC: '' (usa URLs relativas, proxy do Vite faz o roteamento)
 * - APK (Capacitor): the page itself comes from the public address
 *   (capacitor.config.ts, Cloudflare + device certificate), and the API goes
 *   through Tailscale whenever this phone is on the tailnet — see
 *   chooseBackendBase().
 *
 * Usa o nome MagicDNS (não o IP) para não quebrar se o Tailscale reatribuir o IP.
 */
// HTTPS via `tailscale serve` (porta 443), não http://…:3001 — contexto seguro é
// o que libera microfone/notificação no WebView do APK.
// O endereço vem do .env (VITE_HUB_BACKEND) e não do código-fonte: é o nome da
// máquina do servidor dentro do tailnet e não precisa estar no repositório.
export const TAILSCALE_BACKEND: string = import.meta.env.VITE_HUB_BACKEND ?? '';

/** How long the APK waits for the tailnet before settling on the public address. */
const TAILNET_PROBE_MS = 1500;

let _base = '';

export function setBackendBase(url: string): void {
  _base = url.replace(/\/$/, '');
}

export type BackendRoute = 'tailscale' | 'public' | 'same-origin';

/**
 * Picks where the API calls go, and sets it. In the browser: the page's own
 * server. In the APK: Tailscale when it answers — the only way to the admin
 * panel, the agent and approving its commands (PRIVATE_ONLY_PREFIXES on the
 * server) — otherwise the public address the page came from. Friends' phones
 * aren't on the tailnet, so for them it's always the public one; the MagicDNS
 * name doesn't even resolve there, so the probe fails fast.
 */
export async function chooseBackendBase(): Promise<BackendRoute> {
  if (!isCapacitorApp()) {
    setBackendBase('');
    return 'same-origin';
  }
  // The body, not just the status: in the APK, fetch() goes through Capacitor's
  // native bridge, and when the tailnet is unreachable the bridge request falls
  // through to the public server — which answered with the app's index.html and
  // a 200. A real answer is the health JSON.
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TAILNET_PROBE_MS));
  const probe = fetch(`${TAILSCALE_BACKEND}/api/health`, { cache: 'no-store' })
    .then(async (res) => res.ok && (await res.json()).ok === true)
    .catch(() => false);
  const onTailnet = await Promise.race([probe, timeout]);
  // The public address absolute, not '': native code (the APK download in
  // AppUpdatePlugin) receives these URLs and can't resolve a relative one.
  setBackendBase(onTailnet ? TAILSCALE_BACKEND : window.location.origin);
  _route = onTailnet ? 'tailscale' : 'public';
  return _route;
}

let _route: BackendRoute = 'same-origin';

/** The route the last chooseBackendBase() settled on (Configurações shows it). */
export function backendRoute(): BackendRoute {
  return _route;
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
