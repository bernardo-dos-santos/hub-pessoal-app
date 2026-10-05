import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type WeeklyPlan } from '../types/routine';

const STORAGE_KEY = 'planner.weeklyPlan';
// Mesma chave é lida pelo servidor em /api/planner/generate — se mudar aqui,
// mude lá também, senão o job agendado volta a gerar por conta própria.
const AUTO_KEY = 'planner.autoGenerate';

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getNextMondayFrom(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export const weeklyPlanService = {
  getCurrentPlan(): WeeklyPlan | null {
    return storageAdapter.getItem<WeeklyPlan>(STORAGE_KEY);
  },

  /**
   * Geração automática ligada? Vale para os DOIS caminhos que criam plano
   * sozinhos: o auto-domingo aqui do cliente e o job agendado
   * (`HubPessoal-WeeklyPlan` → `/api/planner/generate`). Desligar só de um lado
   * faria o plano reaparecer sozinho e pareceria que o botão não funcionou.
   * Ausente = ligado, pra não mudar o comportamento de quem nunca mexeu.
   */
  isAutoGenerateEnabled(): boolean {
    return storageAdapter.getItem<boolean>(AUTO_KEY) !== false;
  },

  setAutoGenerate(enabled: boolean): void {
    storageAdapter.setItem(AUTO_KEY, enabled);
  },

  savePlan(plan: Omit<WeeklyPlan, 'id' | 'generatedAt'>): WeeklyPlan {
    const sessions = plan.sessions.map((s) => ({
      ...s,
      id: s.id || generateId(),
    }));
    const full: WeeklyPlan = {
      ...plan,
      sessions,
      id: generateId(),
      generatedAt: new Date().toISOString(),
    };
    storageAdapter.setItem(STORAGE_KEY, full);
    return full;
  },

  getSessionById(sessionId: string): WeeklyPlan['sessions'][number] | null {
    return this.getCurrentPlan()?.sessions.find((s) => s.id === sessionId) ?? null;
  },

  /**
   * Remove o plano da semana. NÃO limpa as marcações de conclusão —
   * `sessionCompletionService` importa este serviço, então importá-lo de volta
   * criaria ciclo. Quem apaga um plano deve chamar
   * `sessionCompletionService.clearWeek(plan.weekOf)` junto, senão sobram
   * completions órfãs (ver WeeklyPlanPage.deletePlan).
   */
  clearPlan(): void {
    storageAdapter.removeItem(STORAGE_KEY);
  },

  isOutdated(): boolean {
    const plan = this.getCurrentPlan();
    if (!plan) return true;
    const today = new Date();
    const currentMonday = getMondayOf(today);
    return plan.weekOf < currentMonday;
  },

  isSundayAndNeedsRegen(): boolean {
    const today = new Date();
    const isSunday = today.getDay() === 0;
    if (!isSunday) return false;
    const plan = this.getCurrentPlan();
    if (!plan) return true;
    const nextMonday = getNextMondayFrom(today);
    return plan.weekOf !== nextMonday;
  },

  getTargetWeekOf(): string {
    const today = new Date();
    if (today.getDay() === 0) return getNextMondayFrom(today);
    return getMondayOf(today);
  },

  formatWeekRange(weekOf: string): string {
    const monday = new Date(weekOf + 'T12:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  },
};
