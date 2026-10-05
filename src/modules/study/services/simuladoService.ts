import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { questionService } from './questionService';
import type { Question, QuestionDifficulty } from '../types/question';
import type { Simulado, SimuladoResult } from '../types/simulado';

const SIMULADO_KEY = 'study.simulados';
const RESULT_KEY = 'study.simuladoResults';

type BuildFilters = {
  subjectTags: string[];
  count: number;
  difficulty: QuestionDifficulty | 'mixed';
  materialIds?: string[]; // opcional: prioriza questões desses materiais
};

export const simuladoService = {
  list(): Simulado[] {
    return (storageAdapter.getItem<Simulado[]>(SIMULADO_KEY) ?? []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  getById(id: string): Simulado | null {
    return this.list().find((s) => s.id === id) ?? null;
  },

  create(input: Omit<Simulado, 'id' | 'createdAt'>): Simulado {
    const simulado: Simulado = { ...input, id: generateId(), createdAt: new Date().toISOString() };
    storageAdapter.setItem(SIMULADO_KEY, [simulado, ...this.list()]);
    return simulado;
  },

  delete(id: string): void {
    storageAdapter.setItem(
      SIMULADO_KEY,
      this.list().filter((s) => s.id !== id),
    );
  },

  /** Retorna questões aleatórias de acordo com os filtros.
   *  Se materialIds informado, prioriza questões desses materiais e completa com o restante se necessário. */
  pickQuestions({ subjectTags, count, difficulty, materialIds }: BuildFilters): Question[] {
    let pool = questionService.listQuestions();
    if (subjectTags.length > 0) pool = pool.filter((q) => subjectTags.includes(q.subjectTag));
    if (difficulty !== 'mixed') pool = pool.filter((q) => q.difficulty === difficulty);

    function shuffle(arr: Question[]): Question[] {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }

    if (materialIds && materialIds.length > 0) {
      const priority = pool.filter((q) => q.materialIds?.some((m) => materialIds.includes(m)));
      const rest = pool.filter((q) => !priority.includes(q));
      return [...shuffle(priority), ...shuffle(rest)].slice(0, count);
    }

    return shuffle(pool).slice(0, count);
  },

  countAvailable({ subjectTags, difficulty, materialIds }: Omit<BuildFilters, 'count'>): number {
    let pool = questionService.listQuestions();
    if (subjectTags.length > 0) pool = pool.filter((q) => subjectTags.includes(q.subjectTag));
    if (difficulty !== 'mixed') pool = pool.filter((q) => q.difficulty === difficulty);
    if (materialIds && materialIds.length > 0)
      return pool.filter((q) => q.materialIds?.some((m) => materialIds.includes(m))).length;
    return pool.length;
  },

  // ── Resultados ──────────────────────────────────────────────────────────────

  listResults(): SimuladoResult[] {
    return (storageAdapter.getItem<SimuladoResult[]>(RESULT_KEY) ?? []).sort((a, b) =>
      b.finishedAt.localeCompare(a.finishedAt),
    );
  },

  getResultById(id: string): SimuladoResult | null {
    return this.listResults().find((r) => r.id === id) ?? null;
  },

  saveResult(input: Omit<SimuladoResult, 'id' | 'finishedAt'>): SimuladoResult {
    const result: SimuladoResult = {
      ...input,
      id: generateId(),
      finishedAt: new Date().toISOString(),
    };
    storageAdapter.setItem(RESULT_KEY, [result, ...this.listResults()]);
    return result;
  },
};
