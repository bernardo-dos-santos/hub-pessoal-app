import { type Assessment } from '../types/assessment';
import { type CollegeSummary } from '../types/college';
import { type Grade } from '../types/grade';
import { type SigaaParsedPlan } from '../services/sigaaImportService';
import { type Subject } from '../types/subject';
import { type CollegeTask } from '../types/task';
import { getCurrentSemester, todayKey } from './collegePeriod';

const openTaskStatuses = new Set<CollegeTask['status']>(['pending', 'in_progress', 'late']);

export function getEffectiveTaskStatus(task: CollegeTask, today = todayKey()): CollegeTask['status'] {
  if ((task.status === 'pending' || task.status === 'in_progress') && task.dueDate.split('T')[0] < today) {
    return 'late';
  }

  return task.status;
}

export function normalizeTaskDeadline(task: CollegeTask, today = todayKey()): CollegeTask {
  const status = getEffectiveTaskStatus(task, today);

  return status === task.status ? task : { ...task, status };
}

export function countPendingTasks(tasks: CollegeTask[], today = todayKey()) {
  return tasks.filter((task) => getEffectiveTaskStatus(task, today) === 'pending' || getEffectiveTaskStatus(task, today) === 'in_progress').length;
}

export function countLateTasks(tasks: CollegeTask[], today = todayKey()) {
  return tasks.filter((task) => getEffectiveTaskStatus(task, today) === 'late').length;
}

export function countCompletedTasks(tasks: CollegeTask[]) {
  return tasks.filter((task) => task.status === 'done').length;
}

export function listUpcomingAssessments(assessments: Assessment[], today = todayKey(), limit = 5) {
  return assessments
    .filter((assessment) => assessment.status === 'scheduled' && assessment.date >= today)
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(0, limit);
}

export type AssessmentStatus = {
  label: string;
  resultsKey: string;
  weight: number;
  value: number | null;
  recoveryValue: number | null;
  effectiveValue: number | null;
  status: 'ok' | 'recovered' | 'pending_recovery' | 'not_graded';
};

export function buildAssessmentStatuses(
  grades: Grade[],
  plan: SigaaParsedPlan,
  passingGrade = 6,
): AssessmentStatus[] {
  const baseGrades = grades.filter((g) => !g.isRecovery);
  const recGrades = grades.filter((g) => g.isRecovery);
  const usedRecIds = new Set<string>();

  const statuses = plan.assessments.map((a) => {
    const grade = baseGrades.find(
      (g) =>
        g.sigaaColumn?.toLowerCase() === a.resultsKey.toLowerCase() ||
        g.title.toLowerCase() === a.label.toLowerCase(),
    );
    const value = grade?.value ?? null;

    // Tenta match pelo número: "Resultado Parcial 2" → número "2" → "Recuperação 2"
    const avNum = a.resultsKey.match(/\d+/)?.[0] ?? null;
    let recovery: Grade | null = null;
    if (avNum) {
      recovery = recGrades.find(
        (g) => !usedRecIds.has(g.id) && (g.sigaaColumn?.match(/\d+/)?.[0] === avNum || g.title?.match(/\d+/)?.[0] === avNum),
      ) ?? null;
    }
    if (recovery) usedRecIds.add(recovery.id);

    const recoveryValue = recovery?.value ?? null;
    // Recuperação só substitui se for maior que a nota original (IFSC: não penaliza)
    const effectiveValue =
      value !== null && recoveryValue !== null ? Math.max(value, recoveryValue)
      : recoveryValue ?? value;
    const recoveryHelped = recoveryValue !== null && value !== null && recoveryValue > value;

    let status: AssessmentStatus['status'];
    if (value === null) {
      status = 'not_graded';
    } else if (recovery !== null && recoveryHelped) {
      status = effectiveValue !== null && effectiveValue >= passingGrade ? 'recovered' : 'pending_recovery';
    } else if (effectiveValue !== null && effectiveValue >= passingGrade) {
      status = 'ok';
    } else {
      status = 'pending_recovery';
    }

    return { label: a.label, resultsKey: a.resultsKey, weight: a.weight, value, recoveryValue, effectiveValue, status };
  });

  // Recuperações sem match numérico: atribui à primeira AV em pending_recovery
  const unmatchedRecs = recGrades.filter((g) => !usedRecIds.has(g.id));
  for (const rec of unmatchedRecs) {
    const pending = statuses.find((s) => s.status === 'pending_recovery');
    if (pending) {
      pending.recoveryValue = rec.value;
      pending.effectiveValue =
        pending.value !== null ? Math.max(pending.value, rec.value) : rec.value;
      const helped = pending.value !== null && rec.value > pending.value;
      if (helped) {
        pending.status = pending.effectiveValue !== null && pending.effectiveValue >= passingGrade ? 'recovered' : 'pending_recovery';
      }
    }
  }

  return statuses;
}

