import { Link } from 'react-router-dom';

const stepTitle = { color: 'var(--hub-text)' } as const;
const stepText = { color: 'var(--hub-text-body)' } as const;

const STEPS: { title: string; text: string; to?: string; action?: string }[] = [
  {
    title: 'Importe o extrato',
    text: 'Baixe o extrato da conta e a fatura do cartão no app do banco (CSV ou PDF) e mande para o Olimpo. Ele separa as transações, sugere as categorias e aprende com o que você corrigir.',
    to: '/financeiro/configurar/importar',
    action: 'Importar agora',
  },
  {
    title: 'Ative as notificações do banco no e-mail',
    text: 'No app do banco, ligue o aviso por e-mail de compras e Pix. Quando a leitura do seu Gmail chegar ao Olimpo, cada aviso vira um lançamento sozinho — sem senha do banco em lugar nenhum.',
  },
  {
    title: 'Revise o que ficar em dúvida',
    text: 'O que o Olimpo não souber classificar vai para Financeiro → Revisar, um toque por transação.',
  },
];

/**
 * Where the Finance module's data comes from: the bank statement the person
 * imports, and (once Google is per user) their bank's notification e-mails.
 * There is no bank login — Open Finance through Pluggy was dropped in 2026-11
 * after it failed even for the owner. Used by the first access and by
 * Configurações → Conexões, so both always say the same.
 */
export function FinanceConnectionSetup() {
  return (
    <ol className="flex flex-col">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-3 py-3"
          style={{ borderBottom: index === STEPS.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
        >
          <span className="tabular-nums text-sm font-medium" style={{ color: 'var(--hub-accent)', minWidth: '1.25rem' }}>
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={stepTitle}>{step.title}</p>
            <p className="mt-1 text-sm leading-6" style={stepText}>{step.text}</p>
            {step.to && (
              <Link to={step.to} className="mt-1 inline-block text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
                {step.action} →
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
