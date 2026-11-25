import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession, useSession } from '../../core/session/session';
import { IrisMark, irisModeFor } from '../../core/jarvis/IrisMark';
import { useJarvisVoice } from '../../core/jarvis/JarvisVoiceContext';
import { getRankedItems } from '../../core/homepage/homepageRanker';
import { useHubAlerts } from '../../core/alerts/useHubAlerts';
import { SEVERITY_SIGNAL } from '../../core/alerts/ModuleAttentionCard';
import { apiUrl } from '../../core/config/backendConfig';
import type { HomepageItem } from '../../core/homepage/homepageTypes';
import { AlertRow, Card, Eyebrow, StatusDot, type Signal } from '../../shared/ui';

type DailyBriefing = { text: string; generatedAt: string };

function useDailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  useEffect(() => {
    if (!getSession().isOwner) return;
    fetch(apiUrl('/api/briefing/today'))
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

const MAX_ALERTS = 5;

/**
 * Alertas que os módulos registram em `alertRegistry`. Até aqui eles eram
 * calculados por cada provider e não apareciam em tela nenhuma: a Home só
 * desenhava as zonas do ranker, e o registro não tinha leitor.
 */
function AlertsCard({ className }: { className?: string }) {
  const alerts = useHubAlerts();
  if (alerts.length === 0) return null;
  const shown = alerts.slice(0, MAX_ALERTS);
  return (
    <Card className={className}>
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-warning)', marginBottom: '2px' }}>
        Precisa de você
      </p>
      <div>
        {shown.map((alert, i) => (
          <AlertRow
            key={alert.id}
            title={alert.title}
            subtitle={alert.description}
            signal={SEVERITY_SIGNAL[alert.severity]}
            action={alert.actionLabel ?? 'Ver'}
            to={alert.actionRoute}
            last={i === shown.length - 1}
          />
        ))}
      </div>
      {alerts.length > MAX_ALERTS && (
        <p className="mt-2 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
          +{alerts.length - MAX_ALERTS} {alerts.length - MAX_ALERTS === 1 ? 'outro' : 'outros'}
        </p>
      )}
    </Card>
  );
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
 * Width of the Íris on the Home: up to 180px, inside the hero card. The owl took ~380px and pushed
 * "what to do now" below the fold on a phone; the arcs read fine smaller.
 */
function useIrisWidth(): number {
  const compute = () => Math.min(180, window.innerWidth - 48);
  const [width, setWidth] = useState(compute);
  useEffect(() => {
    const onResize = () => setWidth(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * The Íris is the Home's centerpiece and talks right here, without opening the
 * full-screen voice mode or changing route.
 *
 * Tapping her starts a conversation; during one, a tap INTERRUPTS the speech and
 * goes back to listening — same meaning as everywhere else in the app (it acts
 * on the SPEECH; the conversation pill's × ends the CONVERSATION). The session
 * is the global one (JarvisVoiceContext): coming back to the Home mid-chat finds
 * her already active.
 */
function IrisHero() {
  const width = useIrisWidth();
  const { active, state, label, start, retry } = useJarvisVoice();
  // The voice is the owner's assistant (OWNER_ONLY_PREFIXES); for anyone else she's just the centerpiece.
  const { isOwner } = useSession();

  if (!isOwner) return <IrisMark size={width} className="mx-auto" />;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={active ? retry : start}
        aria-label={active ? `Íris: ${label} — toque para interromper a fala` : 'Falar com a Íris'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
      >
        <IrisMark size={width} mode={active ? irisModeFor(state) : 'idle'} />
      </button>
      <p
        style={{
          margin: 0,
          fontSize: '11px',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--hub-subtle)',
        }}
      >
        {active ? label : 'toque para falar com a Íris'}
      </p>
    </div>
  );
}

export function HomePage() {
  const [briefingOpen, setBriefingOpen] = useState(false);
  const briefing = useDailyBriefing();
  const { name } = useSession();
  const firstName = name.trim().split(/\s+/)[0];

  const { now, progress, next } = getRankedItems();

  return (
    <div className="py-2">
      <div className="mb-6">
        <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>{firstName ? `Olá, ${firstName}` : 'Olá'}</h1>
        <p className="mt-1 text-sm first-letter:capitalize" style={{ color: 'var(--hub-muted)' }}>
          {formatToday()}
        </p>
      </div>

      {/* Same skeleton as a module's summary: the answer first ("what now"),
          "Precisa de você" beside it on desktop and right after it on a phone. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <IrisHero />
              </div>
              <div className="w-full min-w-0">
                <Eyebrow style={{ marginBottom: '4px' }}>Agora</Eyebrow>
                {now.length === 0 ? (
                  <p className="py-2 text-sm" style={{ color: 'var(--hub-text-body)' }}>Nada urgente agora.</p>
                ) : now.map((item, i) => (
                  <ZoneItem key={item.id} item={item} signal="negative" last={i === now.length - 1} />
                ))}
                {/* Briefing: three lines, opens on tap — the hero is what to do, not the text. */}
                {briefing && (
                  <p
                    className="mt-4 text-xs leading-snug"
                    style={{
                      color: 'var(--hub-text-body)',
                      cursor: 'pointer',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--hub-border)',
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
                )}
              </div>
            </div>
          </Card>

          <AlertsCard className="lg:hidden" />
          <ZoneCard label="Próximo" signal="accent" items={next} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <AlertsCard className="hidden lg:block" />
          <ZoneCard label="Progresso" signal="positive" items={progress} />
        </div>
      </div>
    </div>
  );
}
