import { storageAdapter } from '../storage/storage.adapter';
import { refreshKey } from '../storage/apiStorageAdapter';
import { apiUrl } from '../config/backendConfig';

const HISTORY_KEY = 'jarvis.chatHistory';
const MAX_HISTORY = 20;

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Só a marca de que houve foto — os bytes NUNCA entram no histórico (ver abaixo). */
  hasImage?: boolean;
};

export type ChatImage = { mediaType: string; data: string };

/**
 * A foto vive só em memória, nunca no histórico.
 *
 * `storageAdapter` grava no store do servidor: uma foto em base64 dentro de
 * `jarvis.chatHistory` seria ~1 MB por mensagem, subindo a cada digitação de
 * volta pro banco e voltando em todo boot do app. O histórico guarda apenas
 * `hasImage`, e os bytes ficam aqui, perdidos ao recarregar a página — o que é
 * o comportamento certo para uma foto de uso imediato.
 *
 * Uma de cada vez, de propósito: a imagem é reenviada em toda mensagem seguinte
 * enquanto continuar no recorte recente (é o que faz "e a letra b?" funcionar,
 * já que o modelo não guarda memória entre chamadas), e cada reenvio é cobrado
 * de novo. Guardar várias multiplicaria esse custo sem que ninguém percebesse.
 */
let lastImage: { messageId: string; image: ChatImage } | null = null;

/** Quantas mensagens finais ainda reenviam a foto anexada a elas. */
const IMAGE_WINDOW = 6;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Áudio atual em reprodução (pra interromper a fala anterior).
let currentAudio: HTMLAudioElement | null = null;

// Estado "falando" — o orb 3D só anima enquanto isso for true.
const speakingListeners = new Set<(speaking: boolean) => void>();
function setSpeaking(speaking: boolean): void {
  speakingListeners.forEach((cb) => cb(speaking));
}

// Análise de volume/frequência do áudio em reprodução — alimenta o orb pra
// ele se mexer seguindo a voz do Jarvis (contexto compartilhado, criado sob
// demanda, reaproveitado entre falas pra não estourar o limite de
// AudioContext do navegador).
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
// O source de cada fala precisa ser guardado pra ser desconectado no fim. Sem
// isso cada fala deixava um MediaElementAudioSourceNode pendurado no contexto
// compartilhado (que é reaproveitado entre falas), acumulando sem limite.
let sourceNode: MediaElementAudioSourceNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;
let levelRaf = 0;
const levelListeners = new Set<(volume: number, treble: number) => void>();
function setLevel(volume: number, treble: number): void {
  levelListeners.forEach((cb) => cb(volume, treble));
}

// Conecta o áudio ao analisador ANTES do play() e espera o AudioContext sair de
// "suspended". Conectar depois (no onplay, como era) redirecionava o som pro
// contexto no meio da reprodução — e com o contexto ainda suspenso o elemento
// seguia avançando no silêncio, cortando o início de cada fala.
async function startAnalyser(audio: HTMLAudioElement): Promise<void> {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return; // Web Audio indisponível — orb fica no idle, áudio toca normalmente
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const source = audioCtx.createMediaElementSource(audio);
    const node = audioCtx.createAnalyser();
    node.fftSize = 256;
    source.connect(node);
    node.connect(audioCtx.destination);
    sourceNode = source;
    analyser = node;
    analyserData = new Uint8Array(new ArrayBuffer(node.frequencyBinCount));

    const loop = () => {
      if (!analyser || !analyserData) return;
      analyser.getByteFrequencyData(analyserData);
      const n = analyserData.length;
      const bassEnd = Math.floor(n * 0.35);
      let bassSum = 0;
      let trebleSum = 0;
      for (let i = 0; i < bassEnd; i++) bassSum += analyserData[i];
      for (let i = bassEnd; i < n; i++) trebleSum += analyserData[i];
      const volume = bassSum / bassEnd / 255;
      const treble = trebleSum / (n - bassEnd) / 255;
      setLevel(volume, treble);
      levelRaf = requestAnimationFrame(loop);
    };
    loop();
  } catch {
    // best-effort — sem análise, o orb só fica no wobble idle enquanto fala
  }
}

function stopAnalyser(): void {
  cancelAnimationFrame(levelRaf);
  analyser?.disconnect();
  sourceNode?.disconnect();
  analyser = null;
  sourceNode = null;
  analyserData = null;
  setLevel(0, 0);
}

// Espera o elemento ter áudio suficiente bufferizado pra tocar sem engasgo.
// Sem isso o play() era chamado com readyState=0 (nada carregado): a reprodução
// começava, travava num 'waiting' por alguns milissegundos e só então engatava —
// o corte breve no início de quase toda fala. O timeout evita que a voz fique
// presa caso o evento não venha (áudio inválido, codec sem suporte).
function waitUntilBuffered(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= 4 /* HAVE_ENOUGH_DATA */) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      audio.removeEventListener('canplaythrough', done);
      audio.removeEventListener('error', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    audio.addEventListener('canplaythrough', done);
    audio.addEventListener('error', done);
  });
}

type ChatResult = { text?: string; affectedKeys?: string[] };

/**
 * Lê o corpo SSE do chat. Formato mínimo (`event:` + `data:` separados por
 * linha em branco) — não vale trazer uma lib pra três tipos de evento.
 *
 * O buffer existe porque um chunk da rede não respeita fronteira de frame:
 * pode chegar meio evento, ou dois e meio de uma vez. Só o que está antes do
 * último `\n\n` é processável.
 */
