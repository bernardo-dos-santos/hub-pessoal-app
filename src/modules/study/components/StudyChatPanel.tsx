import { useEffect, useRef, useState } from 'react';
import { studyChatService } from '../services/studyChatService';
import { aiChatService } from '../services/aiChatService';
import { MarkdownView } from './MarkdownView';
import type { ChatMessage } from '../types/chat';

interface StudyChatPanelProps {
  contentId: string;
  summary: string;
  snippet: string | null;
  onClearSnippet: () => void;
  refreshTrigger?: number;
  /** Label do loading externo (ação vinda da seleção), ex: "Gerando questões..." */
  externalLoadingLabel?: string | null;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function StudyChatPanel({
  contentId,
  summary,
  snippet,
  onClearSnippet,
  refreshTrigger,
  externalLoadingLabel,
}: StudyChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(studyChatService.listMessages(contentId));
  }, [contentId, refreshTrigger]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, externalLoadingLabel]);

  async function handleSend() {
    const question = input.trim();
    if (!question || isLoading || externalLoadingLabel) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      text: question,
      createdAt: new Date().toISOString(),
      snippet: snippet ?? undefined,
    };

    studyChatService.addMessage(contentId, userMsg);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    onClearSnippet();
    setIsLoading(true);

    try {
      const text = await aiChatService.ask({
        summary,
        history: messages,
        snippet,
        question,
      });

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        text,
        createdAt: new Date().toISOString(),
      };

      studyChatService.addMessage(contentId, assistantMsg);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const errMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        text: `⚠️ Erro ao chamar a IA: _${detail}_`,
        createdAt: new Date().toISOString(),
      };
      studyChatService.addMessage(contentId, errMsg);
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    studyChatService.clear(contentId);
    setMessages([]);
  }

  const busy = isLoading || !!externalLoadingLabel;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--hub-border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>🤖 Tutor IA</p>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Limpar conversa
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {messages.length === 0 && !externalLoadingLabel && (
          <p className="mt-8 text-center text-sm" style={{ color: 'var(--hub-subtle)' }}>
            Selecione um trecho do resumo ou faça uma pergunta abaixo.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] text-sm leading-relaxed"
              style={
                msg.role === 'user'
                  ? {
                      color: 'var(--hub-text-strong)',
                      borderRight: '2px solid color-mix(in srgb, var(--hub-accent) 55%, transparent)',
                      paddingRight: '12px',
                      textAlign: 'right',
                    }
                  : { color: 'var(--hub-text-body)' }
              }
            >
              {msg.snippet && (
                <p className="mb-1.5 pb-1.5 text-xs opacity-70" style={{ borderBottom: '1px solid var(--hub-border-strong)' }}>
                  📌 "{msg.snippet.slice(0, 60)}{msg.snippet.length > 60 ? '…' : ''}"
                </p>
              )}
              {msg.role === 'assistant' ? (
                <MarkdownView content={msg.text} className="text-sm" />
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {/* Loading externo (ação da seleção) */}
        {externalLoadingLabel && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--hub-subtle)' }}>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: 'var(--hub-subtle)' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: 'var(--hub-subtle)' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: 'var(--hub-subtle)' }} />
              </span>
              {externalLoadingLabel}
            </div>
          </div>
        )}

        {/* Loading interno (digitou e enviou) */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--hub-subtle)' }}>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: 'var(--hub-subtle)' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: 'var(--hub-subtle)' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: 'var(--hub-subtle)' }} />
              </span>
              Pensando...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Snippet chip + Input */}
      <div className="space-y-2 px-4 py-3" style={{ borderTop: '1px solid var(--hub-border)' }}>
        {snippet && (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-xs" style={{ color: 'var(--hub-warning)' }}>
              📌 {snippet.slice(0, 70)}{snippet.length > 70 ? '…' : ''}
            </span>
            <button
              onClick={onClearSnippet}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-warning)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-baseline gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={busy ? 'Aguarde...' : 'Faça uma pergunta...'}
            className="w-full flex-1 disabled:opacity-50"
            disabled={busy}
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {isLoading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
