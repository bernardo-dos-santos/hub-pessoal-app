import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';

type SelectOptionProps = {
  value: string;
  children: ReactNode;
  disabled?: boolean;
};

/** Marcador de dado — nunca renderizado diretamente, só lido pelo `Select` pai. */
function Option(_props: SelectOptionProps) {
  return null;
}

type ExtractedOption = { value: string; label: ReactNode; disabled?: boolean };

function extractOptions(children: ReactNode): ExtractedOption[] {
  const options: ExtractedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<SelectOptionProps>(child) || child.type !== Option) return;
    options.push({ value: child.props.value, label: child.props.children, disabled: child.props.disabled });
  });
  return options;
}

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
};

/**
 * Substitui o `<select>` nativo em todo o hub: o dropdown nativo do Windows
 * ignora o design system (aparência "Windows XP" ao abrir a lista), então o
 * painel de opções aqui é um flutuante Terracota (mesmo tratamento de sombra
 * e superfície dos outros menus/popovers do app).
 * API espelha `<select>`/`<option>` pra migração ser um find-and-replace.
 *
 * O gatilho é um `<div role="button">`, não um `<button>` real: várias
 * páginas envolvem o Select num `<label>` (convenção de label acima do
 * input), e `<button>` é um elemento "labelable" — um clique real disparava
 * o toggle duas vezes (clique direto + reenvio nativo do `<label>` pro
 * controle), abrindo e fechando no mesmo clique. `<div>` não é labelable,
 * então o `<label>` não reenvia o clique.
 */
export function Select({
  value,
  onChange,
  children,
  className = '',
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = extractOptions(children);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="flex w-full items-center justify-between gap-2 pb-1.5 text-sm outline-none transition-colors"
        style={{
          background: 'transparent',
          borderBottom: `1px solid ${open ? 'var(--hub-primary)' : 'var(--hub-border-strong)'}`,
          color: current ? 'var(--hub-text)' : 'var(--hub-disabled)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span className="min-w-0 truncate text-left">{current?.label ?? ''}</span>
        <span
          style={{
            color: 'var(--hub-subtle)',
            fontSize: '10px',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </div>

      {open && (
        <div
          role="listbox"
          className="hub-select-panel absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto py-1"
          style={{
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            borderRadius: '10px',
            boxShadow: 'var(--hub-shadow-menu)',
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setOpen(false);
              }}
              className={`hub-select-option truncate px-3 py-2 text-sm ${opt.value === value ? 'active' : ''}`}
              style={{
                color: opt.value === value ? 'var(--hub-primary-strong)' : 'var(--hub-text-body)',
                background: opt.value === value ? 'rgba(193, 99, 61, 0.1)' : 'transparent',
                fontWeight: opt.value === value ? 500 : 400,
                cursor: opt.disabled ? 'default' : 'pointer',
                opacity: opt.disabled ? 0.4 : 1,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Select.Option = Option;
