import { type ParserProfile, type ParserValidationResult, type StructuredTransactionRow } from '../../types/import';
import { parseAmountFromStructuredRow } from './structuredTransactionParser';
import { parseMoneyText } from '../../utils/moneyParsing';

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

  // The value is checked after parsing: comparing the CSV string with 0 never
  // fired, and an unreadable "1.234,56-" went in as R$ 0 without a word.
  const rawValues = [row.amount, row.value, row.entryAmount, row.exitAmount].filter((v) => v !== undefined && v !== '');
  const parsedValues = rawValues.map((v) => parseMoneyText(v));
  if (rawValues.length > 0 && parsedValues.every((v) => v === null)) {
    errors.push(`Valor ilegível: "${String(rawValues[0])}".`);
  } else if (parsedValues.length > 0 && parsedValues.every((v) => v === null || v === 0)) {
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
  // The card CSV lists purchases as positive and credits (bill payment, refund,
  // discount, adjustment) as negative: flip the sign. A keyword list used to
  // decide, and any credit it didn't know ("Desconto antecipação") became spending.
  return -parseAmountFromStructuredRow(row, nubankCreditCardProfile);
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
