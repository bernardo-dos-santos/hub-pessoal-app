import { type BaseEntity } from '../../../shared/types/base-entity';
import { type SigaaParsedPlan } from '../services/sigaaImportService';

export type SubjectStatus = 'active' | 'completed' | 'archived';

export type Subject = BaseEntity & {
  name: string;
  shortName?: string;
  aliases?: string[];
  professor?: string;
  location?: string;
  semester: string;
  color?: string;
  status: SubjectStatus;
  notes?: string;
  parsedPlan?: SigaaParsedPlan;
  attendance?: { absences: number; totalAllowed: number | null };
};
