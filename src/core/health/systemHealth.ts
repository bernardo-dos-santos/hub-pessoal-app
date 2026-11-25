import { apiUrl } from '../config/backendConfig';

export type JobStatus = 'ok' | 'error' | 'stale' | 'unknown';

export type JobHealth = {
  script: string;
  label: string;
  everyHours: number | null;
  status: JobStatus;
  lastRun: string | null;
  lastMessage: string | null;
  lastSuccess: string | null;
};

/** A device certificate expiring within 30 days, or already expired (server/systemHealth.js). */
export type CertificateHealth = {
  label: string;
  userName: string;
  notAfter: string;
  daysLeft: number;
  status: 'expiring' | 'expired';
};

export type SystemHealth = {
  jobs: JobHealth[];
  agent: { anyOnline: boolean; devices: { id: string; lastSeenAt: string; online: boolean }[] };
  ai: { principalConfigured: boolean };
  /** null while the public port (F4) is off. */
  publicAccess: {
    /** `running` = the service is up but its metrics didn't answer, so the connection itself is unconfirmed. */
    tunnel: { status: 'ok' | 'running' | 'down' | 'unknown'; connections: number | null };
    certificates: CertificateHealth[];
  } | null;
};

/**
 * Último retrato do servidor, guardado em memória.
 *
 * Alert providers são síncronos (`getAlerts()`), e este dado só existe do
 * outro lado de um fetch — então o AppLayout busca, isto guarda, e quem
 * desenha alertas assina `subscribeSystemHealth` para redesenhar quando
 * chegar. Não vai para o storageAdapter: é derivado do servidor a cada
 * leitura, gravá-lo lá só criaria uma cópia velha.
 */
let cached: SystemHealth | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function getCachedSystemHealth(): SystemHealth | null {
  return cached;
}

export function getSystemHealthVersion(): number {
  return version;
}

export function subscribeSystemHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshSystemHealth(): Promise<SystemHealth | null> {
  try {
    const res = await fetch(apiUrl('/api/system/health'), { cache: 'no-store' });
    if (!res.ok) return cached;
    cached = (await res.json()) as SystemHealth;
    version += 1;
    listeners.forEach((l) => l());
  } catch {
    // Servidor fora do ar: mantém o último retrato em vez de fingir que está tudo bem.
  }
  return cached;
}
