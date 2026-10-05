/**
 * Faz o app pegar sozinho as versões novas depois de um deploy.
 *
 * O registro do service worker é injetado pelo vite-plugin-pwa e só chama
 * `register()` — não procura atualização nem recarrega nada. Junto com o
 * `self.skipWaiting()` de `src/sw.ts`, este módulo fecha o ciclo:
 *
 *   1. pergunta de tempos em tempos se há versão nova — sozinho o navegador só
 *      checa a cada ~24h, e o Hub fica aberto em modo app por dias seguidos;
 *   2. quando o worker novo assume o controle, recarrega a página uma vez. Isso
 *      é necessário porque o `cleanupOutdatedCaches()` apaga o precache antigo
 *      debaixo de uma página que ainda está rodando o JS velho.
 */

const UPDATE_CHECK_MS = 15 * 60_000;

export function setupServiceWorkerUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  // Sem controller ainda = primeira instalação. O clientsClaim() vai disparar um
  // controllerchange que não é atualização — recarregar aí seria um reload à toa
  // logo na primeira visita.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  void navigator.serviceWorker.ready.then((registration) => {
    const check = () => void registration.update().catch(() => undefined);
    setInterval(check, UPDATE_CHECK_MS);
    // Voltar pro app depois de um tempo fora é quando mais provavelmente há
    // deploy novo esperando.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  });
}
