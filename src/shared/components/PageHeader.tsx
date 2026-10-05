type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="space-y-2" style={{ marginBottom: '8px' }}>
      {eyebrow ? (
        <span
          className="font-semibold uppercase"
          style={{ fontSize: '10.5px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}
        >
          {eyebrow}
        </span>
      ) : null}
      <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>{title}</h1>
      {description ? <p className="max-w-2xl text-sm leading-6" style={{ color: 'var(--hub-muted)' }}>{description}</p> : null}
    </section>
  );
}
