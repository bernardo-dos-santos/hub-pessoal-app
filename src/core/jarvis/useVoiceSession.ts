import { useEffect, useRef, useState } from 'react';
import { jarvisService } from './jarvisService';
import { useJarvisSpeaking } from './useJarvisSpeaking';

export type VoiceState =
  | 'listening' | 'thinking' | 'speaking'
  | 'unsupported' | 'denied' | 'error' | 'timeout';

export const VOICE_STATE_LABEL: Record<VoiceState, string> = {
  listening: 'ouvindo…',
  thinking: 'pensando…',
  speaking: 'falando… — toque para interromper',
  unsupported: 'reconhecimento de voz indisponível neste navegador — toque para tentar de novo',
  denied: 'permissão de microfone negada — toque para tentar de novo',
  error: 'algo falhou — tentando de novo…',
  timeout: 'não consegui te ouvir — toque para tentar de novo (ou use Chrome)',
};

// Alguns navegadores (Opera, Brave, Vivaldi…) expõem `webkitSpeechRecognition`
// mas não têm o backend de reconhecimento do Google por trás — o `start()`
// nunca gera resultado nem erro, fica "ouvindo" pra sempre. Esse timeout evita
// travar o usuário nesse limbo sem feedback algum.
const LISTEN_TIMEOUT_MS = 12_000;

// No Android (WebView/Chrome mobile), o backend de reconhecimento finaliza
// segmento por palavra/frase curta mesmo com continuous=true — trata pausa
// entre palavras como fim de fala. Sem esse debounce, o primeiro `isFinal`
// já disparava o envio e cortava a frase na primeira palavra. Espera esse
// tempo de silêncio real (sem novo resultado, final ou parcial) antes de
// considerar que a pessoa terminou de falar.
const SILENCE_DEBOUNCE_MS = 1_000;

/**
 * Espera entre o fim da fala do Jarvis e voltar a ACEITAR o que se ouve.
 *
 * O microfone nunca chega a fechar (é o que mantém a palavra de parada
 * alcançável); esta janela só descarta o rabo do áudio, que ainda está saindo
 * do alto-falante quando o `onended` do elemento já disparou.
 *
 * Era 500ms e comeu o começo de frases ditas logo após ele calar — respondi
 * rápido demais e perdi as primeiras palavras. 250ms cobre o rabo do
 * alto-falante sem truncar a conversa.
 */
const MIC_REOPEN_DELAY_MS = 250;

/**
 * Chamar o Jarvis pelo nome corta a fala dele.
 *
 * Casa por VARIANTE, não por igualdade: o reconhecimento em pt-BR raramente
 * acerta "Jarvis". Ditando, o próprio Bernardo produziu "Jarobs", "Jarves" e
 * "Jarvis" em três tentativas seguidas. Comparar com a string exata falharia
 * justo na hora em que a palavra mais importa. Daí "token curto começando com
 * jar" — pega todas elas.
 */
const STOP_WORD_RE = /^jar[a-z]{0,5}$/;

/**
 * Teto de palavras para valer como interrupção.
 *
 * É o que separa você do eco: o eco é sempre longo (a resposta inteira
 * voltando pelo alto-falante), então mesmo que o Jarvis diga o próprio nome no
 * meio de uma frase, aquilo chega como bloco grande e não dispara nada. Chamar
 * ele pelo nome é curto por natureza.
 */
const STOP_WORD_MAX_TOKENS = 3;

export function isStopCommand(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.length > STOP_WORD_MAX_TOKENS) return false;
  return tokens.some((t) => STOP_WORD_RE.test(t));
}

/**
 * O loop de conversa por voz: ouve (STT) → envia ao Jarvis → fala a resposta
 * (TTS) → volta a ouvir.
 *
 * `enabled` é o interruptor da sessão: ligar monta o reconhecimento e começa a
 * ouvir; desligar encerra tudo (é o mesmo cleanup de antes, agora disparado por
 * dependência em vez de desmontagem).
 *
 * Esse parâmetro existe porque quem chama este hook deixou de ser a TELA e
 * passou a ser o `JarvisVoiceProvider`, que vive no AppLayout e não desmonta ao
 * trocar de rota. Antes, o dono era o orb da Home: sair da Home desmontava o
 * componente e matava a conversa no meio. Agora a tela é só uma vista da
 * sessão — quem estiver montado mostra, quem não estiver não interrompe nada.
 *
 * Chame-o em UM lugar só. Duas instâncias significam dois reconhecimentos
 * disputando o mesmo microfone.
 */
