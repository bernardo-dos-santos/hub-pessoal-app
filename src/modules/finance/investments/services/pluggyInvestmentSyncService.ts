import { fetchPluggyPendingFile, type PluggyPendingInvestment } from '../../services/pluggyImportService';
import { investmentService } from './investmentService';
import { investmentMovementService } from './investmentMovementService';
import { type AssetCurrency, type InvestmentAssetType } from '../types/investment';

/**
 * subtype é mais específico que type — tentado primeiro. Nenhum dos dois foi
 * validado contra uma posição real (a corretora testada não tinha posição
 * aberta); os valores vêm da documentação oficial da Pluggy. Ajustar aqui se
 * um resync real mostrar um subtype/type fora dessas listas caindo em 'other'
 * quando não deveria.
 */
const SUBTYPE_TO_ASSET_TYPE: Partial<Record<string, InvestmentAssetType>> = {
  TREASURY: 'treasury',
  CDB: 'fixed_income',
  LCI: 'fixed_income',
  LCA: 'fixed_income',
  LF: 'fixed_income',
  LC: 'fixed_income',
  CRI: 'fixed_income',
  CRA: 'fixed_income',
  CORPORATE_DEBT: 'fixed_income',
  DEBENTURES: 'fixed_income',
  FIXED_INCOME_FUND: 'fixed_income',
  STOCK: 'stock',
  BDR: 'stock',
  DERIVATIVES: 'stock',
  OPTION: 'stock',
  ETF: 'fund',
  ETF_FUND: 'fund',
  REAL_ESTATE_FUND: 'fund',
  INVESTMENT_FUND: 'fund',
  MULTIMARKET_FUND: 'fund',
  STOCK_FUND: 'fund',
  OFFSHORE_FUND: 'fund',
  FIP_FUND: 'fund',
  EXCHANGE_FUND: 'fund',
  FI_INFRA: 'fund',
  FI_AGRO: 'fund',
  RETIREMENT: 'fund',
  STRUCTURED_NOTE: 'other',
  OTHER: 'other',
};

const TYPE_TO_ASSET_TYPE: Partial<Record<string, InvestmentAssetType>> = {
  FIXED_INCOME: 'fixed_income',
  EQUITY: 'stock',
  MUTUAL_FUND: 'fund',
  ETF: 'fund',
  COE: 'other',
  SECURITY: 'other',
  OTHER: 'other',
};

function mapAssetType(item: PluggyPendingInvestment): InvestmentAssetType {
  return SUBTYPE_TO_ASSET_TYPE[item.subtype ?? ''] ?? TYPE_TO_ASSET_TYPE[item.type ?? ''] ?? 'other';
}

export type PluggyInvestmentSyncResult = {
  created: number;
  /** Marcações a mercado registradas em posições já conhecidas. */
  valuationsRecorded: number;
  /** Posições que já tinham marcação com a mesma data — nada a fazer. */
  unchanged: number;
  total: number;
};

function mapCurrency(item: PluggyPendingInvestment): AssetCurrency {
  return item.currencyCode === 'USD' ? 'USD' : 'BRL';
}

/**
 * Sincroniza posições da Pluggy pra dentro da carteira local — ação explícita
 * (botão), não automática ao abrir a página, igual ao importador de transações.
 *
 * Uma posição já conhecida **não é sobrescrita**: o novo valor entra como uma
 * marcação a mercado no histórico, e o valor exibido passa a ser consequência
 * dela. Sobrescrever apagaria a série de valores, que é justamente o que
 * permite saber depois quanto o ativo rendeu (e, em ativo em dólar, separar o
 * que foi o ativo do que foi o câmbio).
 *
 * Idempotente por dia: o movimento carrega `externalId` com a data, então rodar
 * o sync duas vezes não cria duas marcações. Investimento manual (sem
 * `externalId`) nunca é tocado.
 */
export async function syncInvestmentsFromPluggy(): Promise<PluggyInvestmentSyncResult> {
  const data = await fetchPluggyPendingFile();
  const items = data?.investments ?? [];
  const existing = investmentService.listInvestments();
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  let valuationsRecorded = 0;
  let unchanged = 0;

  for (const item of items) {
    const currentValue = item.balance ?? item.amount ?? item.value ?? 0;
    const totalInvested = item.amountOriginal ?? currentValue;
    const valuationDate = item.date?.slice(0, 10) ?? today;
    const match = existing.find((investment) => investment.externalId === item.id);

    if (match) {
      const movement = investmentMovementService.createIfNew({
        investmentId: match.id,
        type: 'valuation',
        date: valuationDate,
        amount: currentValue,
        quantity: item.quantity ?? undefined,
        note: 'Marcação a mercado via Pluggy',
        source: 'pluggy',
        externalId: `${item.id}:${valuationDate}`,
      });

      if (movement) {
        investmentService.recalculateFromMovements(match.id);
        valuationsRecorded += 1;
      } else {
        unchanged += 1;
      }
      continue;
    }

    investmentService.create({
      name: item.name,
      type: mapAssetType(item),
      institution: item.institution ?? 'Pluggy',
      currentValue,
      totalInvested,
      source: 'pluggy',
      externalId: item.id,
      quantity: item.quantity ?? undefined,
      bucket: 'carteira',
      currency: mapCurrency(item),
    });
    created += 1;
  }

  return { created, valuationsRecorded, unchanged, total: items.length };
}
