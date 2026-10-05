import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { Components } from 'react-markdown';
import { FunctionPlotChart } from './FunctionPlotChart';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-6 text-xl font-semibold" style={{ color: 'var(--hub-text)' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-medium" style={{ color: 'var(--hub-text)' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-4 text-base font-medium" style={{ color: 'var(--hub-text-strong)' }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed" style={{ color: 'var(--hub-text-body)' }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5" style={{ color: 'var(--hub-text-body)' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5" style={{ color: 'var(--hub-text-body)' }}>{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--hub-text)' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: 'var(--hub-text-body)' }}>{children}</em>
  ),
  // Blocos de código — detecta `plot` para renderizar gráfico
  pre: ({ children }) => {
    // Extrai o elemento <code> de dentro do <pre>
    const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = codeEl?.props?.className ?? '';
    if (className === 'language-plot') {
      const spec = String(codeEl?.props?.children ?? '');
      return <FunctionPlotChart spec={spec} />;
    }
    return (
      <pre className="mb-3 overflow-x-auto p-4" style={{ background: 'var(--hub-border)' }}>{children}</pre>
    );
  },
  code: ({ children, className }) => {
    // Inline code (sem className) ou bloco normal
    const isBlock = Boolean(className?.startsWith('language-'));
    if (isBlock) {
      return (
        <code className="block overflow-x-auto p-4 font-mono text-sm" style={{ background: 'var(--hub-border)', color: 'var(--hub-text-body)' }}>
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 font-mono text-xs" style={{ background: 'var(--hub-border)', color: 'var(--hub-positive)' }}>
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 italic" style={{ borderLeft: '2px solid var(--hub-border-strong)', color: 'var(--hub-text-body)' }}>
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm text-left border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium" style={{ borderBottom: '1px solid var(--hub-border-strong)', color: 'var(--hub-text)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2" style={{ borderBottom: '1px solid var(--hub-border)', color: 'var(--hub-text-body)' }}>{children}</td>
  ),
  hr: () => <hr className="my-6 border-0" style={{ height: '1px', background: 'var(--hub-border)' }} />,
};

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
