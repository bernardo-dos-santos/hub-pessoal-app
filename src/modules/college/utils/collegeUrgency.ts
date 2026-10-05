import { type Assessment } from '../types/assessment';
import {
  type CollegeUrgencyFilters,
  type CollegeUrgencyGroups,
  type CollegeUrgencyItem,
} from '../types/college';
import { type CollegeTask } from '../types/task';
import { formatAssessmentType, formatTaskPriority, formatTaskStatus } from './collegeFormatters';
import { addDays, compareDateKeys, isDateBetween, todayKey } from './collegePeriod';
import { getEffectiveTaskStatus } from './collegeCalculations';

const emptyUrgencyGroups = (): CollegeUrgencyGroups => ({
  overdue: [],
  thisWeek: [],
  today: [],
  upcoming: [],
});

function sortUrgencyItems(first: CollegeUrgencyItem, second: CollegeUrgencyItem) {
  const dateComparison = compareDateKeys(first.date.split('T')[0], second.date.split('T')[0]);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const priorityOrder: Record<CollegeUrgencyItem['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return priorityOrder[first.priority] - priorityOrder[second.priority] || first.title.localeCompare(second.title);
}

function taskToUrgencyItem(task: CollegeTask, referenceDate: string): CollegeUrgencyItem | null {
  const status = getEffectiveTaskStatus(task, referenceDate);

  if (status === 'done' || status === 'canceled') {
    return null;
  }

  return {
    date: task.dueDate,
    detail: `${formatTaskPriority(task.priority)} / ${formatTaskStatus(status)}`,
    id: `task-${task.id}`,
    kind: 'task',
    priority: status === 'late' ? 'high' : task.priority,
    sourceId: task.id,
    status,
    subjectId: task.subjectId,
    title: task.title,
  };
}

function assessmentToUrgencyItem(assessment: Assessment, referenceDate: string): CollegeUrgencyItem | null {
  if (assessment.status !== 'scheduled') {
    return null;
  }

  return {
    date: assessment.date,
    detail: formatAssessmentType(assessment.type),
    id: `assessment-${assessment.id}`,
    kind: 'assessment',
    priority: assessment.date <= referenceDate ? 'high' : 'medium',
    sourceId: assessment.id,
    status: assessment.status,
    subjectId: assessment.subjectId,
    title: assessment.title,
  };
}

function getUrgencyGroupKey(item: CollegeUrgencyItem, referenceDate: string, weekEndDate: string) {
  const dateKey = item.date.split('T')[0];

  if (dateKey < referenceDate || item.status === 'late') {
    return 'overdue';
  }

  if (dateKey === referenceDate) {
    return 'today';
  }

  if (isDateBetween(dateKey, addDays(referenceDate, 1), weekEndDate)) {
    return 'thisWeek';
  }

  return 'upcoming';
}

export function getCollegeUrgencyGroups({
  assessments,
  referenceDate = todayKey(),
  tasks,
  weekWindowDays = 7,
}: {
  assessments: Assessment[];
  referenceDate?: string;
  tasks: CollegeTask[];
  weekWindowDays?: number;
}): CollegeUrgencyGroups {
  const weekEndDate = addDays(referenceDate, weekWindowDays);
  const groups = emptyUrgencyGroups();
  const items = [
    ...tasks.map((task) => taskToUrgencyItem(task, referenceDate)),
    ...assessments.map((assessment) => assessmentToUrgencyItem(assessment, referenceDate)),
  ].filter((item): item is CollegeUrgencyItem => Boolean(item));

  items.forEach((item) => {
    groups[getUrgencyGroupKey(item, referenceDate, weekEndDate)].push(item);
  });

  return {
    overdue: groups.overdue.sort(sortUrgencyItems),
    thisWeek: groups.thisWeek.sort(sortUrgencyItems),
    today: groups.today.sort(sortUrgencyItems),
    upcoming: groups.upcoming.sort(sortUrgencyItems),
  };
}

export function filterCollegeUrgencyGroups(
  groups: CollegeUrgencyGroups,
  filters: CollegeUrgencyFilters,
): CollegeUrgencyGroups {
  const filterItems = (items: CollegeUrgencyItem[]) => items.filter((item) => {
    const matchesType = filters.type === 'all' || item.kind === filters.type;
    const matchesSubject = !filters.subjectId || filters.subjectId === 'all' || item.subjectId === filters.subjectId;

    return matchesType && matchesSubject;
  });

  return {
    overdue: filterItems(groups.overdue),
    thisWeek: filterItems(groups.thisWeek),
    today: filterItems(groups.today),
    upcoming: filterItems(groups.upcoming),
  };
}

export function countCollegeUrgencyItems(groups: CollegeUrgencyGroups) {
  return groups.overdue.length + groups.today.length + groups.thisWeek.length + groups.upcoming.length;
}
