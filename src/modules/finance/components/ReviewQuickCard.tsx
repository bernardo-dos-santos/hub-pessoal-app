import { useState } from 'react';
import { specialCategories } from '../data/specialCategories';
import { Card, Select } from '../../../shared/ui';
import type { Transaction } from '../types/transaction';
import { formatCurrency, formatDate, formatTransactionMethod } from '../utils/financeFormatters';
import { extractMerchant } from '../utils/financeText';

type ReviewQuickCardProps = {
  transaction: Transaction;
  suggestions: string[];
  categories: string[];
  remaining: number;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  onCategory: (category: string) => void;
  onTransfer: () => void;
  onSkip: () => void;
  onDetails: () => void;
};

const OTHER = '__other';

/**
 * One pending transaction at a time, answered with one tap: the likely
 * categories as buttons, "it's a transfer", or skip. Everything else (kind,
 * notes, installments, hand-written rules) lives in the detailed mode.
 */
export function ReviewQuickCard({
  transaction,
  suggestions,
  categories,
  remaining,
  remember,
  onRememberChange,
  onCategory,
  onTransfer,
  onSkip,
  onDetails,
}: ReviewQuickCardProps) {
  const [picking, setPicking] = useState(false);
  const merchant = extractMerchant(transaction.description).trim();
  const otherCategories = categories.filter((category) => !suggestions.includes(category));

  return (
    <Card hero className="mb-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
          {remaining} para revisar
        </span>
        <button
          type="button"
          onClick={onDetails}
          className="text-xs transition-opacity hover:opacity-60"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          editar detalhes
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="min-w-0" style={{ fontSize: '17px', fontWeight: 500, color: 'var(--hub-text)', overflowWrap: 'anywhere' }}>
          {transaction.description}
        </p>
        <strong
          className="tabular-nums"
          style={{ fontSize: '24px', fontWeight: 400, letterSpacing: '-0.02em', color: transaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
        >
          {formatCurrency(transaction.amount)}
        </strong>
      </div>
      <p className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '4px' }}>
        {formatDate(transaction.date)} · {formatTransactionMethod(transaction.method)}
        {transaction.accountName ? ` · ${transaction.accountName}` : ''}
      </p>

      <p
        className="font-medium uppercase"
        style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginTop: '24px', marginBottom: '10px' }}
      >
        {transaction.amount < 0 ? 'Foi com o quê?' : 'De onde veio?'}
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategory(category)}
            className="hub-quick-choice text-sm"
          >
            {category}
          </button>
        ))}
        <button type="button" onClick={onTransfer} className="hub-quick-choice text-sm">
          É transferência
        </button>
        {/* Money that only changes place: answering these used to need the detailed mode. */}
        {transaction.amount < 0 ? (
          <>
            <button type="button" onClick={() => onCategory(specialCategories.cardPayment)} className="hub-quick-choice text-sm">
              Paguei a fatura
            </button>
            <button type="button" onClick={() => onCategory(specialCategories.investmentContribution)} className="hub-quick-choice text-sm">
              Investi
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onCategory(specialCategories.investmentWithdrawal)} className="hub-quick-choice text-sm">
            Resgatei investimento
          </button>
        )}
        {!picking && otherCategories.length > 0 ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px' }}
          >
            outra…
          </button>
        ) : null}
      </div>
      {picking ? (
        <div className="mt-3" style={{ maxWidth: '280px' }}>
          <Select
            className="w-full"
            value={OTHER}
            onChange={(category) => {
              if (category === OTHER) return;
              setPicking(false);
              onCategory(category);
            }}
          >
            <Select.Option value={OTHER} disabled>escolha a categoria</Select.Option>
            {otherCategories.map((category) => (
              <Select.Option key={category} value={category}>{category}</Select.Option>
            ))}
          </Select>
        </div>
      ) : null}

      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--hub-border)' }}
      >
        <label className="flex items-center gap-2" style={{ cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => onRememberChange(event.target.checked)}
          />
          <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>
            Lembrar para as próximas
            {merchant ? <span style={{ color: 'var(--hub-subtle)' }}> de “{merchant}”</span> : null}
          </span>
        </label>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs transition-opacity hover:opacity-60"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          pular →
        </button>
      </div>
    </Card>
  );
}