async function consumeSseChat(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<ChatResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ChatResult = {};
  let failure: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const eventLine = frame.split('\n').find((l) => l.startsWith('event:'));
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice(6).trim();
      let payload: { text?: string; affectedKeys?: string[]; error?: string };
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      if (event === 'delta' && payload.text) onDelta?.(payload.text);
      else if (event === 'done') result = { text: payload.text, affectedKeys: payload.affectedKeys };
      else if (event === 'error') failure = payload.error ?? 'Erro no JARVIS.';
    }
  }

  // Erro depois dos headers já enviados chega como evento, não como status —
  // por isso ele só vira exceção aqui, no fim da leitura.
  if (failure) throw new Error(failure);
  return result;
}

export const jarvisService = {
  getHistory(): ChatMessage[] {
    return storageAdapter.getItem<ChatMessage[]>(HISTORY_KEY) ?? [];
  },

  addMessage(role: 'user' | 'assistant', content: string, hasImage = false): ChatMessage {
    const msg: ChatMessage = { id: genId(), role, content, timestamp: new Date().toISOString(), ...(hasImage ? { hasImage } : {}) };
    const history = this.getHistory();
    history.push(msg);
    storageAdapter.setItem(HISTORY_KEY, history.slice(-MAX_HISTORY));
    return msg;
  },

  /** Guarda os bytes da foto em memória, ligados à mensagem que a carrega. */
  rememberImage(messageId: string, image: ChatImage): void {
    lastImage = { messageId, image };
  },

  removeMessage(id: string): void {
    const history = this.getHistory().filter((m) => m.id !== id);
    storageAdapter.setItem(HISTORY_KEY, history);
  },

  clearHistory(): void {
    storageAdapter.setItem(HISTORY_KEY, []);
  },

  /**
   * Manda a mensagem e devolve o texto final.
   *
   * Com `onDelta`, consome a resposta em streaming (SSE) e chama o callback a
   * cada pedaço — é o que faz o painel mostrar o texto nascendo em vez de um
   * spinner. O timeout sobe para 2min porque o ponto do streaming é justamente
   * caber trabalho que não cabia nos 30s de antes.
   */
  async sendMessage(userText: string, onDelta?: (delta: string) => void): Promise<string> {
    // Caller is responsible for adding the user message optimistically via addMessage()
    const history = this.getHistory();

    // A foto só acompanha enquanto a mensagem dela estiver no recorte recente;
    // depois disso os bytes são soltos, senão ficariam na memória da aba até o
    // próximo reload sem nunca mais serem usados.
    const recent = new Set(history.slice(-IMAGE_WINDOW).map((m) => m.id));
    if (lastImage && !recent.has(lastImage.messageId)) lastImage = null;
    const attached = lastImage;

    const body = JSON.stringify({
      messages: history.map((m) => ({
        role: m.role,
        content: m.content,
        ...(attached && attached.messageId === m.id ? { image: attached.image } : {}),
      })),
    });

    const response = await fetch(apiUrl('/api/jarvis/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(onDelta ? { Accept: 'text/event-stream' } : {}),
      },
      body,
      signal: AbortSignal.timeout(onDelta ? 120_000 : 30_000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }

    const isStream = response.headers.get('content-type')?.includes('text/event-stream');
    const data = isStream && response.body
      ? await consumeSseChat(response.body, onDelta)
      : await response.json();

    const text: string = data.text ?? '';
    if (Array.isArray(data.affectedKeys) && data.affectedKeys.length > 0) {
      await Promise.all((data.affectedKeys as string[]).map(refreshKey));
    }
    this.addMessage('assistant', text);
    return text;
  },

  // Fala um texto com a voz do Jarvis (Azure via backend). Best-effort.
  async speak(text: string): Promise<void> {
    const clean = text?.trim();
    if (!clean) return;
    try {
      this.stopSpeaking();
      const response = await fetch(apiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.slice(0, 5000) }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // Carrega o áudio inteiro de cara — o blob já está em memória, o custo é só
      // decodificar, e é isso que precisa estar pronto antes do play().
      audio.preload = 'auto';
      currentAudio = audio;
      audio.onplay = () => setSpeaking(true);
      const finish = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        setSpeaking(false);
        stopAnalyser();
      };
      audio.onended = finish;
      // Sem isto, uma falha no meio da reprodução nunca emitia "parou de falar":
      // o orb ficava preso em "falando" e o modo voz nunca voltava a escutar.
      audio.onerror = finish;
      await startAnalyser(audio);
      // Se outra fala começou (ou stopSpeaking rodou) enquanto o analisador
      // conectava, este áudio já não é o atual — não toca por cima.
      if (currentAudio !== audio) return;
      await waitUntilBuffered(audio);
      // Mesma checagem de novo: esperar o buffer é outra janela em que a fala
      // pode ter sido substituída ou interrompida.
      if (currentAudio !== audio) return;
      await audio.play();
    } catch {
      // voz é opcional — falha silenciosa não quebra o chat
      setSpeaking(false);
      stopAnalyser();
    }
  },

  isSpeaking(): boolean {
    return currentAudio !== null;
  },

  stopSpeaking(): void {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    setSpeaking(false);
    stopAnalyser();
  },

  /** Assina mudanças de estado "falando" (áudio do Jarvis tocando). Retorna função de unsubscribe. */
  onSpeakingChange(cb: (speaking: boolean) => void): () => void {
    speakingListeners.add(cb);
    return () => speakingListeners.delete(cb);
  },

  /** Assina o nível de volume (grave/médio, 0–1) e energia de agudos (0–1) do áudio em reprodução. */
  onAudioLevel(cb: (volume: number, treble: number) => void): () => void {
    levelListeners.add(cb);
    return () => levelListeners.delete(cb);
  },
};
