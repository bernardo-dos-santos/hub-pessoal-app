import { useEffect } from 'react';
import { Orb } from './Orb';
import { useJarvisVoice } from './JarvisVoiceContext';

interface VoiceOrbProps {
  /** Some com a tela cheia e MANTÉM a conversa (vira a pílula). */
  onCollapse: () => void;
  /** Encerra a conversa de fato. */
  onStop: () => void;
}

/**
 * Modo voz em tela cheia — uma VISTA da sessão, não a dona dela.
 *
 * A distinção é o conserto do comportamento que mais incomodava: antes este
 * componente chamava `useVoiceSession` direto, então fechar a tela desmontava o
 * hook e matava a conversa. Agora fechar só recolhe; a fala continua e reaparece
 * na pílula, sobrevivendo inclusive à troca de página.
 *
 * Por isso são duas saídas distintas: `×` recolhe, "encerrar" termina. Um botão
 * só voltaria à ambiguidade de antes.
 */
export function VoiceOrb({ onCollapse, onStop }: VoiceOrbProps) {
  const { state, transcript, retry, label } = useJarvisVoice();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCollapse(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCollapse]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(247,241,230,0.95)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
      onClick={onCollapse}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); retry(); }}
      >
        <Orb size={200} />

        <div style={{ textAlign: 'center', maxWidth: '280px' }}>
          <p style={{
            margin: 0,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--hub-primary)',
          }}>
            JARVIS
          </p>
          <p style={{
            margin: '6px 0 0',
            fontSize: '10px',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--hub-subtle)',
          }}>
            {label}
          </p>
          {transcript && (state === 'listening' || state === 'thinking') && (
            <p style={{ margin: '16px 0 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--hub-text-body)' }}>
              {transcript}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onStop(); }}
        style={{
          position: 'absolute',
          bottom: '48px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          padding: '8px',
          color: 'var(--hub-negative)',
        }}
        className="hover:opacity-70"
      >
        Encerrar conversa
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onCollapse(); }}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '22px',
          lineHeight: 1,
          padding: '4px',
          color: 'var(--hub-subtle)',
          transition: 'color 0.2s',
        }}
        className="hover:opacity-70"
        aria-label="Recolher (a conversa continua)"
      >
        ×
      </button>
    </div>
  );
}
