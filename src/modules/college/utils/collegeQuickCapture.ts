import { type Assessment } from '../types/assessment';
import {
  type CollegeQuickCaptureDraft,
  type CollegeQuickCaptureDraftStatus,
  type CollegeQuickCaptureSummary,
  type CollegeQuickCaptureDraftType,
  type CollegeQuickCaptureParseResult,
} from '../types/college';
import { type Subject } from '../types/subject';
import { addDays, todayKey } from './collegePeriod';

const assessmentKeywords = [
  'prova',
  'av1',
  'av2',
  'av3',
  'avaliacao',
  'exame',
  'recuperacao',
  'seminario',
  'apresentacao',
  'quiz',
];

const taskKeywords = [
  'trabalho',
  'tarefa',
  'lista',
  'atividade',
  'exercicio',
  'relatorio',
  'entregar',
  'entrega',
  'fazer',
  'postar',
  'enviar',
  'moodle',
];

const weekdayMap: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function candidateMatchesLine(normalizedLine: string, candidate: string) {
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedCandidate) {
    return false;
  }

  if (normalizedCandidate.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedCandidate)}([^a-z0-9]|$)`).test(normalizedLine);
  }

  return normalizedLine.includes(normalizedCandidate);
}

export function detectCollegeItemType(line: string): CollegeQuickCaptureDraftType {
  const normalizedLine = normalizeText(line);
  const hasAssessmentKeyword = assessmentKeywords.some((keyword) => normalizedLine.includes(keyword));
  const hasTaskKeyword = taskKeywords.some((keyword) => normalizedLine.includes(keyword));

  if (hasAssessmentKeyword && !hasTaskKeyword) {
    return 'assessment';
  }

  if (hasAssessmentKeyword && normalizedLine.includes('seminario')) {
    return 'assessment';
  }

  return 'task';
}

export function detectCollegeDate(line: string, referenceDate = todayKey()) {
  const normalizedLine = normalizeText(line);

  if (candidateMatchesLine(normalizedLine, 'hoje')) {
    return referenceDate;
  }

  if (candidateMatchesLine(normalizedLine, 'amanha')) {
    return addDays(referenceDate, 1);
  }

  if (normalizedLine.includes('semana que vem') || normalizedLine.includes('proxima semana')) {
    return addDays(referenceDate, 7);
  }

  const dateMatch = normalizedLine.match(/(?:dia|ate|para|em|entrega|entregar|prazo)?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);

  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const rawYear = dateMatch[3];
    const referenceYear = referenceDate.slice(0, 4);
    const year = rawYear ? rawYear.padStart(4, rawYear.length === 2 ? '20' : '0') : referenceYear;

    return `${year}-${month}-${day}`;
  }

  const weekday = Object.keys(weekdayMap).find((key) => candidateMatchesLine(normalizedLine, key));

  if (!weekday) {
    return '';
  }

  const reference = new Date(`${referenceDate}T00:00:00`);
  const targetDay = weekdayMap[weekday];
  const distance = (targetDay - reference.getDay() + 7) % 7 || 7;

  return addDays(referenceDate, distance);
}

export function matchCollegeSubject(line: string, subjects: Subject[]) {
  const normalizedLine = normalizeText(line);

  return subjects.find((subject) => {
    const names = [subject.name, subject.shortName, ...(subject.aliases ?? [])].filter(Boolean);

    return names.some((name) => candidateMatchesLine(normalizedLine, String(name)));
  }) ?? null;
}

function detectAssessmentType(line: string): Assessment['type'] {
  const normalizedLine = normalizeText(line);

  if (normalizedLine.includes('seminario') || normalizedLine.includes('apresentacao')) {
    return 'presentation';
  }

  if (normalizedLine.includes('atividade') || normalizedLine.includes('pratica')) {
    return 'practical';
  }

  if (normalizedLine.includes('quiz')) {
    return 'quiz';
  }

  if (
    normalizedLine.includes('prova')
    || normalizedLine.includes('av1')
    || normalizedLine.includes('av2')
    || normalizedLine.includes('av3')
    || normalizedLine.includes('avaliacao')
    || normalizedLine.includes('exame')
    || normalizedLine.includes('recuperacao')
  ) {
    return 'exam';
  }

  return 'other';
}

function detectWeight(line: string) {
  const match = normalizeText(line).match(/peso\s*(\d+(?:[,.]\d+)?)/);

  return match ? Number(match[1].replace(',', '.')) : undefined;
}

function buildTitle(line: string, subject: Subject | null) {
  let title = line;

  if (subject) {
    [subject.name, subject.shortName, ...(subject.aliases ?? [])].filter(Boolean).forEach((name) => {
      title = title.replace(new RegExp(escapeRegex(String(name)), 'i'), '');
    });
  }

  return title
    .replace(/(?:dia|ate|até|para|em|entrega|entregar|prazo)?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/gi, '')
    .replace(/peso\s*\d+(?:[,.]\d+)?/gi, '')
    .replace(/\b(ate|até|para|dia|em|hoje|amanha|amanhã|proxima|próxima)\b/gi, '')
    .replace(/\b(semana que vem|proxima semana|próxima semana)\b/gi, '')
    .replace(/^[-–—:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim() || line.trim();
}

export function validateCollegeQuickCaptureDraft(draft: CollegeQuickCaptureDraft) {
  const warnings = [
    ...(draft.title.trim() ? [] : ['Informe um titulo.']),
    ...(draft.subjectId ? [] : ['Escolha uma disciplina cadastrada.']),
    ...(draft.date ? [] : ['Informe uma data ou prazo.']),
    ...(draft.date && Number.isNaN(new Date(`${draft.date}T00:00:00`).getTime()) ? ['Use uma data valida.'] : []),
  ];

  return {
    incomplete: warnings.length > 0,
    warnings,
  };
}

export function getCollegeQuickCaptureDraftStatus(draft: CollegeQuickCaptureDraft): CollegeQuickCaptureDraftStatus {
  if (draft.ignored) {
    return 'ignored';
  }

  return validateCollegeQuickCaptureDraft(draft).incomplete ? 'incomplete' : 'ready';
}

export function summarizeCollegeQuickCaptureDrafts(drafts: CollegeQuickCaptureDraft[]): CollegeQuickCaptureSummary {
  return drafts.reduce<CollegeQuickCaptureSummary>((summary, draft) => {
    const status = getCollegeQuickCaptureDraftStatus(draft);

    return {
      total: summary.total + 1,
      ready: summary.ready + (status === 'ready' ? 1 : 0),
      incomplete: summary.incomplete + (status === 'incomplete' ? 1 : 0),
      ignored: summary.ignored + (status === 'ignored' ? 1 : 0),
      tasks: summary.tasks + (status === 'ready' && draft.type === 'task' ? 1 : 0),
      assessments: summary.assessments + (status === 'ready' && draft.type === 'assessment' ? 1 : 0),
    };
  }, {
    assessments: 0,
    ignored: 0,
    incomplete: 0,
    ready: 0,
    tasks: 0,
    total: 0,
  });
}

export function parseCollegeQuickCaptureLine({
  line,
  referenceDate = todayKey(),
  subjects,
}: {
  line: string;
  referenceDate?: string;
  subjects: Subject[];
}): CollegeQuickCaptureDraft | null {
  const cleanLine = line.trim();

  if (!cleanLine) {
    return null;
  }

  const subject = matchCollegeSubject(cleanLine, subjects);
  const date = detectCollegeDate(cleanLine, referenceDate);
  const type = detectCollegeItemType(cleanLine);
  const draft: CollegeQuickCaptureDraft = {
    assessmentType: type === 'assessment' ? detectAssessmentType(cleanLine) : undefined,
    date,
    id: `quick-${slug(cleanLine).slice(0, 32)}-${Math.abs(cleanLine.length * 17)}`,
    incomplete: false,
    notes: `Capturado de: "${cleanLine}"`,
    source: 'quick_text',
    sourceLine: cleanLine,
    subjectId: subject?.id ?? '',
    title: buildTitle(cleanLine, subject),
    type,
    warnings: [],
    weight: type === 'assessment' ? detectWeight(cleanLine) : undefined,
  };
  const validation = validateCollegeQuickCaptureDraft(draft);

  return {
    ...draft,
    ...validation,
  };
}

export function parseCollegeQuickCaptureText({
  referenceDate = todayKey(),
  subjects,
  text,
}: {
  referenceDate?: string;
  subjects: Subject[];
  text: string;
}): CollegeQuickCaptureParseResult {
  const drafts: CollegeQuickCaptureDraft[] = [];
  const ignoredLines: string[] = [];

  text.split(/\r?\n/).forEach((line) => {
    const draft = parseCollegeQuickCaptureLine({ line, referenceDate, subjects });

    if (draft) {
      drafts.push(draft);
    } else if (line.trim()) {
      ignoredLines.push(line.trim());
    }
  });

  return { drafts, ignoredLines };
}
