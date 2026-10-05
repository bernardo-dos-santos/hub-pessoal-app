// server/tts.js
// Text-to-speech do Jarvis via Azure AI Speech (voz neural pt-BR).
// Voz oficial: Nicolau, grave leve (pitch -7%), pace levemente acelerado
// (+5% — fala em ritmo natural soava hesitante pro personagem).
// Requer AZURE_SPEECH_KEY e AZURE_SPEECH_REGION no ambiente.

const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION ?? 'brazilsouth';

// Config da voz do Jarvis (ajustável aqui — só mudar e reiniciar o server).
export const JARVIS_VOICE = {
  name: 'pt-BR-NicolauNeural',
  pitch: '-7%',
  rate: '+5%',
};

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Pausas dramáticas: o Azure lê "..." quase sem parar e o Nicolau não suporta
// estilos express-as (testado 2026-07-26 — áudio sai byte-idêntico com e sem
// estilo). Reticências viram pausa real e travessão vira respiro curto — é o
// que dá "timing de comédia" pra ironia do Jarvis. Roda depois do escape (as
// sequências substituídas não contêm caracteres escapáveis).
function toSpokenSsml(text) {
  return escapeXml(text)
    .replace(/(?:\.\.\.|…)/g, '<break time="400ms"/> ')
    .replace(/\s+[—–]\s+/g, ' <break time="250ms"/> ');
}

/**
 * Sintetiza texto em fala (MP3) com a voz do Jarvis.
 * @param {string} text
 * @returns {Promise<Buffer>} áudio MP3
 */
export async function synthesizeSpeech(text) {
  if (!AZURE_KEY) {
    throw new Error('AZURE_SPEECH_KEY não configurada no servidor.');
  }
  const ssml =
    `<speak version='1.0' xml:lang='pt-BR'>` +
    `<voice name='${JARVIS_VOICE.name}'>` +
    `<prosody pitch='${JARVIS_VOICE.pitch}' rate='${JARVIS_VOICE.rate}'>` +
    `${toSpokenSsml(text)}` +
    `</prosody></voice></speak>`;

  const endpoint = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'hub-jarvis-tts',
    },
    body: ssml,
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Azure TTS ${resp.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

export const ttsConfigured = Boolean(AZURE_KEY);
