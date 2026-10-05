import { useEffect, useRef, useState } from 'react';

export type SelectionAction = 'question' | 'explain_simple' | 'example' | 'questions';

interface Position {
  top: number;
  left: number;
}

interface SelectionPopoverProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onAction: (snippet: string, action: SelectionAction) => void;
  isLoading?: boolean;
}

const ACTIONS: { key: SelectionAction; label: string }[] = [
  { key: 'question', label: '💬 Perguntar' },
  { key: 'explain_simple', label: '🔤 Mais simples' },
  { key: 'example', label: '💡 Exemplo' },
  { key: 'questions', label: '❓ Gerar questões' },
];

export function SelectionPopover({ containerRef, onAction, isLoading = false }: SelectionPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [snippet, setSnippet] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // Ignore clicks inside the popover itself
      if (popoverRef.current?.contains(e.target as Node)) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';

      if (!text || !containerRef.current?.contains(selection?.anchorNode ?? null)) {
        setVisible(false);
        return;
      }

      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSnippet(text);
      setPosition({
        top: rect.top + window.scrollY - 52,
        left: rect.left + rect.width / 2,
      });
      setVisible(true);
    }

    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setVisible(false);
    }

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef]);

  if (!visible) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        background: 'var(--hub-card)',
        border: '1px solid var(--hub-border-strong)',
        borderRadius: '10px',
        boxShadow: 'var(--hub-shadow-menu)',
      }}
      className="fixed z-50 flex items-center gap-1 px-2 py-1.5"
    >
      {isLoading ? (
        <span className="flex items-center gap-1.5 px-3 py-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: 'var(--hub-subtle)' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: 'var(--hub-subtle)' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: 'var(--hub-subtle)' }} />
          Processando...
        </span>
      ) : (
        ACTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              onAction(snippet, key);
              setVisible(false);
              window.getSelection()?.removeAllRanges();
            }}
            className="whitespace-nowrap px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: 'var(--hub-text-body)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {label}
          </button>
        ))
      )}
    </div>
  );
}
