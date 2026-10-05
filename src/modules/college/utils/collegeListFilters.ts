import { type Assessment } from '../types/assessment';
import {
  type CollegeAssessmentListFilters,
  type CollegeTaskListFilters,
} from '../types/college';
import { type CollegeTask } from '../types/task';
import { getEffectiveTaskStatus } from './collegeCalculations';
import { todayKey } from './collegePeriod';

function matchesSubject(subjectId: string, selectedSubjectId?: string) {
  return !selectedSubjectId || selectedSubjectId === 'all' || subjectId === selectedSubjectId;
}

function matchesSource(source: Assessment['source'] | CollegeTask['source'], selectedSource?: string) {
  if (!selectedSource || selectedSource === 'all') {
    return true;
  }

  if (selectedSource === 'manual') {
    return !source || source === 'manual';
  }

  return source === selectedSource;
}

function taskBucket(task: CollegeTask, referenceDate: string) {
  const status = getEffectiveTaskStatus(task, referenceDate);

  if (status === 'done' || status === 'canceled') {
    return 4;
  }

  if (!task.dueDate) {
    return 3;
  }

  if (status === 'late' || task.dueDate < referenceDate) {
    return 0;
  }

  if (task.dueDate === referenceDate) {
    return 1;
  }

  return 2;
}

export function sortCollegeTasks(tasks: CollegeTask[], referenceDate = todayKey()) {
  return [...tasks].sort((first, second) => {
    const bucketDifference = taskBucket(first, referenceDate) - taskBucket(second, referenceDate);

    if (bucketDifference !== 0) {
      return bucketDifference;
    }

    const dateComparison = (first.dueDate || '9999-12-31').localeCompare(second.dueDate || '9999-12-31');

    if (dateComparison !== 0) {
      return dateComparison;
    }

    const priorityOrder: Record<CollegeTask['priority'], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return priorityOrder[first.priority] - priorityOrder[second.priority] || first.title.localeCompare(second.title);
  });
}

export function filterCollegeTasks(
  tasks: CollegeTask[],
  filters: CollegeTaskListFilters,
  referenceDate = todayKey(),
) {
  return tasks.filter((task) => {
    const status = getEffectiveTaskStatus(task, referenceDate);
    const matchesStatus = filters.status === 'all'
      || (filters.status === 'open' && (status === 'pending' || status === 'in_progress' || status === 'late'))
      || (filters.status === 'late' && status === 'late')
      || (filters.status === 'done' && status === 'done')
      || (filters.status === 'canceled' && status === 'canceled');

    return matchesStatus && matchesSubject(task.subjectId, filters.subjectId) && matchesSource(task.source, filters.source);
  });
}

function assessmentBucket(assessment: Assessment, referenceDate: string) {
  if (assessment.status !== 'scheduled') {
    return 3;
  }

  if (assessment.date < referenceDate) {
    return 0;
  }

  if (assessment.date === referenceDate) {
    return 1;
  }

  return 2;
}

export function sortCollegeAssessments(assessments: Assessment[], referenceDate = todayKey()) {
  return [...assessments].sort((first, second) => {
    const bucketDifference = assessmentBucket(first, referenceDate) - assessmentBucket(second, referenceDate);

    if (bucketDifference !== 0) {
      return bucketDifference;
    }

    const dateComparison = first.date.localeCompare(second.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return first.title.localeCompare(second.title);
  });
}

export function filterCollegeAssessments(
  assessments: Assessment[],
  filters: CollegeAssessmentListFilters,
) {
  return assessments.filter((assessment) => {
    const matchesStatus = filters.status === 'all' || assessment.status === filters.status;

    return matchesStatus && matchesSubject(assessment.subjectId, filters.subjectId) && matchesSource(assessment.source, filters.source);
  });
}
