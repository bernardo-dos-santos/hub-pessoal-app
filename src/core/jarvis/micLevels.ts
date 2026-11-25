import { emitVoiceLevels, SILENT, spectrumToLevels } from './voiceLevels';

/**
 * Reads the microphone while the voice mode listens, so the Íris's arcs follow
 * the user's voice. Browser only: on the APK the speech recognizer is Google's
 * own service holding the microphone, and a second capture next to it risks
 * breaking recognition — there useVoiceSession pulses per recognized word
 * instead.
 *
 * Best effort: no permission, no Web Audio — the Íris just stays calm. The
 * stream never reaches the speakers (no feedback), only the analyser.
 * Returns the function that releases the microphone.
 */
export async function startMicLevels(): Promise<() => void> {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) return () => {};
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return () => {};
  }
  const ctx = new Ctor();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  let raf = 0;
  const loop = () => {
    analyser.getByteFrequencyData(data);
    emitVoiceLevels(spectrumToLevels(data, ctx.sampleRate, analyser.fftSize));
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((track) => track.stop());
    void ctx.close();
    emitVoiceLevels(SILENT);
  };
}
