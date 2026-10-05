import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHomeModules } from '../../core/module-registry/modules';
import { concursoService, type EditalAlert } from '../../core/concurso/concursoService';
import { Orb } from '../../core/jarvis/Orb';
import { useJarvisVoice } from '../../core/jarvis/JarvisVoiceContext';
import { getRankedItems } from '../../core/homepage/homepageRanker';
import type { HomepageItem } from '../../core/homepage/homepageTypes';
import { Card, Eyebrow, StatusDot, type Signal } from '../../shared/ui';

type DailyBriefing = { text: string; generatedAt: string };

function useDailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  useEffect(() => {
    fetch('/api/briefing/today')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DailyBriefing | null) => { if (data?.text) setBriefing(data); })
      .catch(() => {});
  }, []);
  return briefing;
}

function formatToday(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const BADGE_SIGNAL: Record<string, Signal> = {
  red: 'negative',
  yellow: 'warning',
  green: 'positive',
  blue: 'accent',
  muted: 'neutral',
};

function ZoneItem({ item, signal, last }: { item: HomepageItem; signal: Signal; last: boolean }) {
  const badgeSignal = BADGE_SIGNAL[item.badgeColor ?? 'muted'] ?? 'neutral';
  const inner = (
    <div
      className="flex items-start justify-between gap-3"
      style={{ padding: '11px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span style={{ marginTop: '5px' }}><StatusDot signal={signal} size={7} /></span>
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{item.title}</p>
          {item.subtitle && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--hub-muted)' }}>{item.subtitle}</p>
          )}
        </div>
      </div>
      {item.badge && (
        <span className="shrink-0 tabular-nums text-xs font-medium" style={{ color: `var(--hub-${badgeSignal === 'neutral' ? 'muted' : badgeSignal})` }}>
          {item.badge}
        </span>
      )}
    </div>
  );

  if (item.route) {
    return <Link to={item.route} className="block transition-opacity hover:opacity-75">{inner}</Link>;
  }
  return inner;
}

function ZoneCard({ label, signal, items }: { label: string; signal: Signal; items: HomepageItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <Eyebrow style={{ marginBottom: '4px' }}>{label}</Eyebrow>
      <div>
        {items.map((item, i) => (
          <ZoneItem key={item.id} item={item} signal={signal} last={i === items.length - 1} />
        ))}
      </div>
    </Card>
  );
}

/**
 * Orb central enquanto a conversa por voz está ativa — mesma máquina de estados
 * do modo tela cheia, só que sem sair da Home: o orb reage no lugar e os módulos
 * seguem visíveis em volta.
 *
 * Sem transcrição em texto aqui de propósito (diferente do modo tela cheia,
 * `VoiceOrb`): o container radial é pequeno e compartilhado com os ícones dos
 * módulos ao redor — texto de tamanho variável embaixo do orb colidia com o
 * módulo mais próximo daquele ângulo (ex.: RPG).
 *
 * Tocar o orb INTERROMPE a fala e volta a ouvir — não encerra a conversa. Até
 * a Fase 13 era o contrário, e por um motivo que deixou de existir: não havia
 * onde pôr um botão de encerrar sem colidir com os módulos, então o toque
 * precisava ser a única saída. Agora a pílula de conversa ativa aparece em
 * qualquer tela com um `×` dedicado, e o orb pode significar a mesma coisa
 * aqui e na tela cheia: mexe na FALA, não na conversa.
 */
function HomeVoiceOrb({ size, onInterrupt }: { size: number; onInterrupt: () => void }) {
  // Só LÊ o rótulo da sessão global — não é dona dela. Sair da Home some com
  // esta vista, e a conversa continua (ver JarvisVoiceContext).
  const { label } = useJarvisVoice();

  return (
    <>
      <button
        onClick={onInterrupt}
        aria-label={`Jarvis: ${label} — toque para interromper a fala`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
      >
        <Orb size={size} />
      </button>
      <p
        style={{
          position: 'absolute',
          top: 'calc(50% + ' + (size / 2 + 6) + 'px)',
          left: '50%',
          transform: 'translateX(-50%)',
          margin: 0,
          fontSize: '10px',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--hub-subtle)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </p>
    </>
  );
}

function RadialHub() {
  const modules = getHomeModules().filter((m) => m.status === 'active');
  const n = modules.length;
  const R = 40; // raio em % do container
  const ORB_SIZE = 190;
  // Estado da sessão global, não local: voltar para a Home no meio de uma
  // conversa reencontra o orb já ativo, em vez de parado como se nada
  // estivesse acontecendo.
  const { active: voiceActive, start, retry } = useJarvisVoice();

  return (
    <div className="mx-auto" style={{ position: 'relative', width: 'min(440px, 92vw)', aspectRatio: '1' }}>
      {/* Centro: o orb conversa aqui mesmo, sem abrir tela cheia nem trocar de rota. */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        {voiceActive ? (
          <HomeVoiceOrb size={ORB_SIZE} onInterrupt={retry} />
        ) : (
          <button
            onClick={start}
            aria-label="Falar com o Jarvis"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
          >
            <Orb size={ORB_SIZE} />
          </button>
        )}
      </div>

      {/* Módulos ao redor */}
      {modules.map((m, i) => {
        const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
        const x = 50 + R * Math.cos(angle);
        const y = 50 + R * Math.sin(angle);
        return (
          <Link
            key={m.id}
            to={m.basePath}
            className="transition-transform hover:scale-105"
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                width: '62px',
                height: '62px',
                borderRadius: '50%',
                background: 'var(--hub-card)',
                boxShadow: 'var(--hub-shadow-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--hub-primary-strong)',
              }}
            >
              {m.sigla}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--hub-muted)' }}>{m.shortName}</span>
          </Link>
        );
      })}
    </div>
  );
}

function EditalBanner({ alerts, onDismiss }: { alerts: EditalAlert[]; onDismiss: (a: EditalAlert) => void }) {
  const first = alerts[0];
  return (
    <Card style={{ borderLeft: '3px solid var(--hub-negative)' }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">🚨</span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-negative)' }}>
          Alerta CBMSC
        </span>
      </div>
      <p className="mt-2 text-base font-medium leading-snug" style={{ color: 'var(--hub-text)' }}>
        {first.title}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>
        Palavra-chave detectada:{' '}
        <span className="font-medium" style={{ color: 'var(--hub-negative)' }}>"{first.foundKeyword}"</span>
      </p>
      <div className="mt-3 flex items-baseline gap-4">
        <Link to="/concurso" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)' }}>
          Ver detalhes →
        </Link>
        <button
          onClick={() => onDismiss(first)}
          className="text-xs transition-opacity hover:opacity-60"
          style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Dispensar
        </button>
      </div>
      {alerts.length > 1 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          +{alerts.length - 1} alerta{alerts.length - 1 !== 1 ? 's' : ''} anterior{alerts.length - 1 !== 1 ? 'es' : ''}
        </p>
      )}
    </Card>
  );
}

