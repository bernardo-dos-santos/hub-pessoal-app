import { useState } from 'react';
import { Card, Select } from '../../../shared/ui';
import { cardService } from '../services/cardService';
import { formatMonthRange, getCurrentMonthKey, getMonthStartDay, setMonthStartDay } from '../utils/financePeriod';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const sectionTitle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
};

/**
 * Where the user picks the day their financial month starts (financeMonth.js).
 * A credit card with a closing day offers itself as a shortcut: starting the
 * month the day after the closing makes "gastei no cartão" equal the bill.
 */
export function FinancialMonthCard({ onChange }: { onChange?: () => void }) {
  const [startDay, setStartDay] = useState(getMonthStartDay);
  const creditCards = cardService
    .listCards()
    .filter((card) => card.type === 'credit' && card.isActive && card.closingDay);

  function choose(day: number) {
    setMonthStartDay(day);
    setStartDay(getMonthStartDay());
    onChange?.();
  }

  const range = formatMonthRange(getCurrentMonthKey(), startDay);

  return (
    <Card className="mb-5">
      <p style={{ ...sectionTitle, marginBottom: '12px' }}>Mês financeiro</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>Meu mês começa no dia</span>
        <Select className="w-20" value={String(startDay)} onChange={(value) => choose(Number(value))}>
          {DAYS.map((day) => (
            <Select.Option key={day} value={String(day)}>{day}</Select.Option>
          ))}
        </Select>
        <span className="text-sm tabular-nums" style={{ color: 'var(--hub-muted)' }}>
          {range ? `mês atual: ${range}` : 'mês do calendário'}
        </span>
      </div>

      {creditCards.map((card) => {
        const day = (card.closingDay! % 31) + 1;
        if (day === startDay) return null;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => choose(day)}
            className="mt-3 block text-left text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Usar o fechamento do {card.name} (começar no dia {day})
          </button>
        );
      })}

      <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-subtle)', maxWidth: '560px' }}>
        Vale para todo o Financeiro e para a Íris. Começando no dia seguinte ao fechamento do cartão, o que você gastou
        no cartão no mês é exatamente a fatura.
      </p>
    </Card>
  );
}
