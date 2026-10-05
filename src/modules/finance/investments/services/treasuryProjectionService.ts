import { type Investment } from '../types/investment';
import { investmentMovementService } from './investmentMovementService';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export type ContractedProjection = {
  /**
   * Valor no vencimento, em poder de compra de hoje — a taxa contratada já é
   * acima do IPCA, então compor por ela não exige apostar em inflação futura.
   * Não é o valor nominal que vai aparecer no extrato em 2045.
   */
  contractedValue: number;
  maturityDate: string;
  yearsToMaturity: number;
};

/**
 * Marcação a mercado ("se vender hoje") oscila com a taxa de juros do momento
 * e pode aparecer negativa num título prefixado/IPCA+ sem que nada tenha
 * dado errado — é só o preço de revenda antecipada. Quem segura até o
 * vencimento recebe a taxa contratada, não a marcação do dia. Mostrar só um
 * número esconde qual dos dois é o que importa pra quem não vai vender agora.
 *
 * Simplificação: usa a data do primeiro aporte como referência de compra e
 * compõe todo o `totalInvested` a partir dela. Pra um título comprado aos
 * poucos ao longo do tempo isso superestima levemente a composição dos
 * aportes mais recentes — aceitável aqui porque a alternativa (compor cada
 * aporte separado) exigiria histórico exato de cada compra na B3, que este
 * módulo não tem.
 */
export function calculateContractedProjection(investment: Investment): ContractedProjection | null {
  if (investment.type !== 'treasury' || !investment.maturityDate || !investment.contractedRate) return null;
  if (investment.totalInvested <= 0) return null;

  const movements = investmentMovementService.listByInvestment(investment.id);
  const contributionDates = movements.filter((m) => m.type === 'contribution').map((m) => m.date);
  const purchaseDate =
    contributionDates.length > 0
      ? contributionDates.reduce((earliest, date) => (date < earliest ? date : earliest))
      : investment.createdAt.slice(0, 10);

  const years = (new Date(investment.maturityDate).getTime() - new Date(purchaseDate).getTime()) / MS_PER_YEAR;
  if (years <= 0) return null;

  const contractedValue = investment.totalInvested * Math.pow(1 + investment.contractedRate / 100, years);

  return { contractedValue, maturityDate: investment.maturityDate, yearsToMaturity: years };
}

export const treasuryProjectionService = {
  calculateContractedProjection,
};
