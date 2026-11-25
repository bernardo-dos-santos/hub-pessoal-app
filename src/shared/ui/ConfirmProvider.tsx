import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

type ConfirmOptions = {
  confirmLabel?: string;
  /** Padrão `danger`: quase toda confirmação no Hub é de exclusão. */
  tone?: 'neutral' | 'danger';
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

type Pending = { title: string; description?: string; options: ConfirmOptions; resolve: (ok: boolean) => void };

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * `window.confirm` com a cara do Hub.
 *
 * Existe para a troca ser mecânica: o nativo era chamado no meio de handlers
 * (`if (!confirm(...)) return;`), e um `ConfirmDialog` com estado próprio em
 * cada tela obrigaria a reescrever cada um deles em dois passos. Aqui o
 * handler só vira `async` e espera a resposta:
 *
 *   const confirmAction = useConfirm();
 *   if (!(await confirmAction(`Excluir "${x}"?\n\nDetalhe.`))) return;
 *
 * Mesma convenção de texto do nativo: o primeiro parágrafo vira o título, o
 * resto (depois de uma linha em branco) vira a descrição.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirmAction = useCallback<ConfirmFn>((message, options = {}) => (
    new Promise<boolean>((resolve) => {
      const [title, ...rest] = message.split('\n\n');
      setPending({ title, description: rest.join('\n\n') || undefined, options, resolve });
    })
  ), []);

  const settle = useCallback((ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {pending && (
        <ConfirmDialog
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.options.confirmLabel ?? (pending.options.tone === 'neutral' ? 'Confirmar' : 'Excluir')}
          tone={pending.options.tone ?? 'danger'}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirmAction = useContext(ConfirmContext);
  if (!confirmAction) throw new Error('useConfirm precisa de um <ConfirmProvider> acima (AppLayout).');
  return confirmAction;
}
