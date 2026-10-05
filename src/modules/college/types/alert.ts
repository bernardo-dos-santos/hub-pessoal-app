import { type BaseEntity } from '../../../shared/types/base-entity';

export type CollegeAlert = BaseEntity & {
  /** ID da disciplina (opcional — aviso pode ser genérico) */
  subjectId?: string;
  /** Nome da disciplina desnormalizado para exibição sem join */
  subjectName?: string;
  title: string;
  /** Trecho do conteúdo do aviso */
  content?: string;
  /** Data original do aviso no SIGAA (ISO 8601) */
  date?: string;
  /**
   * Hash determinístico para deduplicação.
   * Formato: "<subjectId>::<title>::<date>"
   * Garante que o mesmo aviso não seja notificado duas vezes,
   * mesmo que o professor reposte com o mesmo título.
   */
  sigaaHash: string;
  source: 'sigaa_news';
  /** Preenchido quando o usuário descarta o alerta */
  dismissedAt?: string;
};
