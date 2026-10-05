type RpgReviewCardProps = {
  note: string;
  onConfirm: () => void;
  title: string;
};

export function RpgReviewCard({ note, onConfirm, title }: RpgReviewCardProps) {
  return (
    <article className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
      <h3 className="text-sm font-medium" style={{ color: 'var(--hub-warning)' }}>{title}</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{note}</p>
      <button
        className="mt-2 text-xs font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
        type="button"
        onClick={onConfirm}
      >
        ✓ Marcar revisado
      </button>
    </article>
  );
}
