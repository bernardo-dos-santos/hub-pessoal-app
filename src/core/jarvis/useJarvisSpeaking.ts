import { useEffect, useState } from 'react';
import { jarvisService } from './jarvisService';

/** True enquanto o áudio da voz do Jarvis está tocando. Usado pelo orb 3D. */
export function useJarvisSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => jarvisService.onSpeakingChange(setSpeaking), []);
  return speaking;
}
