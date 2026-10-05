import { useState, useEffect, useRef } from 'react';
import { jarvisService, type ChatMessage, type ChatImage } from './jarvisService';
import { takePhotoForChat } from './camera';
import { jarvisInboxService, type InboxItem } from './jarvisInbox';
import { VoiceOrb } from './VoiceOrb';
import { Orb } from './Orb';
import { useJarvisVoice } from './JarvisVoiceContext';
import { storageAdapter } from '../storage/storage.adapter';
import { apiUrl } from '../config/backendConfig';
import { consumePendingShare, isShareTargetAvailable } from './shareTarget';
import { reportLocation } from './location';

const INBOX_KIND_ICON: Record<InboxItem['kind'], string> = {
  observation: '👁',
  action_taken: '✓',
  question: '?',
  task_result: '☑',
};

function InboxRow({ item, onDismiss, onUndo }: { item: InboxItem; onDismiss: () => void; onUndo: () => void }) {
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid var(--hub-border)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '12px', marginTop: '1px' }}>{INBOX_KIND_ICON[item.kind]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', color: 'var(--hub-text)', lineHeight: 1.4 }}>{item.title}</p>
        {item.body && (
          <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '2px', lineHeight: 1.4 }}>{item.body}</p>
        )}
        <div className="flex items-center gap-3" style={{ marginTop: '4px' }}>
          {item.kind === 'action_taken' && item.undo && (
            <button
              onClick={onUndo}
              className="transition-opacity hover:opacity-70"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-accent)', fontWeight: 500 }}
            >
              desfazer
            </button>
          )}
          <button
            onClick={onDismiss}
            className="transition-opacity hover:opacity-60"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-subtle)' }}
          >
            marcar como lida
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tipos de pendência que a fila do servidor produz (jarvis/commands.js). */
type PendingKind = 'shell' | 'google' | 'sync';

type PendingCommand = {
  id: string;
  /** Ausente nos itens gravados antes da Fase 11 — tratados como 'shell'. */
  kind?: PendingKind;
  command: string;
  why: string | null;
  status: string;
  expiresAt: string;
};

const APPROVE_LABEL: Record<PendingKind, string> = {
  shell: 'aprovar e rodar',
  google: 'aprovar e executar',
  sync: 'aprovar e disparar',
};

/**
 * Um pedido esperando aprovação.
 *
 * O conteúdo aparece LITERAL e sem truncar: você aprova o que está vendo, não
 * um resumo do que o Jarvis diz que vai fazer. É esse o ponto inteiro da fila.
 *
 * Monoespaçado só para shell — num comando, cada caractere importa e o
 * `break-all` evita que uma linha longa vaze do painel. E-mail e evento são
 * prosa: com a mesma formatação, o corpo saía quebrado no meio das palavras e
 * ficava mais difícil de ler exatamente o que você precisa conferir antes de
 * aprovar.
 */
