/**
 * location.ts — manda a posição do aparelho para o Hub (Fase 13).
 *
 * Quem decide o que fazer com ela é o servidor, que resolve para nome de lugar
 * e joga fora a coordenada antes de qualquer coisa chegar ao modelo (ver
 * server/jarvis/location.js).
 *
 * Duas travas antes de pedir GPS:
 *   1. A capacidade `location` precisa estar ligada na config do Jarvis. Sem
 *      isso o app nem pergunta a permissão — abrir o Hub e levar um pedido de
 *      GPS sem ter pedido nada é o tipo de coisa que faz desinstalar app.
 *   2. Intervalo mínimo entre leituras. O ponto aqui é "em que lugar ele está",
 *      não rastro de trajeto; ler a cada foco de tela só gastaria bateria.
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { apiUrl } from '../config/backendConfig';

const MIN_INTERVAL_MS = 10 * 60_000;

let lastReportAt = 0;
let enabled: boolean | null = null;

/** Lê a capacidade uma vez por sessão — ela muda na tela de config, não sozinha. */
async function locationEnabled(): Promise<boolean> {
  if (enabled !== null) return enabled;
  try {
    const res = await fetch(apiUrl('/api/jarvis/config'), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = await res.json();
    enabled = data?.config?.capabilities?.location === true;
  } catch {
    enabled = false;
  }
  return enabled;
}

/** Esquece o que leu — chamado quando a config muda na tela. */
export function resetLocationCapabilityCache(): void {
  enabled = null;
}

/**
 * Lê a posição e manda para o Hub. Silencioso por natureza: se não houver
 * permissão, GPS ou rede, o Hub inteiro continua funcionando sem isso.
 */
export async function reportLocation(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const now = Date.now();
  if (now - lastReportAt < MIN_INTERVAL_MS) return;
  if (!(await locationEnabled())) return;

  try {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const asked = await Geolocation.requestPermissions();
      if (asked.location !== 'granted') return;
    }

    const position = await Geolocation.getCurrentPosition({
      // Precisão grosseira basta para "está em casa ou no IFSC" e custa muito
      // menos bateria que o GPS fino. O raio padrão de um lugar é 150m.
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 5 * 60_000,
    });

    lastReportAt = now;

    await fetch(apiUrl('/api/jarvis/location'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Sem permissão, sem sinal ou sem rede — nada a fazer, e nada a avisar.
  }
}
