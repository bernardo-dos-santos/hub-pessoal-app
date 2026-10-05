import { type BaseEntity } from '../../../shared/types/base-entity';
import { type CollegeItemSource } from './college';

export type CollegeTaskStatus = 'pending' | 'in_progress' | 'done' | 'late' | 'canceled';
export type CollegeTaskPriority = 'low' | 'medium' | 'high';

export type CollegeTask = BaseEntity & {
  subjectId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: CollegeTaskStatus;
  priority: CollegeTaskPriority;
  grade?: number;
  source?: CollegeItemSource;
};
