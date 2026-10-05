import { generateId } from '../../../shared/utils/generateId';
import { type ProjectDecision } from '../types/projectDecision';
import { readDecisions, touch, writeDecisions } from './projectStorage';

type CreateDecisionInput = {
  projectId: string;
  title: string;
  why: string;
  discarded?: string;
  frontId?: string;
  decidedOn?: string;
};

export const projectDecisionService = {
  /** Mais recentes primeiro: decisão nova costuma explicar o estado atual. */
  listByProject(projectId: string): ProjectDecision[] {
    return readDecisions()
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.decidedOn.localeCompare(a.decidedOn) || b.createdAt.localeCompare(a.createdAt));
  },

  count(projectId: string): number {
    return readDecisions().filter((d) => d.projectId === projectId).length;
  },

  create(input: CreateDecisionInput): ProjectDecision {
    const title = input.title.trim();
    const why = input.why.trim();
    if (!title) throw new Error('Descreva o que foi decidido.');
    // O porquê é o motivo de a tela existir — registro sem ele vira changelog.
    if (!why) throw new Error('Explique por que — é a parte que some da memória.');

    const now = new Date().toISOString();
    const decision: ProjectDecision = {
      id: generateId('decision'),
      projectId: input.projectId,
      frontId: input.frontId,
      title,
      why,
      discarded: input.discarded?.trim() || undefined,
      decidedOn: input.decidedOn || now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    writeDecisions([...readDecisions(), decision]);
    touch(input.projectId, input.frontId);
    return decision;
  },

  /**
   * Marca uma decisão como substituída por outra, em vez de apagar.
   * O histórico de "já pensamos assim e mudamos" é justamente o que evita
   * repetir o caminho — apagar destruiria a informação mais útil.
   */
  /** Renomeia. Título vazio é ignorado — a UI já bloqueia, isto é a segunda trava. */
  setTitle(id: string, title: string): ProjectDecision | null {
    const next = title.trim();
    if (!next) return null;
    const decisions = readDecisions();
    const decision = decisions.find((d) => d.id === id);
    if (!decision || decision.title === next) return decision ?? null;
    decision.title = next;
    decision.updatedAt = new Date().toISOString();
    writeDecisions(decisions);
    touch(decision.projectId, decision.frontId);
    return decision;
  },

  supersede(oldId: string, newId: string): boolean {
    const decisions = readDecisions();
    const old = decisions.find((d) => d.id === oldId);
    if (!old || oldId === newId) return false;

    old.supersededById = newId;
    old.updatedAt = new Date().toISOString();
    writeDecisions(decisions);
    touch(old.projectId, old.frontId);
    return true;
  },

  remove(id: string): boolean {
    const decision = readDecisions().find((d) => d.id === id);
    if (!decision) return false;
    // Quem apontava pra esta como substituta fica sem referência — limpa junto
    // pra não sobrar ponteiro pro vazio.
    const rest = readDecisions()
      .filter((d) => d.id !== id)
      .map((d) => (d.supersededById === id ? { ...d, supersededById: undefined } : d));
    writeDecisions(rest);
    touch(decision.projectId, decision.frontId);
    return true;
  },
};
