import { Link } from 'react-router-dom';

type EmptyFinanceStateProps = {
  title: string;
  description: string;
  action?: {
    label: string;
    to: string;
  };
};

export function EmptyFinanceState({ title, description, action }: EmptyFinanceStateProps) {
  return (
    <section style={{ paddingTop: '32px', paddingBottom: '32px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: 'var(--hub-muted)' }}>{title}</p>
      <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '8px', maxWidth: '420px', margin: '8px auto 0', lineHeight: 1.6 }}>
        {description}
      </p>
      {action && (
        <Link
          to={action.to}
          className="transition-opacity hover:opacity-70"
          style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--hub-accent)' }}
        >
          {action.label} →
        </Link>
      )}
    </section>
  );
}
