/**
 * Registro append-only do que aconteceu no projeto.
 *
 * Existe porque `BaseEntity` guarda só `createdAt`/`updatedAt`: a foto do
 * presente. Sem este log, nenhuma pergunta temporal ("quantas tarefas eu
 * fechei em julho", "esta frente andou nas últimas 4 semanas") é respondível —
 * e, pior, não é reconstruível depois, porque o dado nunca chegou a existir.
 * É a única estrutura do módulo cujo custo de adiar cresce com o tempo.
 *
 * Deliberadamente sem `updatedAt`: evento não é editado. Se algo mudou de
 * novo, isso é outro evento.
 */
export type ProjectEventEntity = 'project' | 'front' | 'task' | 'issue' | 'milestone';

export type ProjectEventKind = 'created' | 'status_changed' | 'removed' | 'due_moved';

export type ProjectEvent = {
  id: string;
  projectId: string;
  /** Quando o evento pertence a uma frente — permite medir ritmo por frente. */
  frontId?: string;
  entityType: ProjectEventEntity;
  entityId: string;
  kind: ProjectEventKind;
  /** Estado anterior, quando houver. Em `due_moved`, a data antiga. */
  from?: string;
  /** Estado novo, quando houver. Em `due_moved`, a data nova. */
  to?: string;
  /** ISO do momento do evento. Nome curto porque é o campo mais lido do tipo. */
  at: string;
};

/**
 * Teto de eventos guardados. A estimativa de uso real é ~500/ano, então isto
 * nunca deve ser atingido em operação normal — é rede de proteção contra um
 * caminho de escrita em laço, que sem teto inflaria o snapshot do store lido
 * no boot do app.
 */
export const PROJECT_EVENT_LIMIT = 5000;
