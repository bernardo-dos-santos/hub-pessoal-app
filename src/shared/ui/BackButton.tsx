import { useNavigate } from 'react-router-dom';

/**
 * Seta de voltar (←) no topo do conteúdo — comportamento estilo navegador
 * (history.back com fallback para a Home). Presente em todos os módulos.
 */
export function BackButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  return (
    <button
      type="button"
      aria-label="Voltar"
      onClick={goBack}
      className={`transition-opacity hover:opacity-70 ${className}`}
      style={{
        width: '34px',
        height: '34px',
        display: 'flex',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--hub-muted)',
        fontSize: '21px',
        lineHeight: 1,
        padding: 0,
      }}
    >
      ←
    </button>
  );
}
