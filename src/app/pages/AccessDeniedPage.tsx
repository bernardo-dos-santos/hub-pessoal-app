import { Card } from '../../shared/ui';

/** The backend answered, but not for this person (not registered, or disabled in the admin panel). */
export function AccessDeniedPage({ reason }: { reason: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4" style={{ background: 'var(--hub-bg)' }}>
      <Card hero className="w-full max-w-md">
        <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
          Olimpo
        </p>
        <h1 className="mt-2 text-xl font-medium" style={{ color: 'var(--hub-text)' }}>Acesso não liberado</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          O servidor recusou este acesso: {reason} Fale com quem administra o Olimpo para liberar.
        </p>
      </Card>
    </div>
  );
}
