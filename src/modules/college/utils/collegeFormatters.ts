import { type AssessmentStatus, type AssessmentType } from '../types/assessment';
import { type MaterialType } from '../types/material';
import { type SubjectStatus } from '../types/subject';
import { type CollegeTaskPriority, type CollegeTaskStatus } from '../types/task';

export function formatCollegeDate(date?: string) {
  if (!date) {
    return 'Sem data';
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsedDate);
}

export function formatAssessmentType(type: AssessmentType) {
  return {
    exam: 'Prova',
    other: 'Outro',
    practical: 'Pratica',
    presentation: 'Apresentacao',
    quiz: 'Quiz',
  }[type];
}

export function formatAssessmentStatus(status: AssessmentStatus) {
  return {
    completed: 'Realizada',
    missed: 'Perdida',
    scheduled: 'Agendada',
  }[status];
}

export function formatTaskStatus(status: CollegeTaskStatus) {
  return {
    canceled: 'Cancelada',
    done: 'Concluida',
    in_progress: 'Em andamento',
    late: 'Atrasada',
    pending: 'Pendente',
  }[status];
}

export function formatTaskPriority(priority: CollegeTaskPriority) {
  return {
    high: 'Alta',
    low: 'Baixa',
    medium: 'Media',
  }[priority];
}

export function formatSubjectStatus(status: SubjectStatus) {
  return {
    active: 'Ativa',
    archived: 'Arquivada',
    completed: 'Concluida',
  }[status];
}

export function formatMaterialType(type: MaterialType) {
  return {
    book: 'Livro',
    exercise_list: 'Lista de exercicios',
    file_reference: 'Referencia de arquivo',
    link: 'Link',
    note: 'Nota',
    other: 'Outro',
    pdf: 'PDF externo',
    pdf_reference: 'Referencia de PDF',
    slide: 'Slide',
    video: 'Video',
  }[type];
}

export function formatGradeValue(value: number, maxValue?: number) {
  const formattedValue = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');

  if (!maxValue) {
    return formattedValue;
  }

  const formattedMax = Number.isInteger(maxValue) ? String(maxValue) : maxValue.toFixed(2).replace('.', ',');
  return `${formattedValue}/${formattedMax}`;
}
