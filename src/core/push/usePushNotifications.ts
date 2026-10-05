import { useState, useEffect } from 'react';

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'error';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const { publicKey } = await res.json() as { publicKey: string };
    return publicKey;
  } catch {
    return null;
  }
}

async function subscribe(publicKey: string): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // Uint8Array diretamente (mais compatível que .buffer)
    applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
  });
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

async function unsubscribe(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('unsubscribed');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setState('unsubscribed'));
  }, []);

  async function toggle() {
    setErrorMsg(null);
    try {
      if (state === 'subscribed') {
        await unsubscribe();
        setState('unsubscribed');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'denied') { setState('denied'); return; }

      const publicKey = await getPublicKey();
      if (!publicKey) {
        setErrorMsg('Não foi possível obter a chave VAPID do servidor.');
        return;
      }

      const ok = await subscribe(publicKey);
      if (ok) {
        setState('subscribed');
      } else {
        setErrorMsg('Servidor recusou a subscription. Verifique os logs.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro ao ativar notificações: ${msg}`);
      setState('error');
    }
  }

  return { state, toggle, errorMsg };
}
