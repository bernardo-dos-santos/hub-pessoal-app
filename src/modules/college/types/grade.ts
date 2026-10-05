import { type BaseEntity } from '../../../shared/types/base-entity';

export type Grade = BaseEntity & {
  subjectId: string;
  title: string;      // label da IA (ex: "AV1") ou nome do SIGAA
  sigaaColumn?: string; // nome original da coluna SIGAA (chave estável para updates)
  value: number;
  maxValue?: number;
  weight?: number;    // peso na nota final (0.0–1.0), vem do parsedPlan
  date?: string;
  notes?: string;
  isRecovery?: boolean;
  topics?: string[];  // tópicos cobertos (do parsedPlan), útil para geração de questões
};

