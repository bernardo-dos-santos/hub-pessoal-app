/**
 * JarvisVoiceContext — a conversa por voz vive AQUI, não na tela.
 *
 * O provider fica no AppLayout, que não desmonta em troca de rota. Antes, o
 * dono da sessão era o orb da Home: ir para o Financeiro desmontava o
 * componente, o cleanup do hook rodava e a conversa morria no meio da frase.
 * Agora cada tela é só uma VISTA da mesma sessão — o orb da Home, a tela cheia
 * e a pílula de "conversa ativa" mostram o mesmo estado, e nenhuma delas
 * encerra nada ao sumir.
 *
 * Uma única instância de `useVoiceSession` no app inteiro, de propósito: duas
 * seriam dois reconhecimentos disputando o mesmo microfone.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useVoiceSession, type VoiceState } from './useVoiceSession';

type JarvisVoice = {
  /** Conversa em andamento — sobrevive a trocar de tela. */
  active: boolean;
  state: VoiceState;
  transcript: string;
  label: string;
  start: () => void;
  stop: () => void;
  /** Tenta de novo depois de um estado sem saída (timeout, permissão negada). */
  retry: () => void;
};

const JarvisVoiceContext = createContext<JarvisVoice | null>(null);

export function JarvisVoiceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const session = useVoiceSession(active);

  const value = useMemo<JarvisVoice>(() => ({
    active,
    state: session.state,
    transcript: session.transcript,
    label: session.label,
    retry: session.retry,
    start: () => setActive(true),
    stop: () => setActive(false),
  }), [active, session.state, session.transcript, session.label, session.retry]);

  return <JarvisVoiceContext.Provider value={value}>{children}</JarvisVoiceContext.Provider>;
}

export function useJarvisVoice(): JarvisVoice {
  const ctx = useContext(JarvisVoiceContext);
  if (!ctx) throw new Error('useJarvisVoice precisa estar dentro de <JarvisVoiceProvider>.');
  return ctx;
}
