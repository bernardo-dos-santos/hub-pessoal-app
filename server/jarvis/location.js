/**
 * jarvis/location.js — onde o Bernardo está, em nome de lugar (Fase 13).
 *
 * A regra que organiza este arquivo: COORDENADA NUNCA SAI DAQUI. O resto do
 * sistema — contexto, prompt, hash do tick — só vê "casa", "IFSC" ou null.
 *
 * Não é estética. O gate do tick barra quando o contexto não mudou desde a
 * última vez (initiative.js), comparando um hash. Latitude e longitude oscilam
 * alguns metros a cada leitura mesmo com o aparelho parado na mesa: se a
 * coordenada entrasse no contexto, o hash mudaria SEMPRE, o gate nunca barraria
 * nada e o orçamento diário de ticks seria queimado em silêncio — justo o gate
 * que existe para o dia parado custar zero.
 *
 * Com nome de lugar, o hash só muda quando ele de fato troca de lugar. Aí a
 * localização vira gatilho de tick de graça, sem nenhum código novo em
 * initiative.js: chegar em casa muda o contexto, e contexto mudado é
 * exatamente o que o gate espera para liberar.
 */

import { kvStore } from '../db.js';
import { kv } from './context.js';

const PLACES_KEY = 'jarvis.places';
const LOCATION_KEY = 'jarvis.location';

/** Raio padrão de um lugar. GPS de celular erra dezenas de metros em área urbana. */
const DEFAULT_RADIUS_M = 150;

/** Leitura mais velha que isto não descreve mais onde ele está. */
const STALE_MINUTES = 90;

function genId() {
  return `place-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Distância em metros entre dois pontos (Haversine).
 *
 * Fórmula esférica: erra ~0,5% contra o elipsoide real, o que em 150m dá menos
 * de um metro. Irrelevante para "estou na academia ou não".
 */
function distanceMeters(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function listPlaces() {
  return kv(PLACES_KEY) ?? [];
}

export function addPlace({ name, lat, lon, radiusM }) {
  const clean = String(name ?? '').trim();
  if (!clean) return { ok: false, error: 'Dê um nome ao lugar.' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'Coordenada inválida.' };

  const place = {
    id: genId(),
    name: clean,
    lat,
    lon,
    radiusM: Number.isFinite(radiusM) && radiusM > 0 ? radiusM : DEFAULT_RADIUS_M,
  };
  // Mesmo nome duas vezes seria ambíguo no prompt ("em casa" com dois "casa"),
  // então regravar um nome existente substitui em vez de duplicar.
  const others = listPlaces().filter((p) => p.name.toLowerCase() !== clean.toLowerCase());
  kvStore.set(PLACES_KEY, JSON.stringify([...others, place]));
  return { ok: true, place };
}

export function removePlace(id) {
  const remaining = listPlaces().filter((p) => p.id !== id);
  kvStore.set(PLACES_KEY, JSON.stringify(remaining));
  return { ok: true };
}

/** O lugar conhecido mais próximo que contenha o ponto, ou null. */
export function resolvePlace(lat, lon) {
  let best = null;
  for (const place of listPlaces()) {
    const d = distanceMeters({ lat, lon }, place);
    if (d <= place.radiusM && (!best || d < best.distance)) best = { place, distance: d };
  }
  return best?.place?.name ?? null;
}

/**
 * Registra a posição vinda do aparelho.
 *
 * Guarda a coordenada crua no kv (é o que permite salvar "o lugar onde estou
 * agora" logo depois, sem pedir GPS de novo) — mas quem lê o contexto nunca
 * chega nela.
 */
export function recordLocation({ lat, lon, accuracy }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Coordenada inválida.' };
  }

  const previous = kv(LOCATION_KEY);
  const place = resolvePlace(lat, lon);

  kvStore.set(LOCATION_KEY, JSON.stringify({
    lat,
    lon,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    at: new Date().toISOString(),
    place,
  }));

  return { ok: true, place, changed: (previous?.place ?? null) !== place };
}

/** Última posição crua — só para "salvar o lugar onde estou agora". */
export function lastRawLocation() {
  return kv(LOCATION_KEY) ?? null;
}

/**
 * O que o contexto do Jarvis enxerga: nome do lugar e há quanto tempo.
 *
 * `place` é estável (entra no hash do tick); `minutesAgo` muda a cada leitura e
 * por isso viaja separado — ver o descarte de `locationAt` em
 * initiative.js:contextFingerprint.
 */
export function getLocationContext() {
  const last = lastRawLocation();
  if (!last?.at) return { place: null, at: null };

  const minutes = Math.round((Date.now() - new Date(last.at).getTime()) / 60_000);
  if (minutes > STALE_MINUTES) return { place: null, at: null };

  return { place: last.place ?? null, at: last.at, minutesAgo: minutes };
}