export function HomePage() {
  const [editalAlerts, setEditalAlerts] = useState<EditalAlert[]>([]);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const briefing = useDailyBriefing();

  useEffect(() => {
    fetch('/edital-alerts.json')
      .then((r) => r.json())
      .then((data) => {
        concursoService.cacheEditalAlerts(data);
        setEditalAlerts(concursoService.getActiveEditalAlerts());
      })
      .catch(() => {});
  }, []);

  function dismissEdital(alert: EditalAlert) {
    concursoService.dismissEditalAlert(alert);
    setEditalAlerts(concursoService.getActiveEditalAlerts());
  }

  const { now, progress, next } = getRankedItems();

  return (
    <div className="space-y-8 py-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>Olá, Bernardo</h1>
          <p className="mt-1 text-sm first-letter:capitalize" style={{ color: 'var(--hub-muted)' }}>
            {formatToday()}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { to: '/concurso', emoji: '🚒', label: 'CBSC' },
            { to: '/abin', emoji: '🕵️', label: 'ABIN' },
          ].map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="shrink-0 text-center transition-opacity hover:opacity-70"
              style={{
                width: '58px',
                padding: '8px 0',
                borderRadius: '14px',
                background: 'var(--hub-card)',
                boxShadow: 'var(--hub-shadow-chip)',
              }}
            >
              <span className="block text-lg">{s.emoji}</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-muted)' }}>
                {s.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Briefing diário — compacto: o protagonista da Home é o orb, não o texto.
          Fica em 3 linhas e abre por toque, em vez de empurrar o hub pra baixo. */}
      {briefing && (
        <Card>
          <Eyebrow style={{ marginBottom: '6px' }}>Briefing do dia</Eyebrow>
          <p
            className="text-xs leading-snug"
            style={{
              color: 'var(--hub-text-body)',
              cursor: 'pointer',
              ...(briefingOpen ? {} : {
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }),
            }}
            onClick={() => setBriefingOpen((v) => !v)}
          >
            {briefing.text}
          </p>
        </Card>
      )}

      {/* Banner de edital CBMSC */}
      {editalAlerts.length > 0 && <EditalBanner alerts={editalAlerts} onDismiss={dismissEdital} />}

      {/* Visão geral — hub radial */}
      <section>
        <Eyebrow style={{ marginBottom: '8px' }}>Visão geral</Eyebrow>
        <RadialHub />
      </section>

      {/* Zonas dinâmicas */}
      <ZoneCard label="Agora" signal="negative" items={now} />
      <ZoneCard label="Progresso" signal="positive" items={progress} />
      <ZoneCard label="Próximo" signal="accent" items={next} />
    </div>
  );
}
