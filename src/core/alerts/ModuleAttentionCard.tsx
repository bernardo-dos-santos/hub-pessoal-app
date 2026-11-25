import { AlertRow, Card, type Signal } from '../../shared/ui';
import type { AlertProvider, AlertSeverity } from './alert-types';

export const SEVERITY_SIGNAL: Record<AlertSeverity, Signal> = {
  critical: 'negative',
  warning: 'warning',
  info: 'neutral',
};

/**
 * "Precisa de você": a module's own alerts, on its own summary screen. Reads the
 * same provider the Home's card of the same name does, so a nudge never says one thing
 * there and another here. Renders nothing when there is nothing to do.
 */
export function ModuleAttentionCard({ provider, className }: { provider: AlertProvider; className?: string }) {
  const alerts = provider.getAlerts();
  if (alerts.length === 0) return null;

  return (
    <Card className={className}>
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-warning)', marginBottom: '2px' }}>
        Precisa de você
      </p>
      {alerts.map((alert, index) => (
        <AlertRow
          key={alert.id}
          title={alert.title}
          subtitle={alert.description}
          signal={SEVERITY_SIGNAL[alert.severity]}
          action={alert.actionLabel ?? 'Ver'}
          to={alert.actionRoute}
          last={index === alerts.length - 1}
        />
      ))}
    </Card>
  );
}
