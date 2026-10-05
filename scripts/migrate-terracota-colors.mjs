// Substitui literais de cor do sistema antigo (flat/dark) pelos tokens do
// Terracota (--hub-*) em src/**/*.tsx. Só mapeia valores que batem EXATAMENTE
// com um papel semântico da tabela de tokens antiga — o que sobrar fica
// pra revisão manual (relatório no final), em vez de adivinhar.
//
// Uso: node scripts/migrate-terracota-colors.mjs [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');
const DRY_RUN = process.argv.includes('--dry');

// [regex, replacement, label] — regex deve ter flag 'g'.
const RULES = [
  [/#EEEEF2/g, 'var(--hub-text)', 'text primary'],
  [/#5FCCA8/g, 'var(--hub-positive)', 'positive/income'],
  [/#E86060/g, 'var(--hub-negative)', 'negative/expense'],
  [/#5B7CF6/g, 'var(--hub-accent)', 'accent/links'],
  [/#090B14/g, 'var(--hub-bg)', 'app background'],

  [/rgba\(238,238,242,0\.55\)/g, 'var(--hub-muted)', 'text secondary (0.55)'],
  [/rgba\(238,238,242,0\.(?:38|40|4|42|45)\)/g, 'var(--hub-subtle)', 'text muted/label (0.38-0.45)'],
  [/rgba\(238,238,242,0\.(?:15|20|22|25|28|30|3|32)\)/g, 'var(--hub-disabled)', 'text disabled/separator (0.15-0.32)'],
  [/rgba\(238,238,242,0\.(?:70|72|75|78)\)/g, 'var(--hub-text-body)', 'text body (0.70-0.78)'],

  [/rgba\(255,255,255,0\.055\)/g, 'var(--hub-border)', 'separator line'],
  [/rgba\(255,255,255,0\.045\)/g, 'var(--hub-border)', 'row divider'],

  [/rgba\(251,191,36,0\.(?:85|90|9)\)/g, 'var(--hub-warning)', 'warning/pending (0.85-0.90)'],

  // Rodada 2 — decididas por contexto real de uso,
  // não só pela faixa da tabela de tokens antiga.
  [/rgba\(238,238,242,0\.35\)/g, 'var(--hub-subtle)', 'texto muito apagado (empty states, notas) — 0.35'],
  [/rgba\(238,238,242,0\.(?:48|50)\)/g, 'var(--hub-muted)', 'texto secundário/label numérico — 0.48-0.50'],
  [/rgba\(238,238,242,0\.(?:60|6|65)\)/g, 'var(--hub-text-body)', 'texto de corpo secundário — 0.60-0.65'],
  [/rgba\(238,238,242,0\.(?:88|92)\)/g, 'var(--hub-text-strong)', 'texto de destaque/heading — 0.88-0.92'],
  [/rgba\(255,255,255,0\.0[5678]\)/g, 'var(--hub-border)', 'trilho/hairline fraco — 0.05-0.08'],
  [/rgba\(255,255,255,0\.(?:10|12|15|20)\)/g, 'var(--hub-border-strong)', 'borda visível (input/toggle/upload) — 0.10-0.20'],
  [/rgba\(251,191,36,0\.(?:40|60|70|72|75|78|80)\)/g, 'var(--hub-warning)', 'warning em intensidade menor — 0.40-0.80'],

  // Rodada 3 — variantes rgba(R,G,B,alpha) de accent/negative/positive que a
  // varredura original não pegou (só cobria os hex sólidos). Preserva a
  // opacidade via color-mix() em cima do token novo, em vez de fixar um RGB
  // solto — assim continuam obedecendo "token é a única fonte de cor".
  [/rgba\(91,\s*124,\s*246,\s*([\d.]+)\)/g,
    (_m, alpha) => `color-mix(in srgb, var(--hub-accent) ${Math.round(parseFloat(alpha) * 100)}%, transparent)`,
    'accent translúcido (rgba→color-mix)'],
  [/rgba\(232,\s*96,\s*96,\s*([\d.]+)\)/g,
    (_m, alpha) => `color-mix(in srgb, var(--hub-negative) ${Math.round(parseFloat(alpha) * 100)}%, transparent)`,
    'negative translúcido (rgba→color-mix)'],
  [/rgba\(95,\s*204,\s*168,\s*([\d.]+)\)/g,
    (_m, alpha) => `color-mix(in srgb, var(--hub-positive) ${Math.round(parseFloat(alpha) * 100)}%, transparent)`,
    'positive translúcido (rgba→color-mix)'],
];

// Padrões de cor antiga pra detectar o que SOBROU depois do passe (pra revisão manual).
const LEFTOVER_PATTERNS = [
  /#EEEEF2/g,
  /#5FCCA8/g,
  /#E86060/g,
  /#5B7CF6/g,
  /#090B14/g,
  /rgba\(238,\s*238,\s*242,\s*[\d.]+\)/g,
  /rgba\(255,\s*255,\s*255,\s*[\d.]+\)/g,
  /rgba\(251,\s*191,\s*36,\s*[\d.]+\)/g,
  /rgba\(91,\s*124,\s*246,\s*[\d.]+\)/g,
  /rgba\(232,\s*96,\s*96,\s*[\d.]+\)/g,
  /rgba\(95,\s*204,\s*168,\s*[\d.]+\)/g,
];

const files = globSync('**/*.tsx', { cwd: SRC_DIR }).map((f) => path.join(SRC_DIR, f));

let filesChanged = 0;
const ruleCounts = new Map(RULES.map((r) => [r[2], 0]));
const leftovers = new Map(); // value -> count

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let content = original;

  for (const [regex, replacement, label] of RULES) {
    const matches = content.match(regex);
    if (matches) {
      ruleCounts.set(label, ruleCounts.get(label) + matches.length);
      content = content.replace(regex, replacement);
    }
  }

  if (content !== original) {
    filesChanged++;
    if (!DRY_RUN) writeFileSync(file, content, 'utf8');
  }

  for (const pattern of LEFTOVER_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const m of matches) leftovers.set(m, (leftovers.get(m) ?? 0) + 1);
    }
  }
}

console.log(`${DRY_RUN ? '[dry-run] ' : ''}Arquivos alterados: ${filesChanged}/${files.length}`);
console.log('\nSubstituições aplicadas:');
for (const [label, count] of ruleCounts) {
  if (count > 0) console.log(`  ${String(count).padStart(5)}  ${label}`);
}

if (leftovers.size > 0) {
  const sorted = [...leftovers.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0);
  console.log(`\nSobrou pra revisão manual — ${total} ocorrências, sem papel semântico exato documentado:`);
  for (const [value, count] of sorted) {
    console.log(`  ${String(count).padStart(5)}  ${value}`);
  }
} else {
  console.log('\nNenhuma cor antiga sobrou fora do mapeamento.');
}
