import { type ParserProfile, type ParserValidationResult, type StructuredTransactionRow } from '../../types/import';
import { parseAmountFromStructuredRow } from './structuredTransactionParser';

function validateBaseRow(row: StructuredTransactionRow): ParserValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.date) {
    errors.push('Data ausente.');
  }

  if (!row.description && !row.details) {
    errors.push('Descrição ausente.');
  }

  if (
    row.amount === undefined &&
    row.value === undefined &&
    row.entryAmount === undefined &&
    row.exitAmount === undefined
  ) {
    errors.push('Valor ausente.');
  }

  if (row.amount === 0 || row.value === 0 || row.entryAmount === 0 || row.exitAmount === 0) {
    warnings.push('Valor zerado.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function getDescription(row: StructuredTransactionRow) {
  return String(row.description ?? row.details ?? '').trim();
}

function getOriginalDescription(row: StructuredTransactionRow) {
  return row.details ? `${getDescription(row)} - ${row.details}` : getDescription(row);
}

function getNubankCreditCardAmount(row: StructuredTransactionRow) {
  const parsedAmount = parseAmountFromStructuredRow(row, nubankCreditCardProfile);
  const description = getDescription(row).toLowerCase();
  const isPositiveCardMovement =
    description.includes('pagamento recebido') ||
    description.includes('estorno') ||
    description.includes('reembolso');

  return isPositiveCardMovement ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
}

export const nubankAccountProfile: ParserProfile = {
  id: 'nubank_account',
  name: 'Nubank Conta',
  source: 'nubank_account',
  defaultAccountName: 'Nubank Conta',
  defaultInstitution: 'Nubank',
  defaultScope: 'pessoal',
  defaultAccountType: 'checking',
  csvColumnAliases: {
    date: ['data', 'date'],
    description: ['descricao', 'descrição', 'description'],
    amount: ['valor', 'amount', 'value'],
    identifier: ['identificador', 'identifier', 'id'],
    category: ['categoria', 'category'],
    account: ['conta', 'account'],
    institution: ['instituicao', 'instituição', 'institution'],
  },
  mapRowToDraft(row) {
    return {
      id: row.identifier,
      date: String(row.date),
      description: getDescription(row),
      originalDescription: getOriginalDescription(row),
      amount: parseAmountFromStructuredRow(row, nubankAccountProfile),
      accountName: row.account ?? nubankAccountProfile.defaultAccountName,
      institution: row.institution ?? nubankAccountProfile.defaultInstitution,
      scope: nubankAccountProfile.defaultScope,
      accountType: nubankAccountProfile.defaultAccountType,
      source: nubankAccountProfile.source,
      category: row.category,
    };
  },
  validateRow: validateBaseRow,
};

export const nubankCreditCardProfile: ParserProfile = {
  id: 'nubank_credit_card',
  name: 'Nubank Fatura',
  source: 'nubank_credit_card',
  defaultAccountName: 'Nubank Cartão',
  defaultInstitution: 'Nubank',
  defaultScope: 'pessoal',
  defaultAccountType: 'credit_card',
  defaultMethod: 'credito',
  csvColumnAliases: {
    date: ['data', 'date'],
    description: ['title', 'description', 'descricao', 'descrição'],
    amount: ['valor', 'amount', 'value'],
    identifier: ['identificador', 'identifier', 'id'],
    category: ['categoria', 'category'],
    account: ['conta', 'account'],
    institution: ['instituicao', 'instituição', 'institution'],
  },
  mapRowToDraft(row) {
    return {
      id: row.identifier,
      date: String(row.date),
      description: getDescription(row),
      originalDescription: getOriginalDescription(row),
      amount: getNubankCreditCardAmount(row),
      accountName: row.account ?? nubankCreditCardProfile.defaultAccountName,
      institution: row.institution ?? nubankCreditCardProfile.defaultInstitution,
      scope: nubankCreditCardProfile.defaultScope,
      accountType: nubankCreditCardProfile.defaultAccountType,
      method: nubankCreditCardProfile.defaultMethod,
      source: nubankCreditCardProfile.source,
      category: row.category,
    };
  },
  validateRow: validateBaseRow,
};

export const c6BusinessProfile: ParserProfile = {
  id: 'c6_business',
  name: 'C6 Empresa',
  source: 'c6_business',
  defaultAccountName: 'C6 Empresa',
  defaultInstitution: 'C6 Bank',
  defaultScope: 'empresa',
  defaultAccountType: 'business_checking',
  csvColumnAliases: {
    date: ['data lancamento', 'data lançamento', 'data contabil', 'data contábil', 'data', 'date'],
    description: ['titulo', 'título', 'description', 'descricao', 'descrição'],
    details: ['descricao', 'descrição', 'detalhes', 'details'],
    entryAmount: ['entrada(r$)', 'entrada', 'entrada r$', 'credito', 'crédito'],
    exitAmount: ['saida(r$)', 'saída(r$)', 'saida', 'saída', 'saida r$', 'debito', 'débito'],
    identifier: ['identificador', 'identifier', 'id'],
    category: ['categoria', 'category'],
    account: ['conta', 'account'],
    institution: ['instituicao', 'instituição', 'institution'],
  },
  mapRowToDraft(row) {
    return {
      id: row.identifier,
      date: String(row.date),
      description: getDescription(row),
      originalDescription: getOriginalDescription(row),
      amount: parseAmountFromStructuredRow(row, c6BusinessProfile),
      accountName: row.account ?? c6BusinessProfile.defaultAccountName,
      institution: row.institution ?? c6BusinessProfile.defaultInstitution,
      scope: c6BusinessProfile.defaultScope,
      accountType: c6BusinessProfile.defaultAccountType,
      source: c6BusinessProfile.source,
      category: row.category,
    };
  },
  validateRow: validateBaseRow,
};

export const parserProfiles = {
  nubankAccount: nubankAccountProfile,
  nubankCreditCard: nubankCreditCardProfile,
  c6Business: c6BusinessProfile,
};
