type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="px-5 py-12 text-center">
      <h2 className="text-base font-medium" style={{ color: 'var(--hub-muted)' }}>{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--hub-subtle)' }}>{description}</p> : null}
    </section>
  );
}
