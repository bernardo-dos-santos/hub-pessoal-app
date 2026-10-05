import { formatDate as formatSharedDate } from '../../../shared/utils/formatDate';
import { type ClassificationConfidence, type TransactionKind, type TransactionMethod } from '../types/finance';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(value: string | Date) {
  return formatSharedDate(value);
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: 'percent',
  }).format(value / 100);
}

const transactionKindLabels: Record<TransactionKind, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência interna',
  card_purchase: 'Compra no cartão',
  card_payment: 'Pagamento de fatura',
  card_payment_received: 'Pagamento recebido da fatura',
  refund: 'Estorno/Reembolso',
  review: 'Revisão',
  investment_contribution: 'Aporte em investimento',
  investment_withdrawal: 'Resgate de investimento',
};

// Rótulo separado de formatTransactionKind de propósito: `method` (instrumento
// de pagamento) e `kind` (natureza do lançamento) são dois eixos diferentes —
// reaproveitar o mesmo rótulo genérico ("Tipo") pros dois é o que fazia o
// `method` nunca aparecer distinto do `kind` na tela.
const transactionMethodLabels: Record<TransactionMethod, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
  fatura: 'Fatura',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
};

const confidenceLabels: Record<ClassificationConfidence, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function formatTransactionKind(kind: TransactionKind) {
  return transactionKindLabels[kind];
}

export function formatTransactionMethod(method: TransactionMethod) {
  return transactionMethodLabels[method];
}

export function formatClassificationConfidence(confidence: ClassificationConfidence) {
  return confidenceLabels[confidence];
}