export type SubjectGradeSummary = {
  projectedFinal: number | null;  // média final projetada (0 para AVs faltantes)
  currentAverage: number | null;  // média ponderada só das AVs já lançadas
  neededToPass: number | null;    // nota necessária nas restantes; null se impossível ou já aprovado
  isPassing: boolean;
  isComplete: boolean;            // todas as AVs do plano têm nota
  hasRecovery: boolean;
};

export function calcSubjectGradeSummary(
  grades: Grade[],
  plan: SigaaParsedPlan | undefined,
  passingGrade = 6,
): SubjectGradeSummary {
  const baseGrades = grades.filter((g) => !g.isRecovery);
  const hasRecovery = grades.some((g) => g.isRecovery);

  if (!plan || plan.assessments.length === 0) {
    const avg = calculateSimpleGradeAverage(baseGrades);
    return { projectedFinal: avg, currentAverage: avg, neededToPass: null, isPassing: avg !== null && avg >= passingGrade, isComplete: false, hasRecovery };
  }

  const totalWeight = plan.assessments.reduce((s, a) => s + a.weight, 0) || 1;

  const results = plan.assessments.map((a) => {
    const grade = baseGrades.find(
      (g) =>
        g.sigaaColumn?.toLowerCase() === a.resultsKey.toLowerCase() ||
        g.title.toLowerCase() === a.label.toLowerCase(),
    );
    return { weight: a.weight, value: grade?.value ?? null };
  });

  const entered = results.filter((r) => r.value !== null);
  const enteredWeightSum = entered.reduce((s, r) => s + r.weight, 0);
  const enteredValueSum = entered.reduce((s, r) => s + r.value! * r.weight, 0);

  const currentAverage = enteredWeightSum > 0 ? enteredValueSum / enteredWeightSum : null;
  const projectedFinal = enteredWeightSum > 0 ? enteredValueSum / totalWeight : null;

  const remainingWeight = totalWeight - enteredWeightSum;
  let neededToPass: number | null = null;
  if (projectedFinal !== null && remainingWeight > 0.001 && projectedFinal < passingGrade) {
    const needed = (passingGrade * totalWeight - enteredValueSum) / remainingWeight;
    neededToPass = needed <= 10 ? Math.round(needed * 10) / 10 : null;
  }

  return {
    projectedFinal,
    currentAverage,
    neededToPass,
    isPassing: projectedFinal !== null && projectedFinal >= passingGrade,
    isComplete: entered.length === plan.assessments.length,
    hasRecovery,
  };
}

export function calculateSimpleGradeAverage(grades: Grade[]) {
  if (grades.length === 0) {
    return null;
  }

  const weightedGrades = grades.filter((grade) => grade.weight && grade.weight > 0);

  if (weightedGrades.length > 0) {
    const totalWeight = weightedGrades.reduce((total, grade) => total + (grade.weight ?? 0), 0);

    if (totalWeight > 0) {
      return weightedGrades.reduce((total, grade) => total + grade.value * (grade.weight ?? 0), 0) / totalWeight;
    }
  }

  return grades.reduce((total, grade) => total + grade.value, 0) / grades.length;
}

export function getActiveSubjects(subjects: Subject[]) {
  return subjects.filter((subject) => subject.status === 'active');
}

export function calculateCollegeSummary({
  assessments,
  currentSemester = getCurrentSemester(),
  subjects,
  tasks,
  today = todayKey(),
}: {
  assessments: Assessment[];
  currentSemester?: string;
  subjects: Subject[];
  tasks: CollegeTask[];
  today?: string;
}): CollegeSummary {
  return {
    activeSubjects: getActiveSubjects(subjects).length,
    completedTasks: countCompletedTasks(tasks),
    currentSemester,
    lateTasks: countLateTasks(tasks, today),
    pendingTasks: countPendingTasks(tasks, today),
    upcomingAssessments: listUpcomingAssessments(assessments, today).length,
  };
}

