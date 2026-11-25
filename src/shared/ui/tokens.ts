/**
 * Espelho em TS dos tokens de cor do design system Editorial (definidos em
 * global.css). Use estas constantes quando a cor for decidida em JS (ex.: regra
 * positivo/negativo de um valor). Em JSX estático, prefira `var(--hub-*)`.
 */
export const hub = {
  bg: 'var(--hub-bg)',
  card: 'var(--hub-card)',
  text: 'var(--hub-text)',
  textBody: 'var(--hub-text-body)',
  muted: 'var(--hub-muted)',
  subtle: 'var(--hub-subtle)',
  label: 'var(--hub-label)',
  disabled: 'var(--hub-disabled)',
  primary: 'var(--hub-primary)',
  primaryStrong: 'var(--hub-primary-strong)',
  accent: 'var(--hub-accent)',
  positive: 'var(--hub-positive)',
  negative: 'var(--hub-negative)',
  warning: 'var(--hub-warning)',
  mauve: 'var(--hub-mauve)',
  progress: 'var(--hub-progress)',
  neutral: 'var(--hub-neutral)',
  border: 'var(--hub-border)',
  borderStrong: 'var(--hub-border-strong)',
  onAccent: 'var(--hub-on-accent)',
  track: 'var(--hub-track)',
} as const;

/**
 * Versão translúcida de um token (`tint(hub.accent, 12)` = 12% da cor).
 * Fundo de item selecionado, faixa do dia atual, categoria no calendário:
 * em vez de um token por opacidade, a mesma cor do sistema em outra dose.
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export type Signal = 'positive' | 'negative' | 'warning' | 'accent' | 'mauve' | 'neutral';

/** Cor de sinal semântica → token. */
export function signalColor(signal: Signal): string {
  switch (signal) {
    case 'positive': return hub.positive;
    case 'negative': return hub.negative;
    case 'warning':  return hub.warning;
    case 'accent':   return hub.accent;
    case 'mauve':    return hub.mauve;
    case 'neutral':  return hub.progress;
  }
}

/** Cor de um valor monetário/numérico pela regra positivo/negativo. */
export function amountColor(value: number): string {
  if (value > 0) return hub.positive;
  if (value < 0) return hub.negative;
  return hub.muted;
}
