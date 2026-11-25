/**
 * The voice's loudness per frequency band, 0–1 each — what drives the Íris's
 * arcs (IrisMark). One bus for both directions: the assistant's own speech (analysed in
 * jarvisService while the TTS plays) and the user's voice while listening
 * (micLevels.ts in the browser, a pulse per recognized word on the APK).
 *
 *   low  (~80–300 Hz)    — the body of the voice → outer arc
 *   mid  (~300–2000 Hz)  — where speech lives   → middle arc
 *   high (~2–6 kHz)      — s, t, ch             → inner arc
 *
 * IrisMark decays the last value it received, so a source may emit every frame
 * (an analyser) or only now and then (a pulse) — both look right.
 */
export type VoiceLevels = { low: number; mid: number; high: number };

const listeners = new Set<(levels: VoiceLevels) => void>();

export function emitVoiceLevels(levels: VoiceLevels): void {
  listeners.forEach((cb) => cb(levels));
}

export function onVoiceLevels(cb: (levels: VoiceLevels) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const SILENT: VoiceLevels = { low: 0, mid: 0, high: 0 };

/** Average energy (0–1) of each band in a byte spectrum from an AnalyserNode. */
export function spectrumToLevels(data: Uint8Array, sampleRate: number, fftSize: number): VoiceLevels {
  const hz = sampleRate / fftSize;
  const band = (from: number, to: number) => {
    const a = Math.max(1, Math.round(from / hz));
    const b = Math.min(data.length, Math.max(a + 1, Math.round(to / hz)));
    let sum = 0;
    for (let i = a; i < b; i++) sum += data[i];
    return sum / ((b - a) * 255);
  };
  // Gains bring each band to a similar range: speech carries far less energy
  // in the highs than in the lows, so without them the gyroscope never moves.
  return {
    low: Math.min(1, band(80, 300) * 1.3),
    mid: Math.min(1, band(300, 2000) * 1.8),
    high: Math.min(1, band(2000, 6000) * 3),
  };
}
