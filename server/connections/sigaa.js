/**
 * sigaa.js — each user's SIGAA (IFSC) login, for scripts/sync/sigaa-sync.js.
 *
 * Stored in `secrets`, encrypted, under the user. There is no
 * check before saving: testing a password means a real browser login, and
 * every login from the server's IP feeds the SIGAA anti-bot that already
 * blocks the owner's own sync now and then. The first scheduled run is the
 * test, and its result lands in the user's `college.sigaa.lastSync`.
 */

import { secrets } from '../db.js';
import { decryptSecret, encryptSecret } from '../crypto.js';

const SECRET = { login: 'sigaa.login', password: 'sigaa.password' };

/** @returns {{ login: string, password: string } | null} */
export function readSigaaConfig() {
  const login = decryptSecret(secrets.get(SECRET.login));
  const password = decryptSecret(secrets.get(SECRET.password));
  return login && password ? { login, password } : null;
}

export function saveSigaaCredentials(login, password) {
  secrets.set(SECRET.login, encryptSecret(login));
  secrets.set(SECRET.password, encryptSecret(password));
}

export function clearSigaa() {
  for (const name of Object.values(SECRET)) secrets.delete(name);
}
