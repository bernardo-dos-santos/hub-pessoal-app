import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { studyContentService } from '../services/studyContentService';
import { studyChatService } from '../services/studyChatService';
import { aiChatService } from '../services/aiChatService';
import { aiQuestionService } from '../services/aiQuestionService';
import { questionService } from '../services/questionService';
import { MarkdownView } from '../components/MarkdownView';
import { SelectionPopover, type SelectionAction } from '../components/SelectionPopover';
import { StudyChatPanel } from '../components/StudyChatPanel';
import type { StudyContent } from '../types/content';
import type { ChatMessage } from '../types/chat';
import type { Question } from '../types/question';
import { DIFFICULTY_LABEL } from '../types/question';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type Tab = 'content' | 'chat';

const SPLIT_KEY = 'hub.reader.splitPercent';
const MIN_PCT = 20;
const MAX_PCT = 80;

/** Formata questões geradas como Markdown para exibição no chat. */
function formatQuestionsMarkdown(questions: Question[]): string {
  const lines: string[] = [`### 📝 ${questions.length} questão(ões) para resolver`, ''];

  questions.forEach((q, i) => {
    const diff = DIFFICULTY_LABEL[q.difficulty];
    lines.push('---', '');
    lines.push(`**Questão ${i + 1}** &nbsp;·&nbsp; _${diff}_`, '');
    lines.push(q.statement, '');
    q.options.forEach((opt, idx) => {
      const isLast = idx === q.options.length - 1;
      lines.push(`**${opt.letter}.** ${opt.text}${isLast ? '' : '  '}`);
    });
    lines.push('');
  });

  lines.push('---', '', '### 📋 Gabarito', '');
  questions.forEach((q, i) => {
    const exp = q.explanation ? ` — ${q.explanation}` : '';
    lines.push(`**${i + 1}.** Correta: **${q.correctOption}**${exp}`, '');
  });

  return lines.join('\n');
}