function PendingCommandRow({ cmd, onApprove, onReject, busy }: {
  cmd: PendingCommand;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const minutosRestantes = Math.max(0, Math.round((new Date(cmd.expiresAt).getTime() - Date.now()) / 60000));
  const kind: PendingKind = cmd.kind ?? 'shell';
  const isShell = kind === 'shell';
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--hub-border)' }}>
      {cmd.why && (
        <p style={{ fontSize: '11px', color: 'var(--hub-text-body)', lineHeight: 1.4, marginBottom: '4px' }}>
          {cmd.why}
        </p>
      )}
      <pre
        style={{
          fontSize: '11px',
          fontFamily: isShell ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          lineHeight: isShell ? 1.4 : 1.5,
          color: 'var(--hub-text)',
          background: 'var(--hub-surface-muted)',
          borderRadius: '8px',
          padding: '6px 8px',
          margin: 0,
          maxHeight: '220px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: isShell ? 'break-all' : 'break-word',
        }}
      >
        {cmd.command}
      </pre>
      <div className="flex items-center gap-3" style={{ marginTop: '5px' }}>
        <button
          onClick={onApprove}
          disabled={busy}
          className="transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-accent)', fontWeight: 500 }}
        >
          {busy ? 'executando…' : APPROVE_LABEL[kind]}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-negative)' }}
        >
          recusar
        </button>
        <span style={{ fontSize: '10px', color: 'var(--hub-subtle)' }}>
          expira em {minutosRestantes} min
        </span>
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  'O que devo fazer agora?',
  'Como estou indo essa semana?',
  'Tenho algo urgente?',
  'Minha situação financeira',
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom: '10px' }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: '14px',
          fontSize: '13px',
          lineHeight: '1.5',
          background: isUser ? 'rgba(193,99,61,0.13)' : 'rgba(58,44,34,0.05)',
          color: isUser ? 'var(--hub-text)' : 'var(--hub-text-body)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {/* A miniatura não sobrevive ao reload (os bytes ficam só em memória —
            ver jarvisService), então a marca é textual: some do olho, mas não
            some do histórico. */}
        {msg.hasImage && (
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--hub-subtle)', marginBottom: '3px' }}>
            ⌾ foto anexada
          </span>
        )}
        {msg.content}
      </div>
    </div>
  );
}

