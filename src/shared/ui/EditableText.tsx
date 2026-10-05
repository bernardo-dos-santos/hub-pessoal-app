import { useEffect, useRef, useState, type ReactNode } from 'react';

type EditableTextProps = {
  value: string;
  /** Só chamado quando o texto realmente mudou e não ficou vazio. */
  onSave: (value: string) => void;
  /** O rótulo como já é renderizado hoje — cor, tamanho e truncamento ficam com quem chama. */
  children: ReactNode;
  /** Ex.: "Renomear tarefa". Vira o aria-label do lápis e do campo. */
  ariaLabel: string;
  /** Classes de layout do wrapper (ex.: `min-w-0 flex-1`). */
  className?: string;
  /** Classes do input em modo edição — use as mesmas do rótulo para não pular. */
  inputClassName?: string;
};

/**
 * Rótulo que vira campo de texto para renomear no lugar.
 *
 * O gatilho é um lápis ao lado, não o clique no próprio texto: em várias telas
 * o título já mora dentro de um `<Link>` ou de um botão (abrir projeto, concluir
 * tarefa), e transformar o texto em alvo de edição roubaria esse clique. Um
 * controle separado nunca colide com o que a linha já fazia.
 *
 * A discrição vem do CSS (`.hub-editable` / `.hub-edit-pencil` em global.css):
 * só no hover onde há hover, visível e apagado onde não há — no APK não existe
 * hover, e um lápis puramente de hover seria uma função que o celular não tem.
 *
 * Enter e sair do campo salvam; Esc cancela. Texto vazio ou igual ao anterior
 * não salva — renomear para nada é sempre engano, e gravar mesmo assim geraria
 * um evento de alteração falso.
 */
export function EditableText({ value, onSave, children, ariaLabel, className, inputClassName }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function start() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) return;
    onSave(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName ?? className}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        // O campo pode estar dentro de um <Link> (o card inteiro de projeto é
        // um), e aí clicar para posicionar o cursor navegaria para fora levando
        // a edição junto. Vale para o clique e para o mousedown, que é quem o
        // React Router usa em alguns casos.
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setEditing(false);
          }
        }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <span className={`hub-editable inline-flex min-w-0 items-baseline gap-1.5${className ? ` ${className}` : ''}`}>
      {children}
      <button
        type="button"
        // Mesmo motivo do input: dentro de um <Link>, o clique no lápis
        // navegaria em vez de (só) abrir a edição.
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          start();
        }}
        aria-label={ariaLabel}
        title={ariaLabel}
        className="hub-edit-pencil shrink-0 text-[10px]"
        style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
      >
        ✎
      </button>
    </span>
  );
}
