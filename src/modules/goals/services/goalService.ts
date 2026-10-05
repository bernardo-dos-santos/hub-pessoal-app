import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type Goal, type GoalCategory, type GoalStatus, type KeyResult } from '../types/goal';

const STORAGE_KEY = 'goals.list';

function readGoals(): Goal[] {
  return storageAdapter.getItem<Goal[]>(STORAGE_KEY) ?? [];
}

function writeGoals(goals: Goal[]): void {
  storageAdapter.setItem(STORAGE_KEY, goals);
}

function refreshGoalContext(): void {
  updateDailyContext({ goals: { activeCount: readGoals().filter((g) => g.status === 'active').length } });
}

function now(): string {
  return new Date().toISOString();
}

export type CreateGoalInput = {
  title: string;
  description: string;
  category: GoalCategory;
  targetDate?: string;
  keyResults?: Array<{ title: string; target?: string }>;
};

export const goalService = {
  listGoals(): Goal[] {
    return readGoals().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listActive(): Goal[] {
    return this.listGoals().filter((g) => g.status === 'active');
  },

  getById(id: string): Goal | null {
    return readGoals().find((g) => g.id === id) ?? null;
  },

  create(input: CreateGoalInput): Goal {
    const goal: Goal = {
      id: generateId(),
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      status: 'active',
      targetDate: input.targetDate,
      keyResults: (input.keyResults ?? []).map((kr) => ({
        id: generateId(),
        title: kr.title.trim(),
        target: kr.target?.trim(),
        status: 'pending',
      })),
      createdAt: now(),
      updatedAt: now(),
    };
    writeGoals([goal, ...readGoals()]);
    refreshGoalContext();
    return goal;
  },

  update(id: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'targetDate' | 'status'>>): Goal | null {
    const goals = readGoals();
    const idx = goals.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    goals[idx] = { ...goals[idx], ...patch, updatedAt: now() };
    writeGoals(goals);
    refreshGoalContext();
    return goals[idx];
  },

  toggleKeyResult(goalId: string, krId: string): Goal | null {
    const goals = readGoals();
    const idx = goals.findIndex((g) => g.id === goalId);
    if (idx === -1) return null;
    // Constrói um Goal NOVO em vez de mutar o existente: o apiStorageAdapter
    // guarda os objetos em cache e devolve sempre a mesma referência até uma
    // escrita trocá-la — mutar em memória fazia o React receber a mesma
    // referência de antes em setGoal() e pular o re-render (o dado ficava
    // certo no banco, mas a tela só atualizava ao sair e voltar).
    const keyResults = goals[idx].keyResults.map((kr): KeyResult =>
      kr.id !== krId ? kr : {
        ...kr,
        status: kr.status === 'done' ? 'pending' : 'done',
        completedAt: kr.status === 'pending' ? now() : undefined,
      },
    );
    // Auto-complete meta se todos os KRs estiverem feitos
    const allDone = keyResults.length > 0 && keyResults.every((kr) => kr.status === 'done');
    const status = allDone && goals[idx].status === 'active' ? 'completed' : goals[idx].status;
    const updated: Goal = { ...goals[idx], keyResults, status, updatedAt: now() };
    goals[idx] = updated;
    writeGoals(goals);
    refreshGoalContext();
    return updated;
  },

  delete(id: string): void {
    writeGoals(readGoals().filter((g) => g.id !== id));
    refreshGoalContext();
  },

  /** % de key results concluídos (0-100). */
  getProgress(goal: Goal): number {
    if (goal.keyResults.length === 0) return goal.status === 'completed' ? 100 : 0;
    const done = goal.keyResults.filter((kr) => kr.status === 'done').length;
    return Math.round((done / goal.keyResults.length) * 100);
  },
};