export function StudyReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [content, setContent] = useState<StudyContent | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('content');
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0);

  // ── Painel redimensionável ────────────────────────────────────────────────
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    const saved = storageAdapter.getItem<string>(SPLIT_KEY);
    return saved ? Math.min(MAX_PCT, Math.max(MIN_PCT, Number(saved))) : 50;
  });
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const isDragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleDividerMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    }
    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    storageAdapter.setItem(SPLIT_KEY, String(splitPercent));
  }, [splitPercent]);

  useEffect(() => {
    if (!id) { navigate('/estudos/resumos'); return; }
    const c = studyContentService.getById(id);
    if (!c) { navigate('/estudos/resumos'); return; }
    setContent(c);
  }, [id, navigate]);

  if (!content) return null;

  const summary = content.summary ?? content.rawText ?? '';

  // ── Ações de seleção ─────────────────────────────────────────────────────
  async function handleSelectionAction(text: string, action: SelectionAction) {
    if (action === 'question') {
      setSnippet(text);
      setActiveTab('chat');
      return;
    }

    if (action === 'questions') {
      setLoadingLabel('Gerando questões...');
      setActiveTab('chat');
      try {
        const newQuestions = await aiQuestionService.generateQuestions({
          sourceText: text,
          subjectTag: content!.subjectTag,
          count: 3,
          difficulty: 'mixed',
          examStyle: 'generico',
          contentId: content!.id,
        });

        const saved = questionService.addMany(newQuestions);

        const questionsMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          text: formatQuestionsMarkdown(saved),
          createdAt: new Date().toISOString(),
          snippet: text.slice(0, 80),
        };
        studyChatService.addMessage(content!.id, questionsMsg);

        const bankMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          text: `✅ **${saved.length} questão(ões) adicionada(s) ao banco de questões.** Acesse _Estudos → Questões_ para revisá-las a qualquer momento.`,
          createdAt: new Date().toISOString(),
        };
        studyChatService.addMessage(content!.id, bankMsg);
        setChatRefreshTrigger((t) => t + 1);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Erro desconhecido';
        const errMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          text: `⚠️ Não foi possível gerar questões sobre este trecho.\n\n_Motivo: ${detail}_\n\nTente selecionar um trecho maior ou com mais conteúdo conceitual.`,
          createdAt: new Date().toISOString(),
        };
        studyChatService.addMessage(content!.id, errMsg);
        setChatRefreshTrigger((t) => t + 1);
      } finally {
        setLoadingLabel(null);
      }
      return;
    }

    const actionLabel = action === 'explain_simple' ? '🔤 Explique mais simples' : '💡 Dê um exemplo';
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      text: actionLabel,
      createdAt: new Date().toISOString(),
      snippet: text,
    };
    studyChatService.addMessage(content!.id, userMsg);
    setChatRefreshTrigger((t) => t + 1);
    setActiveTab('chat');

    setLoadingLabel(action === 'explain_simple' ? 'Simplificando...' : 'Criando exemplo...');
    try {
      const responseText = await aiChatService.quickAction({ summary, snippet: text, action });
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        text: responseText,
        createdAt: new Date().toISOString(),
      };
      studyChatService.addMessage(content!.id, assistantMsg);
    } catch {
      const errMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        text: 'Erro ao conectar com a IA. Tente novamente.',
        createdAt: new Date().toISOString(),
      };
      studyChatService.addMessage(content!.id, errMsg);
    } finally {
      setChatRefreshTrigger((t) => t + 1);
      setLoadingLabel(null);
    }
  }

  const HEADER_H = 56;

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--hub-bg)' }}>
      {/* Header */}
      <header
        style={{ height: HEADER_H, borderBottom: '1px solid var(--hub-border)', background: 'var(--hub-bg)' }}
        className="flex shrink-0 items-center gap-3 px-4"
      >
        <button
          onClick={() => navigate('/estudos/resumos')}
          className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{content.title}</p>
        </div>
        <span className="shrink-0 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {content.subjectTag}
        </span>

        {/* Mobile tabs */}
        <div className="flex md:hidden">
          <button
            onClick={() => setActiveTab('content')}
            className="px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'content' ? 'var(--hub-accent)' : 'transparent'}`,
              color: activeTab === 'content' ? 'var(--hub-accent)' : 'var(--hub-subtle)',
              cursor: 'pointer',
            }}
          >
            Resumo
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className="px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'chat' ? 'var(--hub-accent)' : 'transparent'}`,
              color: activeTab === 'chat' ? 'var(--hub-accent)' : 'var(--hub-subtle)',
              cursor: 'pointer',
            }}
          >
            Tutor {loadingLabel && '⏳'}
          </button>
        </div>
      </header>

      {/* Body — flex com divisor arrastável no desktop */}
      <div
        ref={bodyRef}
        className="flex flex-1 overflow-hidden"
        style={{ height: `calc(100vh - ${HEADER_H}px)` }}
      >
        {/* Coluna de conteúdo */}
        <div
          ref={contentAreaRef}
          onContextMenu={(e) => e.preventDefault()}
          style={isDesktop ? { width: `${splitPercent}%` } : undefined}
          className={`relative overflow-y-auto px-6 py-6 ${
            activeTab === 'content' ? 'block w-full md:block' : 'hidden md:block'
          }`}
        >
          {summary ? (
            <>
              <MarkdownView content={summary} />
              <SelectionPopover
                containerRef={contentAreaRef}
                onAction={handleSelectionAction}
                isLoading={!!loadingLabel}
              />
            </>
          ) : (
            <p className="text-center mt-12" style={{ color: 'var(--hub-subtle)' }}>
              Nenhum resumo gerado. Vá em Resumos e gere o conteúdo primeiro.
            </p>
          )}
        </div>

        {/* Divisor arrastável — só desktop */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors group"
          style={{ background: 'var(--hub-border)' }}
          title="Arraste para redimensionar"
        >
          <div className="h-8 w-0.5 rounded-full" style={{ background: 'var(--hub-border-strong)' }} />
        </div>

        {/* Coluna do chat */}
        <div
          style={isDesktop ? { width: `${100 - splitPercent}%` } : undefined}
          className={`${activeTab === 'chat' ? 'block w-full' : 'hidden md:block'}`}
        >
          <StudyChatPanel
            contentId={content.id}
            summary={summary}
            snippet={snippet}
            onClearSnippet={() => setSnippet(null)}
            refreshTrigger={chatRefreshTrigger}
            externalLoadingLabel={loadingLabel}
          />
        </div>
      </div>
    </div>
  );
}
