export type InvestmentAssetType =
  | 'fixed_income'
  | 'stock'
  | 'fund'
  | 'treasury'
  | 'crypto'
  | 'other';

export const ASSET_TYPE_LABEL: Record<InvestmentAssetType, string> = {
  fixed_income: 'Renda Fixa',
  stock:        'Ações',
  fund:         'Fundos',
  treasury:     'Tesouro Direto',
  crypto:       'Cripto',
  other:        'Outro',
};

export type InvestmentSource = 'manual' | 'pluggy';

/**
 * Reserva de emergência e carteira de longo prazo são dinheiros com funções
 * diferentes e não podem entrar no mesmo bolo: misturar faz a alocação alvo
 * mentir e o cálculo de "quantos meses a reserva cobre" contar dinheiro que
 * não está disponível pra emergência.
 */
export type InvestmentBucket = 'reserva' | 'carteira';

export const BUCKET_LABEL: Record<InvestmentBucket, string> = {
  reserva: 'Reserva de emergência',
  carteira: 'Carteira',
};

/**
 * Classe de alocação da carteira. Não dá pra derivar do tipo do ativo: "EUA" é
 * um recorte geográfico (ação lá fora via Avenue), não uma classe de ativo —
 * uma ação americana e uma brasileira têm o mesmo `InvestmentAssetType` e alvos
 * diferentes. Só se aplica ao bucket `carteira`.
 */
export type AllocationSleeve = 'acoes_br' | 'fiis' | 'exterior' | 'tesouro';

export const SLEEVE_LABEL: Record<AllocationSleeve, string> = {
  acoes_br: 'Ações BR',
  fiis: 'FIIs',
  exterior: 'Exterior',
  tesouro: 'Tesouro IPCA+',
};

export type AssetCurrency = 'BRL' | 'USD';

export type Investment = {
  id: string;
  name: string;
  type: InvestmentAssetType;
  institution: string;
  /**
   * Espelho da última posição calculada a partir dos movimentos — mantido pra
   * leitura rápida em lista. A fonte da verdade é `investmentMovementService`.
   */
  currentValue: number;
  totalInvested: number;
  notes?: string;
  // Ausente em investimentos criados antes desse campo existir — tratar como 'manual'.
  source?: InvestmentSource;
  // Id da posição na Pluggy — usado só pra saber, num resync, se atualiza ou cria.
  externalId?: string;
  quantity?: number;
  /** Ausente = 'carteira', pra não quebrar item criado antes do conceito existir. */
  bucket?: InvestmentBucket;
  /** Só faz sentido no bucket 'carteira'. */
  sleeve?: AllocationSleeve;
  /** Ausente = 'BRL'. */
  currency?: AssetCurrency;
  /**
   * Só faz sentido em `type: 'treasury'` com taxa prefixada/IPCA+ (ex.:
   * Tesouro IPCA+ 2045). Junto com `contractedRate`, permite projetar o valor
   * contratado no vencimento — sem os dois, o ativo só mostra a marcação a
   * mercado, que é o único número que o sync/marcação manual já dão.
   */
  maturityDate?: string;
  /** Taxa real contratada, IPCA + X% ao ano (ex.: 7.5 para "IPCA+7,5%"). */
  contractedRate?: number;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyGoal = {
  targetAmount: number;
};

/** Percentuais da carteira por classe — a reserva fica fora desta conta. */
export type TargetAllocation = Record<AllocationSleeve, number>;

/** Alocação Hydra achatada: 50/30/20 de 70% em carteira + 30% em Tesouro. */
export const DEFAULT_TARGET_ALLOCATION: TargetAllocation = {
  acoes_br: 35,
  fiis: 21,
  exterior: 14,
  tesouro: 30,
};
