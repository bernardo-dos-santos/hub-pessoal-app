import { type InvestmentSource } from './investment';

/**
 * A carteira é um filme, não uma foto.
 *
 * Guardar só o valor de agora (como era antes) apaga o passado a cada
 * atualização: não dá pra saber quanto foi aportado de fato, nem separar o que
 * o ativo rendeu do que o câmbio mexeu. Todo movimento fica registrado e o
 * valor atual passa a ser consequência deles.
 */
export type InvestmentMovementType =
  /** Dinheiro entrando no ativo. */
  | 'contribution'
  /** Dinheiro saindo do ativo. */
  | 'withdrawal'
  /** Marcação a mercado: o ativo passou a valer X. Não move dinheiro. */
  | 'valuation';

export const MOVEMENT_TYPE_LABEL: Record<InvestmentMovementType, string> = {
  contribution: 'Aporte',
  withdrawal: 'Resgate',
  valuation: 'Atualização de valor',
};

export type InvestmentMovement = {
  id: string;
  investmentId: string;
  type: InvestmentMovementType;
  /** YYYY-MM-DD */
  date: string;
  /**
   * Valor na moeda do ativo — dólar para ativo em dólar, real para o resto.
   * Sempre positivo; o tipo do movimento é que diz a direção.
   */
  amount: number;
  /**
   * Reais por unidade da moeda estrangeira na data do movimento (ex.: 5.42).
   * Guardado por movimento, não no ativo, porque é o câmbio *daquele dia* que
   * define quanto de real entrou — é o que permite separar depois o ganho do
   * ativo do ganho do câmbio. Ausente em ativo em real.
   */
  exchangeRate?: number;
  /** Cotas/ações movimentadas, quando faz sentido. */
  quantity?: number;
  note?: string;
  source: InvestmentSource;
  /** Id do movimento/posição na origem externa, pra não reimportar. */
  externalId?: string;
  createdAt: string;
};

export type InvestmentPosition = {
  /** Aportes menos resgates, convertido pra real pelo câmbio de cada data. */
  totalInvested: number;
  /** Última marcação a mercado em real; cai pro total aportado se nunca houve. */
  currentValue: number;
  /** Mesmos números na moeda do ativo — isola a performance do câmbio. */
  totalInvestedInAssetCurrency: number;
  currentValueInAssetCurrency: number;
  quantity: number;
  lastValuationDate: string | null;
  movementCount: number;
};
