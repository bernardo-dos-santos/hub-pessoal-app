/**
 * weather.js — previsão do tempo via Open-Meteo.
 *
 * Sem chave e sem cadastro (por isso foi a escolhida em vez de serviços pagos).
 * Existe pra responder o que importa aqui: dá pra correr hoje? vai chover na
 * hora que o treino está planejado? — o Cooper do TAF é ao ar livre.
 *
 * De ONDE é a previsão, em ordem de prioridade:
 *   1. a última posição que o celular mandou, se recente (Fase 13);
 *   2. HUB_LAT/HUB_LON/HUB_CITY no .env;
 *   3. Lages, onde o Bernardo mora.
 *
 * O padrão era Florianópolis e ninguém tinha configurado o .env — ou seja,
 * todo briefing que falava de chuva ou temperatura dava a previsão de uma
 * cidade a 200km de distância, do outro lado da serra. Erro silencioso: o
 * número parecia plausível, só era de outro lugar.
 */

import { kvStore } from './db.js';

/** Coordenada do celular mais velha que isto não descreve mais onde ele está. */
const DEVICE_MAX_AGE_MS = 2 * 24 * 60 * 60_000;

const CONFIGURED = {
  lat: Number(process.env.HUB_LAT ?? -27.8167),
  lon: Number(process.env.HUB_LON ?? -50.3264),
  city: process.env.HUB_CITY ?? 'Lages',
};

const TIMEZONE = 'America/Sao_Paulo';

/** Distância aproximada em km — só para saber se ele saiu da cidade configurada. */
function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function resolveLocation() {
  let last = null;
  try { last = JSON.parse(kvStore.get('jarvis.location') ?? 'null'); } catch { last = null; }

  const fresca = last?.at && (Date.now() - new Date(last.at).getTime()) < DEVICE_MAX_AGE_MS;
  if (!fresca || !Number.isFinite(last.lat) || !Number.isFinite(last.lon)) return CONFIGURED;

  // Longe da cidade configurada: a previsão passa a ser a de onde ele está, e
  // o rótulo deixa de mentir o nome da cidade. Perto, mantém o nome — dizer
  // "Lages" é mais útil do que "sua localização atual" no dia a dia.
  const longe = distanceKm(CONFIGURED, last) > 40;
  return {
    lat: last.lat,
    lon: last.lon,
    city: longe ? (last.place ?? 'onde você está') : CONFIGURED.city,
  };
}

const CACHE_KEY = 'hub.weatherCache';
// Previsão não muda de minuto a minuto — 30min evita bater na API a cada
// mensagem do Jarvis sem deixar o dado velho o suficiente pra enganar.
const CACHE_TTL_MS = 30 * 60_000;

// Códigos WMO — só os grupos que interessam, agrupados pra leitura humana.
function describeCode(code) {
  if (code === 0) return 'céu limpo';
  if (code <= 2) return 'parcialmente nublado';
  if (code === 3) return 'nublado';
  if (code <= 48) return 'névoa';
  if (code <= 57) return 'garoa';
  if (code <= 67) return 'chuva';
  if (code <= 77) return 'neve';
  if (code <= 82) return 'pancadas de chuva';
  if (code <= 86) return 'pancadas de neve';
  return 'tempestade';
}

/**
 * O cache guarda de ONDE era a previsão. Sem isso, sair da cidade continuaria
 * devolvendo por meia hora o tempo do lugar anterior — justamente quando saber
 * o tempo do lugar novo importa mais.
 */
function readCache(local) {
  try {
    const raw = kvStore.get(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    if (cached.lat !== local.lat || cached.lon !== local.lon) return null;
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Previsão de hoje e amanhã, mais a chance de chuva hora a hora do que resta
 * do dia. Retorna null se a API falhar — clima é acessório, não pode derrubar
 * o briefing nem a resposta do Jarvis.
 */
export async function getWeather() {
  const local = resolveLocation();
  const cached = readCache(local);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${local.lat}&longitude=${local.lon}`
    + '&current=temperature_2m,apparent_temperature,precipitation,weather_code'
    + '&hourly=precipitation_probability,temperature_2m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + `&timezone=${encodeURIComponent(TIMEZONE)}&forecast_days=2`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return null;
    const raw = await resp.json();

    const nowHour = new Date().toISOString().slice(0, 13);
    const restOfToday = (raw.hourly?.time ?? [])
      .map((time, i) => ({
        time,
        rainChance: raw.hourly.precipitation_probability?.[i] ?? null,
        temp: raw.hourly.temperature_2m?.[i] ?? null,
      }))
      .filter((h) => h.time.slice(0, 13) >= nowHour && h.time.slice(0, 10) === raw.daily?.time?.[0])
      .map((h) => ({ hour: h.time.slice(11, 16), rainChance: h.rainChance, temp: h.temp }));

    const data = {
      city: local.city,
      current: {
        temp: raw.current?.temperature_2m ?? null,
        feelsLike: raw.current?.apparent_temperature ?? null,
        condition: describeCode(raw.current?.weather_code ?? -1),
        raining: (raw.current?.precipitation ?? 0) > 0,
      },
      today: {
        min: raw.daily?.temperature_2m_min?.[0] ?? null,
        max: raw.daily?.temperature_2m_max?.[0] ?? null,
        condition: describeCode(raw.daily?.weather_code?.[0] ?? -1),
        rainChance: raw.daily?.precipitation_probability_max?.[0] ?? null,
      },
      tomorrow: {
        min: raw.daily?.temperature_2m_min?.[1] ?? null,
        max: raw.daily?.temperature_2m_max?.[1] ?? null,
        condition: describeCode(raw.daily?.weather_code?.[1] ?? -1),
        rainChance: raw.daily?.precipitation_probability_max?.[1] ?? null,
      },
      // Serve pra "posso correr às 18h?" — sem isto só dá pra falar do dia inteiro.
      hourlyRestOfToday: restOfToday,
    };

    // lat/lon vão junto porque `readCache` compara com a posição atual — sem
    // eles a comparação nunca casaria e a API seria chamada a cada mensagem.
    kvStore.set(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), lat: local.lat, lon: local.lon, data }));
    return data;
  } catch {
    return null;
  }
}
