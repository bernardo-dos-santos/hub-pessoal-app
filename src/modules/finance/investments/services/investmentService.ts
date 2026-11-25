import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { generateId } from '../../../../shared/utils/generateId';
import { localDayKey } from '../../../../shared/dates/localDay.js';
import { type Investment, type MonthlyGoal } from '../types/investment';
import { investmentMovementService } from './investmentMovementService';

const KEY_INVESTMENTS  = 'finance.investments';
const KEY_MONTHLY_GOAL = 'finance.investments.monthlyGoal';

export type InvestmentInput = Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>;

export const investmentService = {
  listInvestments(): Investment[] {
    return storageAdapter.getItem<Investment[]>(KEY_INVESTMENTS) ?? [];
  },

  getById(id: string): Investment | null {
    return this.listInvestments().find((i) => i.id === id) ?? null;
  },

  /**
   * `openingExchangeRate`: for a foreign asset, the values typed are in its
   * currency and need the day's rate — without it the opening balance was read
   * as reais.
   */
  create(input: InvestmentInput, openingExchangeRate?: number): Investment {
    if (!input.name.trim()) throw new Error('Dê um nome ao investimento.');
    const isForeign = (input.currency ?? 'BRL') !== 'BRL';
    if (isForeign && (input.totalInvested > 0 || input.currentValue > 0) && !(openingExchangeRate && openingExchangeRate > 0)) {
      throw new Error('Informe o câmbio do dia para o saldo inicial em dólar.');
    }
    const rate = isForeign ? openingExchangeRate : undefined;
    const now = new Date().toISOString();
    const investment: Investment = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    storageAdapter.setItem(KEY_INVESTMENTS, [investment, ...this.listInvestments()]);

    // O valor informado no cadastro é o ponto de partida do histórico: sem isso
    // o ativo nasceria sem nenhum movimento e a carteira não teria como
    // explicar de onde veio o dinheiro que ela mostra.
    const openingDate = localDayKey();
    if (input.totalInvested > 0) {
      investmentMovementService.create({
        investmentId: investment.id,
        type: 'contribution',
        date: openingDate,
        // Typed in reais; the movement is in the asset's currency.
        amount: rate ? input.totalInvested / rate : input.totalInvested,
        exchangeRate: rate,
        quantity: input.quantity,
        note: 'Saldo inicial no cadastro',
        source: input.source ?? 'manual',
      });
    }
    // No valuation of 0 for an asset whose market value wasn't typed.
    if (input.currentValue > 0 && input.currentValue !== input.totalInvested) {
      investmentMovementService.create({
        investmentId: investment.id,
        type: 'valuation',
        date: openingDate,
        amount: rate ? input.currentValue / rate : input.currentValue,
        exchangeRate: rate,
        quantity: input.quantity,
        note: 'Valor de mercado no cadastro',
        source: input.source ?? 'manual',
      });
    }

    return this.recalculateFromMovements(investment.id) ?? investment;
  },

  /**
   * Edit from the form. The two values are a cache of the movements, so
   * writing them directly was undone by the next movement; a change becomes a
   * movement instead (adjustment of the invested total, valuation for the value).
   */
  edit(id: string, input: InvestmentInput): Investment {
    const { currentValue, totalInvested, ...details } = input;
    const updated = this.update(id, details);
    const position = investmentMovementService.getPosition(id);
    const lastRate = investmentMovementService.listByInvestment(id).find((m) => m.exchangeRate)?.exchangeRate;
    const rate = (updated.currency ?? 'BRL') !== 'BRL' ? lastRate ?? 1 : undefined;
    const toAsset = (brl: number) => brl / (rate ?? 1);
    const today = localDayKey();

    const investedDelta = totalInvested - position.totalInvested;
    if (Math.abs(investedDelta) >= 0.01) {
      investmentMovementService.create({
        investmentId: id,
        type: investedDelta > 0 ? 'contribution' : 'withdrawal',
        date: today,
        amount: toAsset(Math.abs(investedDelta)),
        exchangeRate: rate,
        note: 'Ajuste do total investido',
        source: 'manual',
      });
    }
    const afterAdjust = investmentMovementService.getPosition(id);
    if (currentValue > 0 && Math.abs(currentValue - afterAdjust.currentValue) >= 0.01) {
      investmentMovementService.create({
        investmentId: id,
        type: 'valuation',
        date: today,
        amount: toAsset(currentValue),
        exchangeRate: rate,
        note: 'Valor atualizado no cadastro',
        source: 'manual',
      });
    }
    return this.recalculateFromMovements(id) ?? updated;
  },

  update(id: string, input: Partial<InvestmentInput>): Investment {
    const investments = this.listInvestments();
    const index = investments.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Investimento não encontrado.');
    const updated = { ...investments[index], ...input, updatedAt: new Date().toISOString() };
    investments[index] = updated;
    storageAdapter.setItem(KEY_INVESTMENTS, investments);
    return updated;
  },

  /**
   * Recalcula o valor exibido a partir dos movimentos. `currentValue` e
   * `totalInvested` no `Investment` são só cache de leitura — a fonte da
   * verdade é o histórico.
   */
  recalculateFromMovements(id: string): Investment | null {
    const investment = this.getById(id);
    if (!investment) return null;

    const position = investmentMovementService.getPosition(id);
    return this.update(id, {
      currentValue: position.currentValue,
      totalInvested: position.totalInvested,
      quantity: position.quantity || undefined,
    });
  },

  /** Registra o movimento e reflete o resultado no cache do ativo. */
  addMovement(input: Parameters<typeof investmentMovementService.create>[0]): Investment | null {
    investmentMovementService.create(input);
    return this.recalculateFromMovements(input.investmentId);
  },

  /**
   * Remove o investimento e todo o histórico dele. Sem a cascata, os movimentos
   * viram dado órfão: continuariam somando em qualquer relatório por período,
   * apontando pra um ativo que não existe mais.
   */
  delete(id: string): { movements: number } {
    const movements = investmentMovementService.removeByInvestment(id);
    storageAdapter.setItem(KEY_INVESTMENTS, this.listInvestments().filter((i) => i.id !== id));
    return { movements };
  },

  getTotals() {
    const investments = this.listInvestments();
    const patrimonio = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const investido  = investments.reduce((sum, i) => sum + i.totalInvested, 0);
    const rendimento = patrimonio - investido;
    const rentabilidade = investido > 0 ? (rendimento / investido) * 100 : 0;
    return { patrimonio, investido, rendimento, rentabilidade };
  },

  /** Mesmos totais, separados por função do dinheiro. */
  getTotalsByBucket() {
    const investments = this.listInvestments();
    const sum = (bucket: 'reserva' | 'carteira') =>
      investments
        .filter((i) => (i.bucket ?? 'carteira') === bucket)
        .reduce((total, i) => total + i.currentValue, 0);

    return { reserva: sum('reserva'), carteira: sum('carteira') };
  },

  getMonthlyGoal(): MonthlyGoal | null {
    return storageAdapter.getItem<MonthlyGoal>(KEY_MONTHLY_GOAL) ?? null;
  },

  setMonthlyGoal(goal: MonthlyGoal): void {
    storageAdapter.setItem(KEY_MONTHLY_GOAL, goal);
  },
};
