import { type ReactNode } from 'react';
import { Card } from '../../../../shared/ui';

type FinanceChartCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function FinanceChartCard({ action, children, description, title }: FinanceChartCardProps) {
  return (
    <Card className="mb-5">
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: '16px' }}>
        <div>
          <p
            className="font-medium uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '4px' }}
          >
            {title}
          </p>
          {description ? (
            <p style={{ fontSize: '11px', color: 'var(--hub-disabled)' }}>{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export function FinanceChartEmptyState({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', paddingTop: '16px', paddingBottom: '16px', lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

