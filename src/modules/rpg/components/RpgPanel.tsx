import { type ReactNode, useState } from 'react';
import { Card } from '../../../shared/ui';

type RpgPanelProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  meta?: ReactNode;
  title: string;
};

export function RpgPanel({ children, defaultOpen = true, meta, title }: RpgPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between gap-3 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: isOpen ? '16px' : 0 }}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{isOpen ? 'v' : '>'}</span>
          <span
            className="truncate font-medium uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}
          >
            {title}
          </span>
        </span>
        {meta ? <span className="shrink-0 text-xs" style={{ color: 'var(--hub-subtle)' }}>{meta}</span> : null}
      </button>
      {isOpen ? <div className="grid gap-3">{children}</div> : null}
    </Card>
  );
}
