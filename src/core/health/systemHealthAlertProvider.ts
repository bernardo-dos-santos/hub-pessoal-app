import { type AlertProvider, type HubAlert } from '../alerts/alert-types';
import { getCachedSystemHealth } from './systemHealth';

const ROUTE = '/automacoes';

export const systemHealthAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const health = getCachedSystemHealth();
    if (!health) return [];
    const alerts: HubAlert[] = [];

    // Um alerta só, não um por job: num dia ruim (servidor reiniciou, token do
    // Google venceu) vários quebram juntos e, separados, empurravam para fora
    // da Home os alertas dos módulos.
    const broken = health.jobs.filter((job) => job.status === 'error' || job.status === 'stale');
    if (broken.length === 1) {
      const [job] = broken;
      alerts.push({
        id: `system-job-${job.script}`,
        moduleId: 'system',
        severity: 'warning',
        title: job.status === 'error' ? `${job.label}: a última execução falhou` : `${job.label} parou de rodar`,
        description: job.status === 'error'
          ? job.lastMessage ?? undefined
          : job.lastRun ? `Último registro em ${new Date(job.lastRun).toLocaleDateString('pt-BR')}` : undefined,
        actionLabel: 'Ver',
        actionRoute: ROUTE,
      });
    } else if (broken.length > 1) {
      alerts.push({
        id: 'system-jobs-broken',
        moduleId: 'system',
        severity: 'warning',
        title: `${broken.length} automações com problema`,
        description: broken.map((job) => job.label).join(', '),
        actionLabel: 'Ver',
        actionRoute: ROUTE,
      });
    }

    // Tunnel down: everyone outside Tailscale is locked out — the friends see
    // nothing but Cloudflare's error page, and only the admin can fix it.
    if (health.publicAccess?.tunnel.status === 'down') {
      alerts.push({
        id: 'system-tunnel-down',
        moduleId: 'system',
        severity: 'critical',
        title: 'Acesso pela internet fora do ar',
        description: 'O túnel da Cloudflare não está conectado — só quem está no Tailscale entra.',
        actionLabel: 'Ver',
        actionRoute: ROUTE,
      });
    }

    const certificates = health.publicAccess?.certificates ?? [];
    if (certificates.length > 0) {
      const expired = certificates.filter((c) => c.status === 'expired');
      alerts.push({
        id: 'system-certificates',
        moduleId: 'system',
        severity: expired.length > 0 ? 'warning' : 'info',
        title: expired.length > 0
          ? `${expired.length === 1 ? 'Um certificado venceu' : `${expired.length} certificados venceram`} — a pessoa não entra mais pela internet`
          : `${certificates.length === 1 ? 'Um certificado vence' : `${certificates.length} certificados vencem`} em menos de 30 dias`,
        description: certificates.map((c) => `${c.label} (${c.userName})`).join(', '),
        actionLabel: 'Ver',
        actionRoute: '/admin',
      });
    }

    if (!health.ai.principalConfigured) {
      alerts.push({
        id: 'system-ai-unconfigured',
        moduleId: 'system',
        severity: 'info',
        title: 'IA desligada: falta o slot Principal',
        actionLabel: 'Configurar',
        actionRoute: '/configuracoes/ia',
      });
    }

    return alerts;
  },
};
