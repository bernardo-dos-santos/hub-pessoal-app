import { apiUrl } from '../../../core/config/backendConfig';
import { getSession, sessionRequest } from '../../../core/session/session';
import { refreshKey } from '../../../core/storage/apiStorageAdapter';
import { storageAdapter } from '../../../core/storage/storage.adapter';

export type Institution = 'ifsc' | 'uniplac' | 'other';
export type AcademicSystem = 'classroom' | 'moodle' | 'sigaa' | 'other';

/** Where the user studies — not secret, so it lives in kv; the admin panel reads it to see who asked for what. */
export type CollegeConnection = {
  institution: Institution;
  /** Only for 'other'. */
  institutionName?: string;
  system?: AcademicSystem;
  /** Only for system 'other': what they actually use. */
  systemName?: string;
};

export type SigaaStatus = { configured: boolean };

/** Written by the server's sigaa-sync after each run for this user. */
export type SigaaLastSync = { at: string; ok: boolean; courses?: number; error?: string };

const CONNECTION_KEY = 'college.connection';
const LAST_SYNC_KEY = 'college.sigaa.lastSync';

export const collegeConnectionService = {
  /** null = never answered. The owner predates the question and studies at the IFSC. */
  getConnection(): CollegeConnection | null {
    return storageAdapter.getItem<CollegeConnection>(CONNECTION_KEY)
      ?? (getSession().isOwner ? { institution: 'ifsc' } : null);
  },
  setConnection(connection: CollegeConnection): void {
    storageAdapter.setItem(CONNECTION_KEY, connection);
  },
  /** Only IFSC students have something for the SIGAA sync to fetch. */
  usesSigaa(): boolean {
    return this.getConnection()?.institution === 'ifsc';
  },
  async sigaaStatus(): Promise<SigaaStatus> {
    const res = await fetch(apiUrl('/api/connections/sigaa'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async saveSigaaCredentials(login: string, password: string): Promise<void> {
    await sessionRequest('/api/connections/sigaa/credentials', 'PUT', { login, password });
  },
  async removeSigaa(): Promise<void> {
    await sessionRequest('/api/connections/sigaa', 'DELETE');
  },
  lastSync(): SigaaLastSync | null {
    return storageAdapter.getItem<SigaaLastSync>(LAST_SYNC_KEY);
  },
  async refreshLastSync(): Promise<SigaaLastSync | null> {
    await refreshKey(LAST_SYNC_KEY);
    return this.lastSync();
  },
};
