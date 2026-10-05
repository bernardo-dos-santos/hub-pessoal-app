import { type ReactNode } from 'react';

type ConfirmDialogProps = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' usa --hub-negative no botão de confirmar (exclusão e afins). */
  tone?: 'neutral' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmação de ação destrutiva como card flutuante — não `window.confirm`.
 * O nativo do browser não segue o design system e, em alguns WebViews
 * (Capacitor/Android), pode nem aparecer.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'neutral',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end p-3 sm:place-items-center" style={{ background: 'rgba(58,44,34,0.35)' }}>
      <section
        className="grid w-full max-w-sm gap-4 p-5"
        style={{
          background: 'var(--hub-card)',
          borderRadius: 'var(--hub-radius-card)',
          boxShadow: 'var(--hub-shadow-menu)',
        }}
      >
        <div>
          <h2 className="text-base font-medium" style={{ color: 'var(--hub-text)' }}>{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--hub-muted)' }}>{description}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-6">
          <button
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
