import { useSyncExternalStore } from 'react';
import { apiUrl } from '../config/backendConfig';
import { type ModuleId } from '../module-registry/module-types';

/**
 * Who is using the Hub right now — loaded once at boot from GET /api/me.
 *
 * Changing the user (admin "ver como") reloads the page instead of swapping
 * the session in place: the store cache, the daily context and every module's
 * memoized state were built from the previous user's data.
 */
export type Session = {
  id: number;
  name: string;
  email: string | null;
  isAdmin: boolean;
  /** The machine owner — the only one with Jarvis, syncs and server diagnostics (OWNER_ONLY_PREFIXES). */
  isOwner: boolean;
  /** Chosen modules; null = all of them. */
  modules: ModuleId[] | null;
  onboardedAt: string | null;
  /** True while the admin is viewing the Hub as `name`. */
  viewingAs: boolean;
  realUser: { id: number; name: string; isAdmin: boolean };
  /** Modules the admin took offline for everyone else (global, not per user). */
  maintenance: ModuleMaintenance[];
};

export type ModuleMaintenance = { moduleId: ModuleId; message: string; since: string };

// Last known session, so the standalone mode (backend unreachable) still knows
// whose local namespace and which modules to show. Not user data — it's the
// pointer to it, which is why it lives outside the storageAdapter.
const SESSION_CACHE_KEY = 'hub-session';

/** Before any session was ever loaded (fresh device, dev without backend): the owner, as in single-user times. */
const FALLBACK: Session = {
  id: 1,
  name: '',
  email: null,
  isAdmin: true,
  isOwner: true,
  modules: null,
  onboardedAt: 'unknown',
  viewingAs: false,
  realUser: { id: 1, name: '', isAdmin: true },
  maintenance: [],
};

let current: Session = FALLBACK;
const listeners = new Set<() => void>();

function publish(next: Session): void {
  current = next;
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota — the session still works for this page load
  }
  for (const listener of listeners) listener();
}

function cachedSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    return raw ? { ...FALLBACK, ...(JSON.parse(raw) as Partial<Session>) } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export type SessionLoad = 'ok' | 'offline' | 'denied';

let deniedReason: string | null = null;

/** Set when the backend refused this person (unregistered or disabled) — the app shows that instead of data. */
export function getDeniedReason(): string | null {
  return deniedReason;
}

/** Loads the session from the backend; when it can't be reached, keeps the last known one. */
export async function loadSession(signal?: AbortSignal): Promise<SessionLoad> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/me'), { signal, cache: 'no-store' });
  } catch {
    current = cachedSession();
    return 'offline';
  }
  if (res.status === 403) {
    const { error } = await res.json().catch(() => ({ error: undefined }));
    deniedReason = error ?? 'Acesso não liberado.';
    return 'denied';
  }
  if (!res.ok) {
    current = cachedSession();
    return 'offline';
  }
  publish(await res.json() as Session);
  return 'ok';
}

export function getSession(): Session {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession);
}

/**
 * Whether to show admin UI (Usuários). The real user must be the admin AND not
 * be viewing as someone else: "ver como" shows exactly what that person sees,
 * and the way back is the banner, not the panel.
 */
export function canSeeAdmin(session: Session = current): boolean {
  return session.realUser.isAdmin && !session.viewingAs;
}

export function moduleMaintenance(id: ModuleId, session: Session = current): ModuleMaintenance | null {
  return session.maintenance.find((m) => m.moduleId === id) ?? null;
}

/** In maintenance and this person isn't the one fixing it — "ver como" counts as not. */
export function isModuleBlocked(id: ModuleId, session: Session = current): boolean {
  return moduleMaintenance(id, session) !== null && !canSeeAdmin(session);
}

export function isModuleEnabled(id: ModuleId, session: Session = current): boolean {
  return session.modules === null || session.modules.includes(id);
}

/** JSON request to the session/admin endpoints; throws the server's error message. */
export async function sessionRequest(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: undefined }));
    throw new Error(error ?? `HTTP ${res.status}`);
  }
  return res;
}

export async function updateMe(patch: { name?: string; modules?: ModuleId[]; onboarded?: true }): Promise<void> {
  const res = await sessionRequest('/api/me', 'PUT', patch);
  const user = await res.json() as Pick<Session, 'name' | 'modules' | 'onboardedAt'>;
  publish({ ...current, name: user.name, modules: user.modules, onboardedAt: user.onboardedAt });
}

/** Admin: see the Hub as another user. Reloads into that user's data. */
export async function viewAs(userId: number): Promise<void> {
  await sessionRequest('/api/admin/view-as', 'POST', { userId });
  window.location.assign('/');
}

export async function stopViewingAs(): Promise<void> {
  await sessionRequest('/api/admin/view-as', 'DELETE');
  window.location.assign('/');
}
