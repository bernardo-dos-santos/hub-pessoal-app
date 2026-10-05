/**
 * jarvis/tools/college.js — add_college_assessment, get_college_schedule,
 * create_college_task, list_college_tasks, get_college_grades.
 */

import { kvStore } from '../../db.js';
import { kv, todayStr, findSubject, daysBetween } from '../context.js';

export const collegeTools = [
  {
    name: 'add_college_assessment',
    description: 'Registra uma avaliação, prova ou recuperação na faculdade. Use quando Bernardo mencionar datas de provas, trabalhos, recuperações ou qualquer avaliação acadêmica.',
    input_schema: {
      type: 'object',
      properties: {
        title:        { type: 'string', description: 'Título da avaliação (ex: "Recuperação AV3", "Trabalho Final")' },
        date:         { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        subject_name: { type: 'string', description: 'Nome ou parte do nome da disciplina' },
        type:         { type: 'string', enum: ['exam', 'quiz', 'presentation', 'practical', 'other'], description: 'Tipo: exam=prova, quiz=mini-teste, presentation=apresentação, practical=prático, other=outro' },
        notes:        { type: 'string', description: 'Observações opcionais' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'get_college_schedule',
    description: 'Retorna as disciplinas da faculdade e as próximas avaliações agendadas. Use para perguntas sobre a faculdade além das 3 avaliações do contexto.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_college_task',
    description: 'Cria uma tarefa/trabalho da faculdade com prazo. Use quando Bernardo mencionar um trabalho, lista de exercícios, leitura obrigatória ou qualquer entrega com data. Para provas e avaliações use add_college_assessment.',
    input_schema: {
      type: 'object',
      properties: {
        title:        { type: 'string', description: 'Título da tarefa (ex: "Lista 3 de integrais")' },
        subject_name: { type: 'string', description: 'Nome ou parte do nome da disciplina' },
        due_date:     { type: 'string', description: 'Prazo no formato YYYY-MM-DD' },
        priority:     { type: 'string', enum: ['low', 'medium', 'high'], description: 'Prioridade (padrão medium)' },
        description:  { type: 'string', description: 'Detalhes do trabalho (opcional)' },
      },
      required: ['title', 'due_date'],
    },
  },
  {
    name: 'list_college_tasks',
    description: 'Lista tarefas e trabalhos da faculdade com disciplina, prazo e quantos dias faltam. Use para "tenho trabalho essa semana?", "o que vence primeiro?", "o que tá atrasado?".',
    input_schema: {
      type: 'object',
      properties: {
        only_open:    { type: 'boolean', description: 'Só as não concluídas/canceladas (padrão true)' },
        subject_name: { type: 'string', description: 'Filtra por disciplina (opcional)' },
        limit:        { type: 'integer', description: 'Máximo retornado (padrão 20)' },
      },
    },
  },
  {
    name: 'get_college_grades',
    description: 'Retorna as notas da faculdade por disciplina, com média ponderada e as avaliações que ainda não têm nota. Use para "como estou em Cálculo?", "qual minha média?", "preciso de quanto na próxima prova?".',
    input_schema: {
      type: 'object',
      properties: {
        subject_name: { type: 'string', description: 'Filtra por disciplina (opcional; sem isso, traz todas)' },
      },
    },
  },
];

export async function executeCollegeTool(name, args) {
  switch (name) {
    case 'add_college_assessment': {
      const assessments = kv('college.assessments') ?? [];
      const subjects = kv('college.subjects') ?? [];
      const subjectId = findSubject(subjects, args.subject_name)?.id ?? null;
      const now = new Date().toISOString();
      const newAssessment = {
        id: `jarvis-${Date.now()}`,
        subjectId: subjectId ?? '',
        title: args.title,
        type: args.type ?? 'exam',
        date: args.date,
        status: 'scheduled',
        notes: args.notes ?? '',
        source: 'jarvis',
        createdAt: now,
        updatedAt: now,
      };
      assessments.unshift(newAssessment);
      kvStore.set('college.assessments', JSON.stringify(assessments));
      const subjectLabel = subjectId
        ? subjects.find((s) => s.id === subjectId)?.name ?? args.subject_name
        : args.subject_name ?? 'disciplina não identificada';
      return { ok: true, message: `Avaliação "${args.title}" de ${subjectLabel} registrada para ${args.date}.`, affectedKey: 'college.assessments' };
    }

    case 'get_college_schedule': {
      const subjects = (kv('college.subjects') ?? []).map((s) => s.name);
      const today = todayStr();
      const assessments = (kv('college.assessments') ?? [])
        .filter((a) => a.status === 'scheduled' && a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((a) => {
          const sub = (kv('college.subjects') ?? []).find((s) => s.id === a.subjectId);
          return { date: a.date, title: a.title, subject: sub?.name ?? null, type: a.type };
        });
      return { ok: true, subjects, upcomingAssessments: assessments };
    }

    case 'create_college_task': {
      const tasks = kv('college.tasks') ?? [];
      const subjects = kv('college.subjects') ?? [];
      const match = args.subject_name ? findSubject(subjects, args.subject_name) : null;
      const now = new Date().toISOString();
      tasks.unshift({
        id: `jarvis-${Date.now()}`,
        subjectId: match?.id ?? '',
        title: args.title,
        description: args.description ?? '',
        dueDate: args.due_date,
        status: 'pending',
        priority: args.priority ?? 'medium',
        source: 'jarvis',
        createdAt: now,
        updatedAt: now,
      });
      kvStore.set('college.tasks', JSON.stringify(tasks));
      const label = match?.name ?? args.subject_name ?? 'sem disciplina';
      return {
        ok: true,
        message: `Tarefa "${args.title}" (${label}) criada para ${args.due_date}.`,
        // Avisa quando o nome não bateu, senão a tarefa some do filtro por disciplina
        // e Bernardo não entende por quê.
        warning: args.subject_name && !match ? `Não achei disciplina parecida com "${args.subject_name}" — a tarefa ficou sem disciplina.` : undefined,
        affectedKey: 'college.tasks',
      };
    }

    case 'list_college_tasks': {
      const subjects = kv('college.subjects') ?? [];
      const onlyOpen = args.only_open !== false;
      const filterSubject = args.subject_name ? findSubject(subjects, args.subject_name) : null;
      const today = todayStr();
      const tasks = (kv('college.tasks') ?? [])
        .filter((t) => (onlyOpen ? t.status !== 'done' && t.status !== 'canceled' : true))
        .filter((t) => (filterSubject ? t.subjectId === filterSubject.id : true))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
        .slice(0, args.limit ?? 20)
        .map((t) => ({
          title: t.title,
          subject: subjects.find((s) => s.id === t.subjectId)?.name ?? null,
          dueDate: t.dueDate,
          // O modelo não calcula data de forma confiável — entregar pronto.
          daysUntilDue: daysBetween(today, t.dueDate),
          status: t.status,
          priority: t.priority,
        }));
      return { ok: true, today, tasks };
    }

    case 'get_college_grades': {
      const subjects = kv('college.subjects') ?? [];
      const target = args.subject_name ? findSubject(subjects, args.subject_name) : null;
      if (args.subject_name && !target) {
        return { ok: false, message: `Não encontrei disciplina parecida com "${args.subject_name}".` };
      }
      const grades = kv('college.grades') ?? [];
      const assessments = kv('college.assessments') ?? [];
      const scope = target ? [target] : subjects;

      const bySubject = scope.map((subject) => {
        const own = grades.filter((g) => g.subjectId === subject.id);
        // Média ponderada pelo peso; sem peso, cada nota vale igual. Normaliza pra
        // escala 0–10 quando a nota tem maxValue diferente (regra espelhada de
        // calculateSimpleGradeAverage em collegeCalculations.ts).
        let weightSum = 0;
        let valueSum = 0;
        for (const g of own) {
          const max = g.maxValue && g.maxValue > 0 ? g.maxValue : 10;
          const weight = typeof g.weight === 'number' && g.weight > 0 ? g.weight : 1;
          valueSum += (g.value / max) * 10 * weight;
          weightSum += weight;
        }
        return {
          subject: subject.name,
          average: weightSum > 0 ? Number((valueSum / weightSum).toFixed(2)) : null,
          grades: own.map((g) => ({ title: g.title, value: g.value, maxValue: g.maxValue ?? 10, weight: g.weight ?? null })),
          // Sem isto não dá pra responder "preciso de quanto na AV3?".
          pendingAssessments: assessments
            .filter((a) => a.subjectId === subject.id && a.grade === undefined && a.status !== 'missed')
            .map((a) => ({ title: a.title, date: a.date, weight: a.weight ?? null })),
        };
      }).filter((s) => s.grades.length > 0 || s.pendingAssessments.length > 0);

      return { ok: true, subjects: bySubject };
    }

    default:
      return undefined;
  }
}
