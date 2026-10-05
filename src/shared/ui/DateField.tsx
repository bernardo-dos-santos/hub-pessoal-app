import { useRef, type ReactNode } from 'react';

type DateFieldProps = {
  /** `YYYY-MM-DD` para `date`, `YYYY-MM` para `month`. String vazia = sem valor. */
  value: string;
  onChange: (value: string) => void;
  type?: 'date' | 'month';
  /** Rótulo visível — o texto/estilo é decidido por quem usa. */
  children: ReactNode;
  /** Classes de layout do `<label>` (ex.: `shrink-0`). */
  className?: string;
  ariaLabel: string;
};

/**
 * Campo de data com o seletor nativo escondido atrás de um rótulo de texto.
 *
 * Por que existe: expor `<input type="date">` cru renderiza a caixa do sistema,
 * que ignora todo token do design system (mesmo motivo do `Select`). A saída é
 * sobrepor o input com `opacity-0` sobre um `<span>` estilizado.
 *
 * O detalhe que fazia o campo parecer quebrado: sobrepor o input NÃO basta. O
 * clique chega nele, mas clicar no corpo de um input de data não abre o
 * calendário — só o ícone abre, e o ícone está invisível junto com o resto.
 * Resultado: rótulo que aceita o clique e não faz nada. Era o bug do "+ prazo"
 * em Projetos (não abria nem no navegador nem no APK). `showPicker()` abre o
 * seletor de qualquer ponto do rótulo, que é o comportamento esperado.
 *
 * O `onClick` fica no input, não no `<label>`: como o input cobre a área toda
 * (`inset-0`), o clique sempre pousa nele e dispara uma vez só. No label, a
 * devolução nativa do clique para o controle rotulado dispararia o handler duas
 * vezes — a mesma armadilha documentada no `Select`.
 */
export function DateField({ value, onChange, type = 'date', children, className, ariaLabel }: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    // showPicker existe em Chrome/WebView 99+. Sem ele, o clique ainda foca o
    // input e o teclado continua editando — degrada, não quebra.
    if (!input || typeof input.showPicker !== 'function') return;
    try {
      input.showPicker();
    } catch {
      // Fora de gesto do usuário ou em iframe cross-origin. Nada a fazer.
    }
  }

  return (
    <label className={`relative cursor-pointer${className ? ` ${className}` : ''}`}>
      {children}
      <input
        ref={inputRef}
        className="absolute inset-0 cursor-pointer opacity-0"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openPicker}
        aria-label={ariaLabel}
      />
    </label>
  );
}