export function JarvisChat() {
  const [open, setOpen] = useState(false);
  // `voiceExpanded` é só a VISTA em tela cheia. Quem sabe se há conversa
  // acontecendo é o contexto global — ver JarvisVoiceContext.
  const [voiceExpanded, setVoiceExpanded] = useState(false);
  const voice = useJarvisVoice();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Texto chegando por streaming, antes de virar mensagem no histórico.
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(
    () => storageAdapter.getItem<boolean>('jarvis.voiceEnabled') ?? true,
  );
  const [unreadInbox, setUnreadInbox] = useState<InboxItem[]>(() => jarvisInboxService.unread());
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [busyCommandId, setBusyCommandId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ChatImage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMessages(jarvisService.getHistory());
      setUnreadInbox(jarvisInboxService.unread());
      void refreshCommands();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Enquanto o painel está aberto, olha a fila de tempos em tempos: um comando
  // pode ter sido pedido por uma tarefa em background, não pela conversa atual.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void refreshCommands(), 10_000);
    return () => clearInterval(t);
  }, [open]);

  async function refreshCommands() {
    try {
      const r = await fetch(apiUrl('/api/jarvis/commands'));
      if (!r.ok) return;
      const d = await r.json();
      setPendingCommands((d.commands ?? []).filter((c: PendingCommand) => c.status === 'pending'));
    } catch {
      // Sem servidor, some a seção — não vale mostrar erro por isso.
    }
  }

  async function decideCommand(id: string, decision: 'approve' | 'reject') {
    setBusyCommandId(id);
    try {
      await fetch(apiUrl(`/api/jarvis/commands/${id}/${decision}`), { method: 'POST' });
      await refreshCommands();
      // Aprovar gera um item de caixa de entrada com a saída do comando.
      if (decision === 'approve') setUnreadInbox(jarvisInboxService.unread());
    } finally {
      setBusyCommandId(null);
    }
  }

  function dismissInboxItem(id: string) {
    jarvisInboxService.markRead(id);
    setUnreadInbox(jarvisInboxService.unread());
  }

  function undoInboxItem(id: string) {
    jarvisInboxService.undo(id);
    setUnreadInbox(jarvisInboxService.unread());
  }

  // Abre o chat de texto ou o modo voz a partir de outro componente (ex.: orb da Home).
  useEffect(() => {
    const openHandler = () => setOpen(true);
    const voiceHandler = () => { voice.start(); setVoiceExpanded(true); };
    window.addEventListener('jarvis:open', openHandler);
    window.addEventListener('jarvis:voice-open', voiceHandler);
    return () => {
      window.removeEventListener('jarvis:open', openHandler);
      window.removeEventListener('jarvis:voice-open', voiceHandler);
    };
  }, []);

  /**
   * "Compartilhar → Hub Pessoal" no Android (Fase 13): abre o painel com o
   * conteúdo já na caixa, sem mandar. Quem decide o que perguntar sobre o link
   * é o Senhor — mandar sozinho adivinharia a intenção e gastaria uma chamada
   * para quase sempre a pergunta errada.
   *
   * Consulta ao montar (app aberto pelo compartilhamento) e a cada volta para
   * primeiro plano (app já estava aberto — o Android traz a Activity de volta,
   * o que dispara visibilitychange).
   */
  useEffect(() => {
    if (!isShareTargetAvailable()) return;

    const check = async () => {
      const shared = await consumePendingShare();
      if (!shared) return;
      setOpen(true);
      setInput((prev) => (prev.trim() ? `${prev.replace(/\s*$/, '')}\n\n${shared}` : shared));
    };

    void check();
    const onVisibility = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /**
   * Posição do aparelho (Fase 13) — no mesmo ritmo do compartilhamento: ao
   * abrir e a cada volta para primeiro plano. O `reportLocation` tem trava
   * própria de intervalo e de capacidade, então chamar à toa não custa nada.
   */
  useEffect(() => {
    void reportLocation();
    const onVisibility = () => { if (document.visibilityState === 'visible') void reportLocation(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingText]);

  /**
   * Abre câmera ou galeria e prende a foto até o Senhor escrever a pergunta.
   *
   * Sem focus() programático depois de anexar: no WebView do Android ele dá
   * foco ao campo sem abrir o teclado, e um campo focado que não aceita
   * digitação confunde mais do que ajuda. Tocar no campo resolve — e é o que
   * qualquer um faz por instinto.
   */
  async function attachPhoto() {
    const taken = await takePhotoForChat();
    if (taken) setPhoto(taken);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    setStreamingText('');

    // Optimistic: add user message immediately
    const optimistic = jarvisService.addMessage('user', trimmed, !!photo);
    if (photo) {
      // Os bytes ficam só na memória do serviço; o histórico guarda a marca.
      jarvisService.rememberImage(optimistic.id, photo);
      setPhoto(null);
    }
    setMessages(jarvisService.getHistory());

    try {
      const reply = await jarvisService.sendMessage(trimmed, (delta) => {
        setStreamingText((prev) => prev + delta);
      });
      setMessages(jarvisService.getHistory());
      // A fala só começa com o texto completo. Disparar por pedaço picotaria a
      // voz — e o TTS cobra por caractere, então seria caro além de feio.
      if (voiceEnabled) void jarvisService.speak(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com JARVIS');
      jarvisService.removeMessage(optimistic.id);
      setMessages(jarvisService.getHistory());
    } finally {
      setLoading(false);
      // Só depois de `messages` já conter a resposta definitiva — limpar antes
      // deixaria um piscar com a bolha vazia entre o fim do stream e o render.
      setStreamingText('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function toggleVoice() {
    setVoiceEnabled((v) => {
      const next = !v;
      storageAdapter.setItem('jarvis.voiceEnabled', next);
      if (!next) jarvisService.stopSpeaking();
      return next;
    });
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Tela cheia é uma VISTA da conversa, não a conversa. Fechar aqui só
          recolhe — quem encerra é o "encerrar" ou a pílula abaixo. Era esse o
          engano do desenho antigo: fechar a tela desmontava a sessão. */}
      {voiceExpanded && voice.active && (
        <VoiceOrb onCollapse={() => setVoiceExpanded(false)} onStop={() => { voice.stop(); setVoiceExpanded(false); }} />
      )}

      {/* Pílula de conversa ativa — a prova visível de que a fala continua
          enquanto você navega, e o jeito de encerrar de qualquer tela. Fica à
          ESQUERDA para nunca dividir espaço com o ✦ nem com o painel. */}
      {voice.active && !voiceExpanded && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '20px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '7px 12px',
            borderRadius: 'var(--hub-radius-pill)',
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            boxShadow: 'var(--hub-shadow-menu)',
          }}
        >
          {/* O corpo da pílula faz o que o próprio rótulo promete: durante a
              fala, "toque para interromper" interrompe. Antes ele expandia a
              tela cheia e exigia um segundo toque para então interromper —
              o texto dizia uma coisa e o botão fazia outra.

              Mesmo significado do orb em qualquer lugar do app: mexe na FALA.
              Quem mexe na CONVERSA é o × ao lado. A tela cheia continua
              acessível pelo microfone no cabeçalho do painel. */}
          <button
            onClick={voice.retry}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
            aria-label={`Jarvis: ${voice.label}`}
          >
            <Orb size={20} />
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
              {voice.label}
            </span>
          </button>
          <button
            onClick={voice.stop}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1, color: 'var(--hub-negative)' }}
            aria-label="Encerrar a conversa por voz"
          >
            ×
          </button>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="JARVIS — Assistente pessoal"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '20px',
          zIndex: 1000,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '22px',
          color: open ? 'var(--hub-primary)' : 'var(--hub-primary-strong)',
          lineHeight: 1,
          padding: '4px',
          transition: 'color 0.2s',
          userSelect: 'none',
        }}
      >
        ✦
        {unreadInbox.length > 0 && (
          <span
            className="tabular-nums"
            style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              minWidth: '15px',
              height: '15px',
              padding: '0 3px',
              borderRadius: '999px',
              background: 'var(--hub-accent)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 600,
              lineHeight: '15px',
              textAlign: 'center',
            }}
          >
            {unreadInbox.length}
          </span>
        )}
      </button>

      {/* Painel de chat */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '64px',
            right: '20px',
            width: 'min(360px, calc(100vw - 32px))',
            height: '480px',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            borderRadius: '24px',
            boxShadow: 'var(--hub-shadow-modal)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--hub-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--hub-primary)' }}>✦ JARVIS</span>
              <span style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Assistente pessoal
              </span>
            </div>

            {/* Controles de voz vivem AQUI, não soltos na tela. Enquanto eram
                botões fixos em `bottom: 68px` e `116px`, ficavam dentro da área
                do painel (que abre em `bottom: 64px`) e, com zIndex maior,
                eram desenhados POR CIMA das mensagens. */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { voice.start(); setVoiceExpanded(true); }}
                title="Falar com o Jarvis"
                aria-label="Falar com o Jarvis"
                style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, padding: 0, color: voice.active ? 'var(--hub-primary)' : 'var(--hub-muted)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </button>
              <button
                onClick={toggleVoice}
                title={voiceEnabled ? 'Voz do Jarvis: ligada' : 'Voz do Jarvis: desligada'}
                aria-label={voiceEnabled ? 'Desligar a voz do Jarvis' : 'Ligar a voz do Jarvis'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}
              >
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
              <button
                onClick={() => { jarvisService.clearHistory(); setMessages([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Comandos esperando aprovação — antes das Novidades de propósito:
              é o único item do painel que exige uma decisão sua agora. */}
          {pendingCommands.length > 0 && (
            // Teto de altura com rolagem própria: três pedidos pendentes de uma
            // vez chegariam a mais de 480px sozinhos e empurrariam o resto do
            // painel para fora. Rolar aqui dentro é melhor do que sumir com o
            // campo de escrita.
            <div style={{ padding: '10px 16px 2px', borderBottom: '1px solid var(--hub-border)', flexShrink: 0, maxHeight: '45%', overflowY: 'auto' }}>
              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--hub-warning)' }}>
                Aguardando sua aprovação
              </span>
              <div className="mt-1">
                {pendingCommands.map((cmd) => (
                  <PendingCommandRow
                    key={cmd.id}
                    cmd={cmd}
                    busy={busyCommandId === cmd.id}
                    onApprove={() => void decideCommand(cmd.id, 'approve')}
                    onReject={() => void decideCommand(cmd.id, 'reject')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Novidades — observações e ações que o Jarvis registrou sozinho */}
          {unreadInbox.length > 0 && (
            // Mesmo teto: a caixa de novidades acumula texto longo do tick e
            // sozinha já ocupava quase o painel inteiro.
            <div style={{ padding: '10px 16px 2px', borderBottom: '1px solid var(--hub-border)', flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }}>
              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
                Novidades
              </span>
              <div className="mt-1">
                {unreadInbox.map((item) => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    onDismiss={() => dismissInboxItem(item.id)}
                    onUndo={() => undoInboxItem(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Mensagens */}
          {/* Esta é a única área que cede espaço quando o painel aperta. Não
              precisa de `minHeight: 0`: a regra do flexbox que impede um filho
              de encolher abaixo do conteúdo só vale para overflow visível, e
              aqui já é `auto`. */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {isEmpty && !loading && (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--hub-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                  Pergunte qualquer coisa sobre sua rotina, estudos ou finanças.
                </p>
                <div className="flex flex-col gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="text-left text-sm transition-opacity hover:opacity-70"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-primary)', padding: '2px 0' }}
                    >
                      → {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {streamingText && (
              <MessageBubble msg={{ id: 'streaming', role: 'assistant', content: streamingText, timestamp: '' }} />
            )}

            {/* "Pensando" só até o primeiro pedaço de texto chegar — depois
                disso o próprio texto nascendo já é o indicador de progresso. */}
            {loading && !streamingText && (
              <div style={{ padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--hub-muted)' }}>JARVIS está pensando…</span>
              </div>
            )}

            {error && (
              <p style={{ fontSize: '11px', color: 'var(--hub-negative)', marginTop: '8px' }}>{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts (após ter mensagens) */}
          {!isEmpty && !loading && (
            <div
              style={{
                borderTop: '1px solid var(--hub-border)',
                padding: '8px 16px',
                display: 'flex',
                gap: '10px',
                overflowX: 'auto',
              }}
            >
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'var(--hub-subtle)',
                    whiteSpace: 'nowrap',
                    padding: '2px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    transition: 'color 0.15s',
                  }}
                  className="hover:opacity-70"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Foto anexada, esperando a pergunta */}
          {photo && (
            <div
              className="flex items-center gap-3"
              style={{ borderTop: '1px solid var(--hub-border)', padding: '10px 16px 0', flexShrink: 0 }}
            >
              <img
                src={`data:${photo.mediaType};base64,${photo.data}`}
                alt="Foto anexada"
                style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--hub-border)' }}
              />
              <span className="flex-1" style={{ fontSize: '11px', color: 'var(--hub-muted)' }}>
                Foto anexada. Escreva o que quer saber sobre ela.
              </span>
              <button
                onClick={() => setPhoto(null)}
                className="transition-opacity hover:opacity-70"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--hub-negative)' }}
              >
                remover
              </button>
            </div>
          )}

          {/* Input */}
          {/* flexShrink: 0 — o campo de escrita nunca cede espaço. É a única
              coisa do painel que precisa estar sempre alcançável. */}
          <div style={{ borderTop: '1px solid var(--hub-border)', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={attachPhoto}
              disabled={loading || !!photo}
              aria-label="Anexar foto"
              className="transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', lineHeight: 1, color: 'var(--hub-subtle)' }}
            >
              ⌾
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={photo ? 'O que quer saber da foto?' : 'Pergunte algo…'}
              disabled={loading}
              className="flex-1 bg-transparent pb-1 text-sm outline-none disabled:opacity-40"
              style={{ borderBottom: '1px solid var(--hub-border-strong)', color: 'var(--hub-text)' }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="text-base font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-primary)' }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
