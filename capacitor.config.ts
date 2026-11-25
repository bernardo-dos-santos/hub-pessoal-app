import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Endereço público do app, vindo de HUB_PUBLIC_URL. Sem ele o APK sai em modo
 * standalone (sem server.url) — avisamos para não ser uma troca silenciosa.
 */
function hubPublicUrl(): string | undefined {
  const url = process.env.HUB_PUBLIC_URL?.trim();
  if (!url) {
    console.warn('[capacitor] HUB_PUBLIC_URL não definido: o APK não vai apontar para o servidor.');
    return undefined;
  }
  return url.replace(/\/$/, '');
}

/**
 * Configuração do Capacitor para geração do APK.
 *
 * Para usar:
 *   1. npm install @capacitor/core @capacitor/cli @capacitor/android
 *   2. npx cap init
 *   3. npx cap add android
 *   4. npm run build:apk
 *
 * O APK gerado fica em android/app/build/outputs/apk/debug/app-debug.apk
 * Instale via USB: adb install app-debug.apk
 *
 * ATENÇÃO ao build: o Capacitor exige Java 21+, mas o `java` do PATH nesta
 * máquina é o 17 (Temurin) e o gradle falha com "invalid source release: 21".
 * Use o JDK que vem com o Android Studio:
 *   JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" npm run build:apk
 *
 * Ajuste server.url para o IP do seu PC na rede Tailscale se quiser
 * apontar o APK para o servidor local (backend SQLite).
 * Em modo standalone (sem backend), o app funciona com localStorage.
 */
const config: CapacitorConfig = {
  appId: 'com.bernardo.hubpessoal',
  appName: 'Olimpo',
  webDir: 'dist',
  server: {
    // APK carrega o frontend direto do servidor, pelo endereço público (F4:
    // Cloudflare Tunnel + certificado do aparelho, ClientCertificates.java) —
    // o mesmo para todo mundo, inclusive quem não está no Tailscale. Quem está
    // tem a API pelo Tailscale (chooseBackendBase em backendConfig.ts).
    // Até 2026-10 era o MagicDNS do Tailscale, e o app só abria no tailnet.
    //
    // HTTPS sempre: sem contexto seguro o WebView não expõe
    // navigator.mediaDevices, e o modo voz não funciona no celular.
    // O endereço fica fora do código: defina HUB_PUBLIC_URL (ex.: https://app.seudominio.com)
    // no ambiente antes de rodar `npx cap sync` / `npm run apk:release`.
    url: hubPublicUrl(),
  },
  android: {
    // false: mantém a InputConnection padrão do WebView, preservando o
    // corretor ortográfico nativo do teclado (Gboard etc.) nos campos de
    // texto do app. `true` (config anterior) simplifica a captura de teclas
    // mas quebra a integração do teclado com autocorreção — era boilerplate
    // do setup inicial, não um fix intencional de bug.
    captureInput: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    // CapacitorHttp: redireciona window.fetch() para HTTP nativo do Android
    // (OkHttp), bypassando as restrições de CORS do WebView.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
