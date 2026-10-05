/**
 * sigaaTombstones — lembra o que foi apagado DE PROPÓSITO.
 *
 * A importação do SIGAA é aditiva: para cada disciplina do arquivo, se não
 * existir uma com aquele nome, ela cria. Sem memória de intenção, "apagado" e
 * "nunca existiu" são indistinguíveis — então toda matéria excluída voltava no
 * sync seguinte, com as tarefas junto (15/08/2026: cinco matérias e cinco
 * tarefas ressuscitadas de uma vez).
 *
 * Guardar o que foi excluído é o que transforma a exclusão numa decisão que
 * sobrevive à sincronização. Recriar a matéria à mão apaga a lápide — voltar
 * a criar é dizer que mudou de ideia.
 *
 * Só disciplinas precisam disso. Tarefa apagada some junto com a disciplina
 * (cascata do removeSubject) e tarefa cancelada continua existindo na lista,
 * então a importação a reconhece e não recria.
 */

import { storageAdapter } from '../../../core/storage/storage.adapter';

const KEY = 'college.deletedSubjects';

/** Mesmo critério que a importação usa para casar disciplina: nome, sem caixa. */
export function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase();
}

export function listDeletedSubjects(): string[] {
  return storageAdapter.getItem<string[]>(KEY) ?? [];
}

export function isSubjectDeleted(name: string): boolean {
  return listDeletedSubjects().includes(normalizeSubjectName(name));
}

export function rememberDeletedSubject(name: string): void {
  const key = normalizeSubjectName(name);
  if (!key) return;
  const current = listDeletedSubjects();
  if (current.includes(key)) return;
  storageAdapter.setItem(KEY, [...current, key]);
}

/** Criar de novo à mão é mudar de ideia — a lápide sai. */
export function forgetDeletedSubject(name: string): void {
  const key = normalizeSubjectName(name);
  const current = listDeletedSubjects();
  if (!current.includes(key)) return;
  storageAdapter.setItem(KEY, current.filter((n) => n !== key));
}
