import type React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Components } from 'react-markdown';

/**
 * Renderiza um trecho de texto com suporte a LaTeX (KaTeX) e Markdown inline
 * (negrito, itálico, código, listas). Pensado para enunciados, alternativas,
 * dicas, explicações e flashcards que vivem dentro de cartões compactos.
 *
 * Diferente de MarkdownView (usado em páginas inteiras de resumo), o MathText
 * não aplica margens grandes nem cores fixas — herda a cor/tamanho do elemento
 * pai via `className`, então combina com o estilo de cada cartão.
 *
 * - inline: renderiza o parágrafo como fragmento (sem <p>), para o texto fluir
 *   ao lado de prefixos como "A)". Use nas alternativas.
 */
interface MathTextProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /** Renderiza inline (sem <p> de bloco), para fluir ao lado de outros elementos. */
  inline?: boolean;
}

const baseComponents: Components = {
  strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--hub-text)' }}>{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = Boolean(className?.startsWith('language-'));
    if (isBlock) {
      return (
        <code className="block overflow-x-auto p-3 font-mono text-xs" style={{ background: 'var(--hub-border)' }}>
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 font-mono text-[0.9em]" style={{ background: 'var(--hub-border)' }}>{children}</code>
    );
  },
};

const blockComponents: Components = {
  ...baseComponents,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
};

const inlineComponents: Components = {
  ...baseComponents,
  // Sem <p> de bloco: flui inline ao lado de "A)", "💡", etc.
  p: ({ children }) => <>{children}</>,
};

export function MathText({ content, className, style, inline = false }: MathTextProps) {
  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={inline ? inlineComponents : blockComponents}
    >
      {content}
    </ReactMarkdown>
  );

  // Wrapper inline usa <span> (válido ao lado de texto); bloco usa <div>.
  return inline ? (
    <span className={className} style={style}>{markdown}</span>
  ) : (
    <div className={className} style={style}>{markdown}</div>
  );
}
