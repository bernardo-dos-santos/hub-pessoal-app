import { useEffect, useRef } from 'react';
import type { VoiceState } from './useVoiceSession';
import { onVoiceLevels, SILENT, type VoiceLevels } from './voiceLevels';

/**
 * What the Íris is doing. `intro` and `done` play once and then settle into
 * `settle` (rest by default); the rest loop for as long as they're set.
 */
export type IrisMode = 'still' | 'intro' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'done' | 'error';

/** Maps the voice session's state to a mode (anything unknown is rest). */
export function irisModeFor(state: VoiceState | undefined): IrisMode {
  switch (state) {
    case 'listening':
    case 'thinking':
    case 'speaking':
      return state;
    case 'error':
    case 'timeout':
    case 'denied':
    case 'unsupported':
      return 'error';
    default:
      return 'idle';
  }
}

type IrisMarkProps = {
  /** Width in px; the height follows the drawing's aspect. */
  size?: number;
  mode?: IrisMode;
  /** Where a one-shot mode (`intro`, `done`) ends up. */
  settle?: IrisMode;
  className?: string;
  /** Accessible name; without one the mark is decorative. */
  label?: string;
};

// The drawing: three upper half-arcs over one baseline. In the 200-wide box the
// ripples of `speaking` reach r≈96, so there's room above the outer arc.
const VIEW_W = 200;
const VIEW_H = 112;
const CX = 100;
const BASE_Y = 104;
const RADII = [70, 48, 26] as const; // outer, middle, inner
const REST_ALPHA = [1, 0.62, 0.36];

// How long a voice level lingers after the last value arrived: analysers emit
// every frame, the APK's per-word pulses don't (voiceLevels.ts).
const LEVEL_DECAY_MS = 180;

const arcPath = (r: number) => `M${CX - r} ${BASE_Y} A${r} ${r} 0 0 1 ${CX + r} ${BASE_Y}`;
const arcLength = (r: number) => Math.PI * r;
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
/** On-screen px → viewBox units at a given rendered width. */
const toUnits = (px: number, size: number) => (px * VIEW_W) / size;

/**
 * The Íris — three thin arcs, after the rainbow she is in the myth (the
 * messenger of Olympus). Replaced the owl's gaze in WebGL (2026-11-04) along
 * with the Terracota palette: same rules Bernardo set for her then — thin
 * line, open shape, no eyes, nothing that stares or blinks — at a fraction of
 * the cost on a phone, and small enough to be the chat button and the loader.
 *
 * Each mode is a behaviour, not a picture:
 *   still      no motion — the app's logo
 *   intro      the arcs draw themselves, inside out (app opening, loader)
 *   idle       slow breathing, inside out
 *   listening  each arc follows a band of the voice: outer = lows, middle =
 *              mids, inner = highs (the same bus the owl used, voiceLevels.ts)
 *   thinking   a short stroke travels along each arc
 *   speaking   ripples leave the outer arc with the voice's loudness
 *   done       the arcs close together once and settle
 *   error      the outer arc falters and turns amber — no red alarm
 *
 * The loop writes SVG attributes through refs; React only re-renders when the
 * mode changes. With "reduce motion" on, every mode is a still frame.
 */
