import { apiUrl } from '../config/backendConfig';
import { type ModuleId } from '../module-registry/module-types';
import { sessionRequest } from './session';

export type AdminUser = {
  id: number;
  name: string;
  email: string | null;
  tailscaleLogin: string | null;
  isAdmin: boolean;
  modules: ModuleId[] | null;
  onboardedAt: string | null;
  disabledAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  /** How many keys the user has stored — the panel never sees the values. */
  keyCount: number;
  /** Which integrations the user has credentials for — never the credentials. */
  integrations: { sigaa: boolean; ai: boolean };
  /** Where they study (Faculdade → Conexões); null if never answered. */
  college: { institution: 'ifsc' | 'uniplac' | 'other'; institutionName?: string; system?: string; systemName?: string } | null;
  /** Last result of each scheduled sync for this user; null = never ran. */
  lastSync: { sigaa: AdminSyncRecord | null };
};

export type AdminSyncRecord = { at: string; ok: boolean; error?: string; issues?: string[] };

export type AdminUserPatch = {
  name?: string;
  email?: string | null;
  tailscaleLogin?: string | null;
  disabled?: boolean;
  resetOnboarding?: true;
};

/** A device allowed in through the public address (server/usersApi.js → /api/admin/certs). */
export type DeviceCertificate = {
  fingerprint: string;
  userId: number;
  label: string;
  notAfter: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export const adminService = {
  async listCertificates(): Promise<DeviceCertificate[]> {
    const res = await fetch(apiUrl('/api/admin/certs'), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 403 ? 'Só pelo Tailscale.' : `HTTP ${res.status}`);
    return res.json();
  },
  /** `certificate` is the PEM Cloudflare shows after signing; the server reads fingerprint and expiry from it. */
  async addCertificate(input: { userId: number; label: string; certificate: string }): Promise<DeviceCertificate> {
    return (await sessionRequest('/api/admin/certs', 'POST', input)).json();
  },
  /** Revokes in the Olimpo and, when the panel issued it, at Cloudflare; a failure there comes back as `cloudflareError`. */
  async revokeCertificate(fingerprint: string): Promise<{ cloudflareError: string | null }> {
    return (await sessionRequest(`/api/admin/certs/${fingerprint}`, 'DELETE')).json();
  },
  /** Whether the server can issue certificates by itself (Cloudflare API configured there). */
  async certificateGeneratorAvailable(): Promise<boolean> {
    const res = await fetch(apiUrl('/api/admin/certs/generator'), { cache: 'no-store' });
    return res.ok && ((await res.json()) as { available: boolean }).available;
  },
  /** Issues, registers and packs a device certificate; the .p12 (base64) and its password exist only in this response. */
  async generateCertificate(input: { userId: number; label: string }): Promise<DeviceCertificate & { p12: string; password: string }> {
    return (await sessionRequest('/api/admin/certs/generate', 'POST', input)).json();
  },
  async list(): Promise<AdminUser[]> {
    const res = await fetch(apiUrl('/api/admin/users'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async create(input: { name: string; email?: string | null }): Promise<AdminUser> {
    return (await sessionRequest('/api/admin/users', 'POST', input)).json();
  },
  async startMaintenance(moduleId: ModuleId, message: string): Promise<void> {
    await sessionRequest(`/api/admin/maintenance/${moduleId}`, 'PUT', { message });
  },
  async endMaintenance(moduleId: ModuleId): Promise<void> {
    await sessionRequest(`/api/admin/maintenance/${moduleId}`, 'DELETE');
  },
  async update(id: number, patch: AdminUserPatch): Promise<AdminUser> {
    return (await sessionRequest(`/api/admin/users/${id}`, 'PUT', patch)).json();
  },
};
