import { paymentIntermediaries } from '../data/specialCategories';

export function removeAccents(text: string) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(text: string) {
  return removeAccents(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeMoneyDescription(text: string) {
  return normalizeText(text)
    .replace(/[|_/]+/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRuleText(text: string) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text: string) {
  return normalizeRuleText(text).split(' ').filter(Boolean);
}

function hasOrderedTokens(textTokens: string[], keywordTokens: string[]) {
  let textIndex = 0;

  return keywordTokens.every((keywordToken) => {
    const matchIndex = textTokens.findIndex((textToken, index) => index >= textIndex && textToken === keywordToken);

    if (matchIndex === -1) {
      return false;
    }

    textIndex = matchIndex + 1;
    return true;
  });
}

export function containsKeyword(text: string, keyword: string) {
  const normalizedText = normalizeRuleText(text);
  const normalizedKeyword = normalizeRuleText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9]{1,3}$/.test(normalizedKeyword)) {
    return words(normalizedText).includes(normalizedKeyword);
  }

  return normalizedText.includes(normalizedKeyword);
}

export function matchesRuleKeyword(description: string, keyword: string) {
  const normalizedDescription = normalizeRuleText(description);
  const normalizedKeyword = normalizeRuleText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (containsKeyword(normalizedDescription, normalizedKeyword)) {
    return true;
  }

  const keywordTokens = words(normalizedKeyword);

  if (keywordTokens.length < 2) {
    return false;
  }

  return hasOrderedTokens(words(normalizedDescription), keywordTokens);
}

export function containsAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => containsKeyword(text, keyword));
}

export function isPaymentIntermediary(text: string) {
  return containsAnyKeyword(text, paymentIntermediaries);
}

export function removePaymentIntermediaries(text: string) {
  return paymentIntermediaries.reduce((result, intermediary) => {
    const normalizedIntermediary = normalizeMoneyDescription(intermediary);
    return result.replace(new RegExp(`\\b${normalizedIntermediary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ');
  }, normalizeMoneyDescription(text));
}

export function extractMerchant(description: string) {
  const parts = String(description || '')
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return String(description || '').trim();
  }

  const operation = normalizeMoneyDescription(parts[0]);

  if (
    operation.includes('compra no debito') ||
    operation.includes('compra no credito') ||
    operation.includes('transferencia enviada pelo pix') ||
    operation.includes('transferencia recebida pelo pix')
  ) {
    return parts.slice(1).join(' - ');
  }

  if (operation.includes('pagamento de boleto efetuado')) {
    return parts.slice(1).join(' - ');
  }

  return parts.slice(1).join(' - ');
}
