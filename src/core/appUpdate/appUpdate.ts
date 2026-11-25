import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { apiUrl } from '../config/backendConfig';

/** Native side: android/.../AppUpdatePlugin.java. */
type AppUpdatePlugin = {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; sha256: string }): Promise<void>;
  addListener(event: 'progress', listener: (data: { percent: number }) => void): Promise<PluginListenerHandle>;
};

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

/** What the server announces (server/appRelease.js). */
export type AppRelease = {
  versionCode: number;
  versionName: string;
  notes: string;
  size: number;
  sha256: string;
  publishedAt: string;
};

/** "1.420 (abc1234)" in the APK; null in the browser or in APKs from before the self-update. */
export async function installedVersionName(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return (await AppUpdate.getVersion()).versionName;
  } catch {
    return null;
  }
}

/**
 * The published release when it's newer than this APK; null otherwise — also
 * in the browser, and in APKs from before the self-update (no AppUpdate plugin:
 * those get the one last manual install).
 */
export async function findUpdate(): Promise<AppRelease | null> {
  if (!Capacitor.isNativePlatform()) return null;
  let installed: number;
  try {
    installed = (await AppUpdate.getVersion()).versionCode;
  } catch {
    return null;
  }
  const res = await fetch(apiUrl('/api/app/android/latest'), { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return null;
  const latest = (await res.json()) as AppRelease;
  return latest.versionCode > installed ? latest : null;
}

/** Android already lets the Hub install updates — then it can update without asking anyone. */
export async function canInstallNow(): Promise<boolean> {
  try {
    return (await AppUpdate.canInstall()).allowed;
  } catch {
    return false;
  }
}

export type InstallOutcome = 'started' | 'needs-permission';

/**
 * Downloads the release and installs it. From the second update on (Android
 * 12+) that needs no confirmation — the app closes and Android shows "Hub
 * atualizado". The first time, Android requires "install unknown apps" for the
 * Hub: we open that settings page and the user taps Atualizar again.
 */
export async function installUpdate(release: AppRelease, onProgress: (percent: number) => void): Promise<InstallOutcome> {
  if (!(await AppUpdate.canInstall()).allowed) {
    await AppUpdate.openInstallSettings();
    return 'needs-permission';
  }
  const handle = await AppUpdate.addListener('progress', ({ percent }) => onProgress(percent));
  try {
    await AppUpdate.downloadAndInstall({ url: apiUrl('/api/app/android/apk'), sha256: release.sha256 });
    return 'started';
  } finally {
    await handle.remove();
  }
}
