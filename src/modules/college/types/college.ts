import { type Assessment } from './assessment';
import { type Grade } from './grade';
import { type Material } from './material';
import { type Subject } from './subject';
import { type CollegeTask } from './task';

export type CollegeItemSource = 'manual' | 'quick_text' | 'image_ocr' | 'ai';

export type CollegeSummary = {
  activeSubjects: number;
  pendingTasks: number;
  upcomingAssessments: number;
  lateTasks: number;
  completedTasks: number;
  currentSemester: string;
};

export type CollegeData = {
  subjects: Subject[];
  assessments: Assessment[];
  tasks: CollegeTask[];
  grades: Grade[];
  materials: Material[];
};

export type CollegeUrgencyGroupKey = 'overdue' | 'today' | 'thisWeek' | 'upcoming';
export type CollegeUrgencyItemKindFilter = 'all' | 'task' | 'assessment';

export type CollegeUrgencyItem = {
  id: string;
  sourceId: string;
  kind: 'task' | 'assessment';
  subjectId: string;
  title: string;
  date: string;
  status: string;
  detail: string;
  priority: 'low' | 'medium' | 'high';
};

export type CollegeUrgencyGroups = Record<CollegeUrgencyGroupKey, CollegeUrgencyItem[]>;

export type CollegeUrgencyFilters = {
  type: CollegeUrgencyItemKindFilter;
  subjectId?: string;
};

export type CollegeTaskListStatusFilter = 'all' | 'open' | 'late' | 'done' | 'canceled';
export type CollegeAssessmentListStatusFilter = 'all' | 'scheduled' | 'completed' | 'missed';
export type CollegeListSourceFilter = 'all' | 'manual' | 'quick_text';

export type CollegeTaskListFilters = {
  source?: CollegeListSourceFilter;
  status: CollegeTaskListStatusFilter;
  subjectId?: string;
};

export type CollegeAssessmentListFilters = {
  source?: CollegeListSourceFilter;
  status: CollegeAssessmentListStatusFilter;
  subjectId?: string;
};

export type CollegeQuickCaptureDraftType = 'task' | 'assessment';
export type CollegeQuickCaptureDraftStatus = 'ready' | 'incomplete' | 'ignored';

export type CollegeQuickCaptureDraft = {
  id: string;
  type: CollegeQuickCaptureDraftType;
  title: string;
  subjectId: string;
  date: string;
  notes: string;
  source: Extract<CollegeItemSource, 'quick_text'>;
  sourceLine: string;
  assessmentType?: Assessment['type'];
  weight?: number;
  incomplete: boolean;
  warnings: string[];
  ignored?: boolean;
};

export type CollegeQuickCaptureParseResult = {
  drafts: CollegeQuickCaptureDraft[];
  ignoredLines: string[];
};

export type CollegeQuickCaptureSummary = {
  total: number;
  ready: number;
  incomplete: number;
  ignored: number;
  tasks: number;
  assessments: number;
};

export type CollegeQuickCaptureCreatedItem = {
  date: string;
  id: string;
  subjectId: string;
  title: string;
  type: CollegeQuickCaptureDraftType;
};

export type CollegeStudyNextStep = {
  id: string;
  title: string;
  description: string;
};
