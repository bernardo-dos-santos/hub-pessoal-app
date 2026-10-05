import { type ReactNode } from 'react';

type FinanceAlertTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type FinanceAlertBoxProps = {
  children: ReactNode;
  tone?: FinanceAlertTone;
};

const toneColor: Record<FinanceAlertTone, string> = {
  danger: 'var(--hub-negative)',
  info: 'color-mix(in srgb, var(--hub-accent) 85%, transparent)',
  neutral: 'var(--hub-subtle)',
  success: 'var(--hub-positive)',
  warning: 'var(--hub-warning)',
};

export function FinanceAlertBox({ children, tone = 'neutral' }: FinanceAlertBoxProps) {
  return (
    <p style={{ fontSize: '12px', color: toneColor[tone], lineHeight: 1.6 }}>
      {children}
    </p>
  );
}