export function IrisMark({ size = 180, mode = 'idle', settle = 'idle', className = '', label }: IrisMarkProps) {
  const arcRefs = useRef<(SVGPathElement | null)[]>([]);
  const rippleRefs = useRef<(SVGPathElement | null)[]>([]);
  const modeRef = useRef({ mode, settle, since: 0 });

  useEffect(() => {
    modeRef.current = { mode, settle, since: performance.now() };
  }, [mode, settle]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let levels: VoiceLevels = SILENT;
    let levelsAt = 0;
    const unsubscribe = onVoiceLevels((next) => {
      levels = next;
      levelsAt = performance.now();
    });
    const smooth = [0, 0, 0];
    let amp = 0;
    let frame = 0;

    const draw = (now: number) => {
      const arcs = arcRefs.current;
      const ripples = rippleRefs.current;
      let { mode: current } = modeRef.current;
      const { settle: rest, since } = modeRef.current;
      let t = (now - since) / 1000;

      // One-shot modes hand over to `settle` once they've played. The clock keeps
      // running from the hand-over: resetting it to 0 here (as it once did) ran on
      // every frame and froze the settle mode on its first frame — the boot loader
      // drew itself and then stood still instead of "thinking".
      const oneShot = current === 'intro' ? 1.3 : current === 'done' ? 1.4 : null;
      if (oneShot !== null && t > oneShot) {
        current = rest;
        t -= oneShot;
      }

      ripples.forEach((p) => p?.setAttribute('d', ''));
      arcs.forEach((p, i) => {
        if (!p) return;
        p.style.stroke = 'var(--hub-accent)';
        p.removeAttribute('transform');
        p.removeAttribute('stroke-dasharray');
        p.removeAttribute('stroke-dashoffset');
        p.setAttribute('opacity', String(REST_ALPHA[i]));
        p.setAttribute('stroke-width', String(strokeWidth));
      });

      const age = now - levelsAt;
      const fade = Math.max(0, 1 - age / LEVEL_DECAY_MS);
      const bands = [levels.low * fade, levels.mid * fade, levels.high * fade];

      if (reduceMotion) {
        if (current === 'error') arcs[0]?.style.setProperty('stroke', 'var(--hub-warning)');
        if (current === 'listening' || current === 'speaking') arcs.forEach((p) => p?.setAttribute('opacity', '1'));
        frame = requestAnimationFrame(draw);
        return;
      }

      switch (current) {
        case 'still':
          break;
        case 'intro':
        case 'done': {
          // intro draws inside out; done closes outside in, with a small pulse.
          const order = current === 'intro' ? [2, 1, 0] : [0, 1, 2];
          order.forEach((i, k) => {
            const p = arcs[i];
            if (!p) return;
            const len = arcLength(RADII[i]);
            const progress = easeOut((t - k * 0.18) / 0.7);
            p.setAttribute('stroke-dasharray', String(len));
            p.setAttribute('stroke-dashoffset', String(len * (1 - progress)));
            if (current === 'done') {
              const pulse = Math.max(0, 1 - Math.abs(t - 0.95) * 4);
              p.setAttribute('stroke-width', String(strokeWidth * (1 + pulse * 0.7)));
            }
          });
          break;
        }
        case 'idle':
          arcs.forEach((p, i) => p?.setAttribute('opacity', String(0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.4 - (2 - i) * 0.9)))));
          break;
        case 'listening':
          arcs.forEach((p, i) => {
            if (!p) return;
            smooth[i] += (bands[i] - smooth[i]) * 0.25;
            const scale = 1 + 0.07 * smooth[i];
            p.setAttribute('transform', `translate(${CX} ${BASE_Y}) scale(${scale}) translate(${-CX} ${-BASE_Y})`);
            p.setAttribute('opacity', String(0.45 + 0.55 * smooth[i]));
            p.setAttribute('stroke-width', String(strokeWidth * (0.85 + 0.8 * smooth[i])));
          });
          break;
        case 'thinking':
          arcs.forEach((p, i) => {
            if (!p) return;
            const len = arcLength(RADII[i]);
            const segment = len * 0.28;
            const phase = (t * 0.55 + i * 0.22) % 1;
            p.setAttribute('stroke-dasharray', `${segment} ${len}`);
            p.setAttribute('stroke-dashoffset', String(segment - phase * (len + segment)));
            p.setAttribute('opacity', '1');
          });
          break;
        case 'speaking': {
          amp += (Math.max(bands[0], bands[1]) - amp) * 0.2;
          arcs.forEach((p) => p?.setAttribute('opacity', String(0.6 + 0.4 * amp)));
          ripples.forEach((p, k) => {
            if (!p) return;
            const phase = (t * 0.8 + k / 3) % 1;
            p.setAttribute('d', arcPath(RADII[0] + phase * 26));
            p.setAttribute('stroke-width', String(strokeWidth * (1 - phase) * 0.8 + 0.3));
            p.setAttribute('opacity', String((1 - phase) * 0.55 * Math.max(amp, 0.15)));
          });
          break;
        }
        case 'error': {
          const shake = t < 0.6 ? Math.sin(t * 40) * 4 * (1 - t / 0.6) : 0;
          arcs[0]?.setAttribute('transform', `translate(${shake} 0)`);
          arcs[0]?.style.setProperty('stroke', 'var(--hub-warning)');
          arcs[1]?.setAttribute('opacity', '0.5');
          arcs[2]?.setAttribute('opacity', '0.3');
          break;
        }
      }
      frame = requestAnimationFrame(draw);
    };

    // Stroke widths are in viewBox units, converted from the px we want on
    // screen (non-scaling-stroke would also put the dashes in screen units and
    // break the dash math). Small marks get a relatively thicker line.
    const strokeWidth = toUnits(size >= 120 ? 2 : size >= 48 ? 1.8 : 1.6, size);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [size]);

  const height = Math.round((size * VIEW_H) / VIEW_W);

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      style={{ overflow: 'visible', display: 'block' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      strokeLinecap="round"
    >
      {/* The faint full arcs behind keep the shape readable while a mode draws only part of it. */}
      {RADII.map((r) => (
        <path key={`g${r}`} d={arcPath(r)} style={{ stroke: 'var(--hub-accent)' }} strokeWidth={toUnits(1.2, size)} opacity={0.12} />
      ))}
      {[0, 1, 2].map((k) => (
        <path key={`r${k}`} ref={(el) => { rippleRefs.current[k] = el; }} style={{ stroke: 'var(--hub-accent)' }} />
      ))}
      {RADII.map((r, i) => (
        <path key={r} ref={(el) => { arcRefs.current[i] = el; }} d={arcPath(r)} style={{ stroke: 'var(--hub-accent)' }} />
      ))}
    </svg>
  );
}
