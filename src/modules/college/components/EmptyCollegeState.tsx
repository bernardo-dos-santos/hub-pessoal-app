type EmptyCollegeStateProps = {
  description?: string;
  title: string;
};

export function EmptyCollegeState({ description, title }: EmptyCollegeStateProps) {
  return (
    <section className="py-10 text-center">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--hub-muted)' }}>{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          {description}
        </p>
      ) : null}
    </section>
  );
}
