import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiUrl } from '../config/backendConfig';
import { storageAdapter } from '../storage/storage.adapter';

/**
 * Native push for the APK. The Capacitor WebView has no Web Push, so the APK
 * registers a Firebase Cloud Messaging token with the server instead
 * (`POST /api/push/devices`, stored per user in `push.devices`). Must match
 * ANDROID_CHANNEL_ID in server/push.js.
 */
const CHANNEL_ID = 'hub';
/** The user turned notifications off in Configurações — don't re-register on the next start. */
const OFF_KEY = 'push.nativeOff';

let currentToken: string | null = null;
let initialized = false;

export function isNativePush(): boolean {
  return Capacitor.isNativePlatform();
}

function deviceName(): string {
  return /Android [\d.]+; ([^;)]+)/.exec(navigator.userAgent)?.[1]?.trim() || 'Android';
}

async function sendToken(token: string): Promise<void> {
  await fetch(apiUrl('/api/push/devices'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, device: deviceName() }),
  });
}

/**
 * Called once at app start (AppLayout). Sets up the channel and listeners, and
 * re-registers when already allowed: FCM rotates tokens, and the server only
 * reaches this phone with the current one.
 */
export async function initNativePush(openUrl: (url: string) => void): Promise<void> {
  if (!isNativePush() || initialized) return;
  initialized = true;
  await PushNotifications.createChannel({ id: CHANNEL_ID, name: 'Olimpo', importance: 4, visibility: 1 });
  await PushNotifications.addListener('registration', ({ value }) => {
    currentToken = value;
    void sendToken(value).catch(() => {});
  });
  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registro no FCM falhou:', err.error);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = (notification.data as { url?: string } | undefined)?.url;
    if (url) openUrl(url);
  });
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === 'granted' && !storageAdapter.getItem<boolean>(OFF_KEY)) await PushNotifications.register();
}

export async function nativePushEnabled(): Promise<'granted' | 'denied' | 'off'> {
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === 'denied') return 'denied';
  return receive === 'granted' && !storageAdapter.getItem<boolean>(OFF_KEY) ? 'granted' : 'off';
}

export async function enableNativePush(): Promise<'granted' | 'denied'> {
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== 'granted') return 'denied';
  storageAdapter.removeItem(OFF_KEY);
  await PushNotifications.register();
  return 'granted';
}

export async function disableNativePush(): Promise<void> {
  storageAdapter.setItem(OFF_KEY, true);
  if (currentToken) {
    await fetch(apiUrl('/api/push/devices/unregister'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken }),
    }).catch(() => {});
  }
  await PushNotifications.unregister();
  currentToken = null;
}
