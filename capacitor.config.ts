import type { CapacitorConfig } from '@capacitor/cli';

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
 * Defina HUB_BACKEND com o endereço do seu PC na rede Tailscale se quiser
 * apontar o APK para o servidor local (backend SQLite).
 * Em modo standalone (sem backend), o app funciona com localStorage.
 */
/**
 * Endereço do servidor no tailnet, vindo de HUB_BACKEND. Sem ele o APK sai em modo
 * standalone (sem server.url) — avisamos para não ser uma troca silenciosa.
 */
function hubBackend(): string | undefined {
  const url = process.env.HUB_BACKEND?.trim();
  if (!url) {
    console.warn('[capacitor] HUB_BACKEND não definido: o APK não vai apontar para o servidor.');
    return undefined;
  }
  return url.replace(/\/$/, '');
}

const config: CapacitorConfig = {
  appId: 'com.bernardo.hubpessoal',
  appName: 'Hub Pessoal',
  webDir: 'dist',
  server: {
    // APK carrega o frontend direto do servidor via Tailscale.
    // Usa o nome MagicDNS do desktop (fixo) em vez do IP — não quebra se o IP mudar.
    //
    // HTTPS (via `tailscale serve`, porta 443) e não mais http://…:3001: sem
    // contexto seguro o WebView não expõe navigator.mediaDevices, então o modo
    // voz do Jarvis simplesmente não funciona no celular — mesmo motivo que
    // travava o microfone no notebook.
    //
    // O endereço fica fora do código: defina HUB_BACKEND (ex.: https://<maquina>.<tailnet>.ts.net)
    // no ambiente antes de rodar `npx cap sync` / `npm run build:apk`.
    url: hubBackend(),
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