export function useVoiceSession(enabled = true) {
  const speaking = useJarvisSpeaking();
  const [state, setState] = useState<VoiceState>('listening');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const closedRef = useRef(false);
  const processingRef = useRef(false);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Acumula os segmentos `isFinal` da fala atual entre eventos onresult —
  // no Android eles chegam em pedaços, não numa frase só.
  const finalBufferRef = useRef('');
  // false enquanto estiver num estado "sem saída" (timeout, permissão negada) —
  // impede que o onend do reconhecimento reabra a escuta sozinho por baixo dessas telas.
  const autoRestartRef = useRef(true);
  // true a partir do momento em que o áudio da resposta REALMENTE começou a tocar.
  // Sem isso não dá pra distinguir "ainda não falou" de "acabou de falar".
  const speechStartedRef = useRef(false);
  // Os handlers do reconhecimento são registrados uma vez e enxergariam sempre
  // o `state` da primeira renderização. Este ref é o estado ATUAL para eles.
  const stateRef = useRef<VoiceState>('listening');

  function clearListenTimeout() {
    if (listenTimeoutRef.current !== null) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
  }

  function scheduleListenTimeout() {
    clearListenTimeout();
    listenTimeoutRef.current = setTimeout(() => {
      if (closedRef.current || processingRef.current) return;
      autoRestartRef.current = false;
      recognitionRef.current?.abort();
      setState('timeout');
    }, LISTEN_TIMEOUT_MS);
  }

  function clearSubmitDebounce() {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  // Reagenda a cada segmento final novo — só envia de fato depois de um
  // período sem nenhum resultado novo (final ou parcial), sinal de que a
  // pessoa realmente parou de falar, não só fez uma pausa entre palavras.
  function scheduleSubmit() {
    clearSubmitDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const text = finalBufferRef.current.trim();
      finalBufferRef.current = '';
      if (text) void handleFinalTranscript(text);
    }, SILENCE_DEBOUNCE_MS);
  }

  function startListening() {
    if (closedRef.current || processingRef.current) return;
    autoRestartRef.current = true;
    setState('listening');
    setTranscript('');
    finalBufferRef.current = '';
    clearSubmitDebounce();
    try {
      recognitionRef.current?.start();
      scheduleListenTimeout();
    } catch (err) {
      // InvalidStateError ("já estava rodando") é esperado e inofensivo — o
      // reconhecimento já está ativo, só ignora. Qualquer outro erro aqui
      // deixava a tela presa em "ouvindo…" pra sempre sem nenhum feedback
      // (start() nunca dispara onerror/onend nesse caso) — agora loga e
      // mostra estado de erro em vez de engolir silenciosamente.
      if (err instanceof DOMException && err.name === 'InvalidStateError') return;
      console.error('[voz] recognition.start() falhou:', err);
      setState('error');
    }
  }

  /** Corta a fala em andamento e volta a ouvir. Nunca encerra a conversa. */
  function interruptSpeech() {
    jarvisService.stopSpeaking();
    // Zera o que o eco tinha acumulado até aqui — senão ele seria enviado como
    // se fosse a primeira coisa dita depois da interrupção.
    speechStartedRef.current = false;
    processingRef.current = false;
    finalBufferRef.current = '';
    clearSubmitDebounce();
    startListening();
  }

  /**
   * Toque no orb: durante a fala, interrompe e volta a ouvir (barge-in);
   * num estado sem saída (timeout, erro, permissão negada), tenta de novo.
   */
  function retry() {
    if (state === 'speaking') {
      interruptSpeech();
      return;
    }
    if (state === 'listening' || state === 'thinking') return;
    startListening();
  }

  async function handleFinalTranscript(text: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    clearListenTimeout();
    // O reconhecimento continua RODANDO enquanto ele pensa e fala — é o que
    // permite ouvir "Jarvis" e cortar a fala.
    //
    // Já tentei o contrário (abort() aqui, para fechar o microfone durante a
    // resposta) e foi um erro: sem microfone aberto, a palavra de parada não
    // tinha como ser ouvida, e a interrupção por voz simplesmente não
    // acontecia. Quem protege do eco é o filtro no `onresult`, não o
    // fechamento do microfone.
    setState('thinking');
    jarvisService.addMessage('user', text);
    try {
      const reply = await jarvisService.sendMessage(text);
      setState('speaking');
      await jarvisService.speak(reply);
      if (!jarvisService.isSpeaking()) {
        // TTS falhou ou terminou antes de qualquer transição de estado — não
        // espera o efeito de `speaking` (que nunca vai disparar) pra voltar a ouvir.
        processingRef.current = false;
        startListening();
      }
    } catch {
      processingRef.current = false;
      setState('error');
      setTimeout(startListening, 800);
    }
  }

  useEffect(() => { stateRef.current = state; }, [state]);

  // Volta a ouvir assim que a fala do Jarvis termina de tocar.
  //
  // Só reage à transição REAL de falando → calado. Antes bastava `!speaking`, e
  // como `setState('speaking')` acontece antes do áudio existir (o TTS ainda está
  // sendo baixado), o efeito disparava no mesmo instante com speaking=false: o
  // microfone reabria ANTES do Jarvis emitir som, captava a voz dele mesmo como
  // se fosse fala do usuário e mandava uma nova mensagem — cujo speak() chama
  // stopSpeaking() e cortava a fala em andamento no meio.
  useEffect(() => {
    if (speaking) {
      speechStartedRef.current = true;
      return;
    }
    if (speechStartedRef.current && processingRef.current && state === 'speaking') {
      speechStartedRef.current = false;
      // A pausa antes de reabrir cobre o rabo do áudio: `onended` do elemento
      // dispara quando o buffer acaba, mas no celular ainda há um atraso até o
      // som deixar de sair do alto-falante. Reabrir no mesmo instante fazia o
      // microfone pegar as últimas sílabas da própria resposta.
      const timer = setTimeout(() => {
        processingRef.current = false;
        startListening();
      }, MIC_REOPEN_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [speaking, state]);

  useEffect(() => {
    if (!enabled) return;

    // O cleanup abaixo marca closedRef=true, mas em dev o StrictMode roda
    // efeito → cleanup → efeito na MESMA instância (refs sobrevivem): sem este
    // reset, a segunda montagem via closedRef=true e startListening() retornava
    // antes de chamar recognition.start() — orb preso em "ouvindo…" sem nunca
    // escutar, sem erro e sem timeout. Vale igual ao religar a sessão.
    closedRef.current = false;
    processingRef.current = false;
    autoRestartRef.current = true;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setState('unsupported');
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    // continuous=false fazia o Chrome encerrar a sessão sozinho após poucos
    // segundos de silêncio percebido — bem menos que nosso timeout de 12s.
    // O onend reiniciava a escuta na hora, reagendando o timeout do zero:
    // loop silencioso que nunca dava tempo do timeout disparar nem de uma
    // fala completa ser capturada, mesmo com o microfone ativo de verdade.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (e) => {
      // Terceira rodada de diagnóstico (logs 2026-08-12): tentar deduzir
      // reemissão por prefixo (chunk.startsWith(final)) ainda duplicava em
      // frases longas — o Android às vezes faz uma "segunda passada" de
      // reconhecimento no fim da fala e reemite a frase inteira de novo,
      // porém reescrita (ex.: sem uma palavra inicial), deixando de ser um
      // prefixo exato do que já tínhamos. Qualquer tentativa de comparar
      // texto é frágil contra isso. Dentro de uma mesma sessão de escuta
      // contínua, cada resultado final novo é sempre a versão mais completa
      // da fala até ali — nunca um pedaço genuinamente separado que precise
      // ser somado (é por isso que existe o buffer/debounce: a fala inteira
      // já cabe num único resultado final crescente). Por isso: não
      // concatena nada, só usa sempre o ÚLTIMO resultado final do evento,
      // descartando por completo as versões anteriores.
      // Nada que chegue enquanto o Jarvis pensa ou fala é o Senhor: é o próprio
      // alto-falante voltando pelo microfone. No celular isso não é hipótese —
      // o histórico de 2026-08-15 tem a resposta dele reaparecendo como
      // mensagem do usuário, desde a PRIMEIRA palavra, prova de que o
      // microfone seguiu aberto durante a fala inteira (`recognition.stop()`
      // encerra a frase no Android, não a captura).
      //
      // O buffer também é zerado: sem isso, o eco acumulado seria enviado no
      // instante em que `processingRef` liberasse, que é exatamente como o bug
      // se manifestava.
      //
      // Interromper o Jarvis falando continua possível — tocando o orb
      // (`retry`), que é explícito e não pode ser disparado por acústica.
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const chunk = result[0].transcript.trim();
        if (result.isFinal) {
          if (chunk) final = chunk;
        } else {
          interim = chunk;
        }
      }

      if (processingRef.current) {
        // A ÚNICA coisa que atravessa a fala do Jarvis: chamá-lo pelo nome.
        // Curto e conhecido, não tem como sair do alto-falante por acidente.
        // Vale só enquanto ele fala — enquanto pensa não há o que interromper.
        if (stateRef.current === 'speaking' && isStopCommand(final || interim)) {
          interruptSpeech();
          return;
        }
        finalBufferRef.current = '';
        clearSubmitDebounce();
        return;
      }
      finalBufferRef.current = final;
      setTranscript(`${finalBufferRef.current} ${interim}`.trim());
      // Ainda falando (resultado parcial) — adia o timeout total e segura o
      // envio: o segmento final que acabou de chegar era só uma pausa entre
      // palavras, não o fim da fala.
      if (interim) {
        scheduleListenTimeout();
        clearSubmitDebounce();
      } else if (final) {
        scheduleSubmit();
      }
    };

    recognition.onerror = (e) => {
      clearListenTimeout();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        autoRestartRef.current = false;
        setState('denied');
        return;
      }
      if (!closedRef.current && !processingRef.current) {
        // Mesmo risco do onend (ver comentário lá): se havia fala pendente
        // esperando o debounce de silêncio, startListening() abaixo limpava
        // finalBufferRef e descartava pra sempre. onerror é comumente seguido
        // de onend no mesmo ciclo de encerramento — sem essa checagem aqui
        // também, um erro nesse meio-tempo (ex. 'network' no Android) tinha o
        // mesmo efeito de nunca deixar nada ser enviado.
        if (debounceRef.current !== null) {
          clearSubmitDebounce();
          const text = finalBufferRef.current.trim();
          finalBufferRef.current = '';
          if (text) {
            void handleFinalTranscript(text);
            return;
          }
        }
        setState('error');
        setTimeout(startListening, 500);
      }
    };

    recognition.onend = () => {
      clearListenTimeout();
      if (closedRef.current || !autoRestartRef.current) return;

      // Enquanto ele pensa/fala, o Android encerra segmentos sozinho. Religa
      // em silêncio — sem mexer no estado nem nos buffers — só para manter o
      // microfone vivo e a palavra de parada alcançável. O `onresult` continua
      // descartando tudo que não for o nome, então isso não reabre a porta do
      // eco.
      if (processingRef.current) {
        try { recognition.start(); } catch { /* já rodando: nada a fazer */ }
        return;
      }


      // A sessão terminou sozinha (comum no Android — é por isso que o
      // debounce de silêncio existe). Se tinha fala pendente esperando
      // confirmar silêncio real, não descarta: envia agora. Sem isto,
      // startListening() abaixo limpava finalBufferRef e cancelava o
      // debounce a cada reinício, perdendo a fala pra sempre — o usuário
      // falava e nada nunca chegava a ser enviado.
      if (debounceRef.current !== null) {
        clearSubmitDebounce();
        const text = finalBufferRef.current.trim();
        finalBufferRef.current = '';
        if (text) {
          void handleFinalTranscript(text);
          return;
        }
      }

      startListening();
    };

    startListening();

    return () => {
      closedRef.current = true;
      clearListenTimeout();
      clearSubmitDebounce();
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      jarvisService.stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só `enabled` liga/desliga; handleFinalTranscript/startListening usam refs, não precisam entrar nas deps
  }, [enabled]);

  return { state, transcript, retry, label: VOICE_STATE_LABEL[state] };
}
