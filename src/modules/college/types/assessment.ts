import { type BaseEntity } from '../../../shared/types/base-entity';
import { type CollegeItemSource } from './college';

export type AssessmentType = 'exam' | 'quiz' | 'presentation' | 'practical' | 'other';
export type AssessmentStatus = 'scheduled' | 'completed' | 'missed';

export type Assessment = BaseEntity & {
  subjectId: string;
  title: string;
  type: AssessmentType;
  date: string;
  weight?: number;
  grade?: number;
  status: AssessmentStatus;
  notes?: string;
  source?: CollegeItemSource;
};
