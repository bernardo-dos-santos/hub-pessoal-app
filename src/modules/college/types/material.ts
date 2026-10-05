import { type BaseEntity } from '../../../shared/types/base-entity';
import { type CollegeItemSource } from './college';

export type MaterialType =
  | 'pdf'
  | 'link'
  | 'note'
  | 'slide'
  | 'exercise_list'
  | 'book'
  | 'video'
  | 'other'
  | 'file_reference'
  | 'pdf_reference';

export type MaterialAttachment = {
  id: string;
  materialId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Material = BaseEntity & {
  subjectId?: string;
  title: string;
  type: MaterialType;
  url?: string;
  description?: string;
  tags?: string[];
  source?: CollegeItemSource;
  attachments?: MaterialAttachment[];
};
