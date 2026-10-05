import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { generateId } from '../../../../shared/utils/generateId';
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

  create(input: InvestmentInput): Investment {
    const now = new Date().toISOString();
    const investment: Investment = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    storageAdapter.setItem(KEY_INVESTMENTS, [investment, ...this.listInvestments()]);

    // O valor informado no cadastro é o ponto de partida do histórico: sem isso
    // o ativo nasceria sem nenhum movimento e a carteira não teria como
    // explicar de onde veio o dinheiro que ela mostra.
    const openingDate = now.slice(0, 10);
    if (input.totalInvested > 0) {
      investmentMovementService.create({
        investmentId: investment.id,
        type: 'contribution',
        date: openingDate,
        amount: input.totalInvested,
        quantity: input.quantity,
        note: 'Saldo inicial no cadastro',
        source: input.source ?? 'manual',
      });
    }
    if (input.currentValue !== input.totalInvested) {
      investmentMovementService.create({
        investmentId: investment.id,
        type: 'valuation',
        date: openingDate,
        amount: input.currentValue,
        quantity: input.quantity,
        note: 'Valor de mercado no cadastro',
        source: input.source ?? 'manual',
      });
    }

    return investment;
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
