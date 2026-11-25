import { type HubAlert } from './alert-types';

type SyncRecord = { at: string; ok: boolean; error?: string; issues?: string[] };

const CONNECTIONS_ROUTE = '/configuracoes/conexoes';

/**
 * The per-user side of the health screen: a scheduled sync that failed — or
 * went quiet for twice its cadence, the same rule as `JOBS` on the server —
 * becomes an alert for the user whose connection it is. Only for users other
 * than the owner: his syncs already turn the system health red.
 */
export function syncAlert(input: {
  id: string;
  moduleId: string;
  label: string;
  record: SyncRecord | null;
  everyHours: number;
  /** e.g. semester break: no sync expected, so silence isn't a problem. */
  quietIsExpected?: boolean;
}): HubAlert | null {
  const { record } = input;
  if (!record) return null;
  if (!record.ok) {
    return {
      id: `${input.id}-failed`,
      moduleId: input.moduleId,
      severity: 'warning',
      title: `${input.label}: a última busca falhou`,
      description: record.error ?? record.issues?.join(' · '),
      actionLabel: 'Ver conexão',
      actionRoute: CONNECTIONS_ROUTE,
    };
  }
  const hours = (Date.now() - new Date(record.at).getTime()) / 3_600_000;
  if (!input.quietIsExpected && hours > input.everyHours * 2) {
    return {
      id: `${input.id}-quiet`,
      moduleId: input.moduleId,
      severity: 'info',
      title: `${input.label}: sem busca há ${Math.round(hours)} h`,
      description: 'O servidor deveria ter buscado de novo — se continuar assim, avise quem administra o Olimpo.',
      actionLabel: 'Ver conexão',
      actionRoute: CONNECTIONS_ROUTE,
    };
  }
  return null;
}
