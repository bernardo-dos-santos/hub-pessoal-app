import { type Assessment } from '../types/assessment';
import { type CollegeStudyNextStep } from '../types/college';
import { type Grade } from '../types/grade';
import { type Material } from '../types/material';
import { type Subject } from '../types/subject';
import { type CollegeTask } from '../types/task';
import { calculateSimpleGradeAverage, getEffectiveTaskStatus, listUpcomingAssessments } from './collegeCalculations';
import { todayKey } from './collegePeriod';

export type CollegeStudyOverviewInput = {
  assessments: Assessment[];
  grades: Grade[];
  materials: Material[];
  subjectId: string;
  subjects: Subject[];
  tasks: CollegeTask[];
  today?: string;
};

export function getCommonMaterialTags(materials: Material[], limit = 6) {
  const tagCounts = new Map<string, number>();

  materials.forEach((material) => {
    material.tags?.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  return [...tagCounts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function getStudyNextSteps({
  commonTags,
  materials,
  openTasks,
  upcomingAssessments,
}: {
  commonTags: string[];
  materials: Material[];
  openTasks: CollegeTask[];
  upcomingAssessments: Assessment[];
}): CollegeStudyNextStep[] {
  const nextSteps: CollegeStudyNextStep[] = [];

  if (materials.length === 0) {
    nextSteps.push({
      description: 'Adicione links, PDFs externos, slides ou anotacoes para formar uma base de estudo.',
      id: 'add-materials',
      title: 'Nenhum material cadastrado ainda.',
    });
  }

  if (upcomingAssessments.length > 0) {
    nextSteps.push({
      description: 'Ha avaliacao proxima. Revise os materiais desta disciplina antes da data marcada.',
      id: 'review-for-assessment',
      title: 'Revisar para avaliacao proxima.',
    });
  }

  if (openTasks.some((task) => task.status === 'late')) {
    nextSteps.push({
      description: 'Existe tarefa atrasada nesta disciplina. Resolva ou atualize o status antes de estudar o restante.',
      id: 'late-task',
      title: 'Conferir tarefa atrasada.',
    });
  } else if (openTasks.length > 0) {
    nextSteps.push({
      description: 'Use a lista de tarefas abertas para decidir o que precisa sair primeiro.',
      id: 'open-tasks',
      title: 'Voce tem tarefas abertas.',
    });
  }

  if (materials.some((material) => material.type === 'exercise_list')) {
    nextSteps.push({
      description: 'Existem listas de exercicios cadastradas. Priorize resolucao pratica.',
      id: 'exercise-lists',
      title: 'Resolver listas de exercicios.',
    });
  }

  if (commonTags.length > 0) {
    nextSteps.push({
      description: `Tags mais presentes: ${commonTags.join(', ')}.`,
      id: 'common-tags',
      title: 'Estudar tags frequentes.',
    });
  }

  if (nextSteps.length === 0) {
    nextSteps.push({
      description: 'Disciplina sem pendencias fortes agora. Mantenha materiais e notas atualizados.',
      id: 'keep-updated',
      title: 'Manter base organizada.',
    });
  }

  return nextSteps;
}

export function getCollegeStudyOverview({
  assessments,
  grades,
  materials,
  subjectId,
  subjects,
  tasks,
  today = todayKey(),
}: CollegeStudyOverviewInput) {
  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const subjectMaterials = materials.filter((material) => material.subjectId === subjectId);
  const openTasks = tasks
    .filter((task) => task.subjectId === subjectId)
    .map((task) => ({ ...task, status: getEffectiveTaskStatus(task, today) }))
    .filter((task) => task.status === 'pending' || task.status === 'in_progress' || task.status === 'late')
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate));
  const upcomingAssessments = listUpcomingAssessments(
    assessments.filter((assessment) => assessment.subjectId === subjectId),
    today,
    10,
  );
  const subjectGrades = grades.filter((grade) => grade.subjectId === subjectId);
  const commonTags = getCommonMaterialTags(subjectMaterials);

  return {
    average: calculateSimpleGradeAverage(subjectGrades),
    commonTags,
    grades: subjectGrades,
    materials: subjectMaterials,
    nextSteps: getStudyNextSteps({
      commonTags,
      materials: subjectMaterials,
      openTasks,
      upcomingAssessments,
    }),
    openTasks,
    subject,
    upcomingAssessments,
  };
}
