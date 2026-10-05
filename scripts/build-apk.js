/**
 * build-apk.js — roda o Gradle para gerar o APK de debug.
 *
 * Existe porque a linha antiga do package.json (`cd android && gradlew.bat
 * assembleDebug`) tinha duas falhas:
 *
 *   1. Só funcionava em cmd/PowerShell. Num shell bash (Git Bash, WSL, agente
 *      automatizado), `gradlew.bat` sem `./` não resolve — e o pior é que o
 *      comando terminava com código 0 mesmo sem ter gerado APK nenhum. Build
 *      que falha em silêncio é pior do que build que quebra.
 *   2. Não dizia nada sobre o JDK. O Capacitor 8 exige Java 21, e uma máquina
 *      com Java 17 no PATH morre em "invalid source release: 21" compilando o
 *      próprio capacitor-android — erro que não aponta para a causa.
 *
 * Uso: node scripts/build-apk.js [--release]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = resolve(__dirname, '../android');

const MIN_JAVA = 21;

/** JDKs que o Android Studio instala junto — o caminho mais provável de ter 21+. */
const JDK_CANDIDATES = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  `${process.env.LOCALAPPDATA ?? ''}\\Programs\\Android Studio\\jbr`,
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/opt/android-studio/jbr',
].filter(Boolean);

/**
 * Versão maior de um JDK, pelo arquivo `release` que toda distribuição traz.
 * Mais barato e mais confiável que interpretar a saída de `java -version`, que
 * muda de formato entre distribuições.
 */
function javaMajor(jdkHome) {
  const releaseFile = resolve(jdkHome, 'release');
  if (!existsSync(releaseFile)) return null;
  const match = readFileSync(releaseFile, 'utf-8').match(/JAVA_VERSION="(\d+)/);
  return match ? Number(match[1]) : null;
}

function findJdk() {
  for (const candidate of JDK_CANDIDATES) {
    if (!existsSync(candidate)) continue;
    const major = javaMajor(candidate);
    if (major !== null && major >= MIN_JAVA) return { home: candidate, major };
  }
  return null;
}

const jdk = findJdk();
if (!jdk) {
  console.error(`\n[build-apk] Nenhum JDK ${MIN_JAVA}+ encontrado — o Capacitor 8 exige essa versão.`);
  console.error('[build-apk] Procurei em JAVA_HOME e nas instalações padrão do Android Studio.');
  console.error(`[build-apk] Instale o JDK ${MIN_JAVA} (ou o Android Studio) e/ou aponte JAVA_HOME para ele.\n`);
  process.exit(1);
}

if (jdk.home !== process.env.JAVA_HOME) {
  console.log(`[build-apk] Usando JDK ${jdk.major} de ${jdk.home}`);
}

const task = process.argv.includes('--release') ? 'assembleRelease' : 'assembleDebug';
const isWindows = process.platform === 'win32';

// Caminho ABSOLUTO e entre aspas, não `gradlew.bat` solto: o cmd só procura no
// diretório atual quando NoDefaultCurrentDirectoryInExePath não está ligado, e
// nesta máquina está — foi o que fez a versão anterior deste script não achar o
// wrapper mesmo com o cwd certo. As aspas cobrem caminho com espaço.
const wrapper = resolve(ANDROID_DIR, isWindows ? 'gradlew.bat' : 'gradlew');

const options = {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: jdk.home },
};

// No Windows o comando vai como UMA string (com `shell`), porque .bat é script
// do cmd e não executável. Passar `args` junto de `shell: true` funciona, mas o
// Node 24 deprecou (DEP0190) — os argumentos são concatenados sem escapar.
// Fora do Windows, args separados e sem shell: nada a escapar.
const result = isWindows
  ? spawnSync(`"${wrapper}" ${task} --console=plain`, { ...options, shell: true })
  : spawnSync(wrapper, [task, '--console=plain'], options);

if (result.error) {
  console.error(`\n[build-apk] Não consegui rodar o Gradle: ${result.error.message}\n`);
  process.exit(1);
}

// Propagar o código do Gradle é o ponto principal deste arquivo: sem isso, um
// build quebrado passa por bem-sucedido em qualquer automação que olhe o exit.
if (result.status !== 0) process.exit(result.status ?? 1);

const apk = resolve(
  ANDROID_DIR,
  'app/build/outputs/apk',
  task === 'assembleRelease' ? 'release/app-release.apk' : 'debug/app-debug.apk',
);
console.log(`\n[build-apk] APK gerado: ${apk}\n`);
