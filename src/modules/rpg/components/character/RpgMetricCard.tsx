type RpgMetricCardProps = {
  label: string;
  value: number | string;
};

export function RpgMetricCard({ label, value }: RpgMetricCardProps) {
  return (
    <article className="py-1">
      <h3 style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>{label}</h3>
      <strong className="mt-1 block text-3xl tabular-nums" style={{ fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>{value}</strong>
    </article>
  );
}
