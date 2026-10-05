import { storageAdapter } from '../../../core/storage/storage.adapter';
import { aiClient } from '../../../core/ai/aiClient';
import { MATH_JSON_RULES } from '../../../core/ai/formatInstructions';
import { questionService } from './questionService';
import { studyProgressService, type SubjectMastery } from './studyProgressService';
import { studyContentService } from './studyContentService';
import { pdfTextService } from './pdfTextService';
import { assessmentService } from '../../college/services/assessmentService';
import { subjectService } from '../../college/services/subjectService';
import { getSubTopics } from '../data/subTopicTaxonomy';
import { CBMSC_SUBJECTS } from '../data/cbmscSubjects';
import { ABIN_SUBJECTS } from '../data/abinSubjects';
import type { NewQuestion } from './questionService';
import type { ExamStyle } from '../types/question';

export type AutoGenResult = {
  tag: string;
  subTag?: string;
  type: 'questions' | 'summary';
  count: number;
  source?: 'pdf' | 'taxonomy';
};

type AutoGenLog = {
  date: string;
  callCount: number;
  generatedTags: string[];
  /**
   * Resultado da última execução, gerando ou não.
   *
   * Antes só o SUCESSO deixava rastro (`consumeCall`), então "nunca rodou",
   * "rodou e não tinha o que fazer" e "rodou e quebrou" eram indistinguíveis:
   * a chave simplesmente não existia. Era o caso real — `study.autoGen.log`
   * nunca chegou a ser criada em produção.
   */
  lastAttemptAt?: string;
  lastOutcome?: 'generated' | 'nothing' | 'failed';
};

/**
 * De onde saem as disciplinas candidatas.
 *
 * `'college'` é o padrão: o uso principal do módulo é faculdade, e a Prioridade 1
 * (gerar a partir de PDF) filtra `subjects.includes(c.subjectTag)` — com a lista
 * fixa em CBMSC, material do SIGAA nunca passava nesse filtro e a geração a
 * partir dele era inalcançável por construção.
 */
export type AutoGenScope = 'college' | 'cbmsc' | 'abin';

type RawQuestion = {
  statement: string;
  options: { letter: string; text: string }[];
  correctOption: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
};

const STORAGE_LOG    = 'study.autoGen.log';
const STORAGE_NOTICE = 'study.autoGen.notice';
const MAX_CALLS_PER_DAY      = 1;   // 10 questões/dia via Gemini (1 RPD)
const MIN_SUBJECT_QUESTIONS  = 10;  // mínimo por disciplina antes de parar geração básica
const MIN_SUBTAG_QUESTIONS   = 3;   // mínimo por sub-tópico
const MIN_PDF_QUESTIONS      = 10;  // questões por PDF antes de considerar processado
const CRITICAL_MASTERY       = 35;  // revisão só abaixo disso
const EXAM_SKIP_DAYS         = 3;   // não gera se tiver prova em <= N dias
const QUESTIONS_PER_CALL     = 10;  // questões por chamada à IA

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getLog(): AutoGenLog {
  return storageAdapter.getItem<AutoGenLog>(STORAGE_LOG) ?? {
    date: todayStr(),
    callCount: 0,
    generatedTags: [],
  };
}

function saveLog(log: AutoGenLog) {
  storageAdapter.setItem(STORAGE_LOG, log);
}

function canGenerate(log: AutoGenLog, key: string): boolean {
  const today = todayStr();
  if (log.date !== today) return true;
  return log.callCount < MAX_CALLS_PER_DAY && !log.generatedTags.includes(key);
}

function consumeCall(key: string) {
  const log = getLog();
  const today = todayStr();
  const base = log.date === today ? log : { date: today, callCount: 0, generatedTags: [] };
  saveLog({
    ...base,
    callCount: base.callCount + 1,
    generatedTags: [...base.generatedTags, key],
    lastAttemptAt: new Date().toISOString(),
    lastOutcome: 'generated',
  });
}

/**
 * Registra que a execução aconteceu mesmo sem gerar nada. Não mexe em
 * `callCount` nem em `generatedTags`, então não consome a cota do dia — só deixa
 * rastro para diferenciar "não rodou" de "rodou e não tinha o que fazer".
 */
function recordAttempt(outcome: 'nothing' | 'failed') {
  const log = getLog();
  const today = todayStr();
  const base = log.date === today ? log : { date: today, callCount: 0, generatedTags: [] };
  saveLog({ ...base, lastAttemptAt: new Date().toISOString(), lastOutcome: outcome });
}

/** Mensagem curta e legível a partir de um erro desconhecido vindo da IA. */
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Verifica se alguma prova agendada está a <= daysThreshold dias. */
function hasImminentExam(daysThreshold: number): boolean {
  const today = todayStr();
  const limit = new Date();
  limit.setDate(limit.getDate() + daysThreshold);
  const limitStr = limit.toISOString().slice(0, 10);
  return assessmentService.listAssessments().some(
    (a) => a.status === 'scheduled' && a.date >= today && a.date <= limitStr,
  );
}

/**
 * Multiplicador de urgência para priorização.
 * Disciplina com prova em breve (mas > EXAM_SKIP_DAYS) recebe boost.
 * Disciplina sem prova marcada recebe 1x.
 */
function examUrgencyMultiplier(subjectTag: string): number {
  const today = todayStr();
  const college = subjectService.listActiveSubjects?.() ?? [];
  const subject = college.find(
    (s) =>
      s.name.toLowerCase() === subjectTag.toLowerCase() ||
      subjectTag.toLowerCase().includes(s.name.toLowerCase()) ||
      s.name.toLowerCase().includes(subjectTag.toLowerCase()),
  );
  if (!subject) return 1;

  const upcoming = assessmentService.listAssessments()
    .filter((a) => a.subjectId === subject.id && a.status === 'scheduled' && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length === 0) return 1;

  const daysUntil = Math.ceil(
    (new Date(upcoming[0].date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  // Quanto mais próxima a prova (mas além do threshold de pular), maior o boost
  return Math.max(1, 30 / Math.max(daysUntil, EXAM_SKIP_DAYS + 1));
}

function buildQuestionsPrompt(
  subjectTag: string,
  focusSubTag: string | undefined,
  sourceText: string | undefined,
  count = QUESTIONS_PER_CALL,
  examStyle: ExamStyle = 'generico',
): string {
  const topicLine = focusSubTag
    ? `Crie ${count} questões de múltipla escolha sobre "${subjectTag}", com foco EXCLUSIVO no sub-tópico "${focusSubTag}".`
    : `Crie ${count} questões de múltipla escolha sobre "${subjectTag}".`;

  const subTopics = getSubTopics(subjectTag);
  const tagLine = focusSubTag
    ? `- Inclua "${focusSubTag}" como uma das tags em TODAS as questões. Use APENAS tags desta lista canônica: [${(subTopics ?? [focusSubTag]).join(', ')}].`
    : subTopics
      ? `- Marque de 1 a 3 tags de tópico por questão. Use APENAS tags desta lista canônica: [${subTopics.join(', ')}].`
      : `- Marque de 1 a 3 tags de tópico por questão.`;

  const sourceSection = sourceText
    ? `\n\nCONTEÚDO BASE (baseie as questões neste material):\n${sourceText.slice(0, 4000)}`
    : '';

  return [
    `Você é um elaborador de questões de prova de concurso público no estilo ${examStyle}, em português do Brasil.`,
    topicLine,
    ``,
    `Regras:`,
    `- Cada questão tem 5 alternativas (A a E), com exatamente uma correta.`,
    `- O enunciado deve ser claro e cobrar entendimento, não decoreba trivial.`,
    `- Inclua uma explicação curta do porquê a correta está certa.`,
    `- Varie a dificuldade entre fácil, médio e difícil.`,
    tagLine,
    ``,
    MATH_JSON_RULES,
    ``,
    `Formato de saída — APENAS o array JSON:`,
    `[{ "statement": string, "options": [{"letter":"A","text":string}, ...5 itens], "correctOption": "A"|...|"E", "explanation": string, "difficulty": "easy"|"medium"|"hard", "tags": string[] }]`,
    sourceSection,
  ].join('\n');
}

function parseRawQuestions(raw: unknown, subjectTag: string, contentId?: string): NewQuestion[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawQuestion[])
    .filter(
      (q) =>
        typeof q.statement === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctOption === 'string' &&
        q.options.some((o) => o.letter === q.correctOption),
    )
    .map((q) => ({
      contentId,
      subjectTag,
      statement: q.statement.trim(),
      options: q.options.map((o) => ({ letter: o.letter.toUpperCase(), text: o.text.trim() })),
      correctOption: q.correctOption.toUpperCase(),
      explanation: q.explanation?.trim(),
      difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty ?? '') ? q.difficulty : 'medium') as NewQuestion['difficulty'],
      examStyle: 'generico' as ExamStyle,
      tags: (q.tags ?? []).map((t) => t.trim()).filter(Boolean),
    }));
}

function pickWeakestSubTag(subjectTag: string): { subTag: string } | null {
  const questions = questionService.listBySubject(subjectTag);
  const subTopics = getSubTopics(subjectTag);
  if (!subTopics) return null;

  const countPerSubTag = new Map<string, number>();
  for (const q of questions) {
    for (const t of q.tags) countPerSubTag.set(t, (countPerSubTag.get(t) ?? 0) + 1);
  }
  const thin = subTopics.find((t) => (countPerSubTag.get(t) ?? 0) < MIN_SUBTAG_QUESTIONS);
  return thin ? { subTag: thin } : null;
}

export const autoGenerateService = {
  /**
   * Roda auto-geração em background via Gemini (sem Claude).
   *
   * Comportamento:
   * - Se tiver prova em <= EXAM_SKIP_DAYS dias → para; RPD reservado para prep manual.
   * - Prioridade: PDFs sem questões → disciplina fraca (priorizadas por mastery × urgência de prova).
   * - Gera QUESTIONS_PER_CALL questões por chamada (1 RPD/dia).
   */
  async runAutoGenerate(scope: AutoGenScope = 'college'): Promise<AutoGenResult[]> {
    // Se tiver prova próxima, não gasta RPD em auto-geração
    if (hasImminentExam(EXAM_SKIP_DAYS)) {
      const msg = `Prova em ≤${EXAM_SKIP_DAYS} dias detectada — auto-geração pausada para preservar RPD.`;
      this.saveNotice(msg);
      return [];
    }

    const subjects = scope === 'cbmsc' ? CBMSC_SUBJECTS
      : scope === 'abin' ? ABIN_SUBJECTS
      : subjectService.listActiveSubjects().map((s) => s.name);

    if (subjects.length === 0) {
      recordAttempt('nothing');
      return [];
    }

    const allQuestions = questionService.listQuestions();
    const results: AutoGenResult[] = [];
    /** Erros das chamadas de IA — antes eram engolidos por três `catch` vazios. */
    const failures: string[] = [];

    // ── Prioridade 1: PDFs com menos de MIN_PDF_QUESTIONS questões ──────────
    const contents = studyContentService.listContents()
      .filter((c) => c.sourceMaterialId && subjects.includes(c.subjectTag));

    for (const content of contents) {
      const log = getLog();
      const rateKey = `pdf:${content.id}`;
      if (!canGenerate(log, rateKey)) continue;

      const questionsForContent = allQuestions.filter((q) => q.contentId === content.id).length;
      if (questionsForContent >= MIN_PDF_QUESTIONS) continue;

      try {
        const text = content.rawText ?? await pdfTextService.getText(content.sourceMaterialId!);
        if (!text) continue;

        const prompt = buildQuestionsPrompt(content.subjectTag, undefined, text);
        const raw = await aiClient.completeJson<RawQuestion[]>(prompt);
        const questions = parseRawQuestions(raw, content.subjectTag, content.id);
        if (questions.length > 0) {
          questionService.addMany(questions);
          consumeCall(rateKey);
          results.push({ tag: content.subjectTag, type: 'questions', count: questions.length, source: 'pdf' });
          return results; // 1 chamada/dia
        }
      } catch (err) { failures.push(describeError(err)); }
    }

    // ── Prioridade 2: disciplina fraca (mastery × urgência de prova) ────────
    const masteries = studyProgressService.getMasteriesForTags(subjects);

    // Partida a frio: `getMasteriesForTags` filtra `questionCount > 0`, então com
    // o banco vazio esta lista volta vazia, o laço abaixo nunca roda e a
    // Prioridade 3 (que lê a mesma lista) também não — era preciso já ter questão
    // para ganhar questão, e o serviço nunca conseguia dar o primeiro lote. Era o
    // caso real: `study.questions` estava em [] desde sempre.
    // Sem mastery ainda, todo mundo entra com score 0 e a ordem sai só da
    // urgência de prova.
    const candidates: SubjectMastery[] = masteries.length > 0
      ? masteries
      : subjects.map((tag) => ({ tag, score: 0, trend: 'stable' as const, questionCount: 0 }));

    // Ordena por pontuação combinada: quanto menor mastery e mais próxima a prova, mais prioritário
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = (100 - a.score) * examUrgencyMultiplier(a.tag);
      const scoreB = (100 - b.score) * examUrgencyMultiplier(b.tag);
      return scoreB - scoreA;
    });

    for (const m of sorted) {
      const questionCount = questionService.listBySubject(m.tag).length;
      const weakSubTag = pickWeakestSubTag(m.tag);
      const focusSubTag = weakSubTag?.subTag;
      const rateKey = focusSubTag ? `${m.tag}:${focusSubTag}` : m.tag;

      const log = getLog();
      if (!canGenerate(log, rateKey)) continue;

      const subTagThin = !!weakSubTag;
      const subjectThin = questionCount < MIN_SUBJECT_QUESTIONS;

      if (subjectThin || subTagThin) {
        try {
          const prompt = buildQuestionsPrompt(m.tag, focusSubTag, undefined);
          const raw = await aiClient.completeJson<RawQuestion[]>(prompt);
          const questions = parseRawQuestions(raw, m.tag);
          if (questions.length > 0) {
            questionService.addMany(questions);
            consumeCall(rateKey);
            results.push({ tag: m.tag, subTag: focusSubTag, type: 'questions', count: questions.length, source: 'taxonomy' });
            return results;
          }
        } catch (err) { failures.push(describeError(err)); }
        continue;
      }

      // ── Prioridade 3: mastery crítico — revisão pontual ────────────────
      if (m.score < CRITICAL_MASTERY) {
        const rateKeyReview = `review:${m.tag}`;
        const logReview = getLog();
        if (!canGenerate(logReview, rateKeyReview)) continue;

        try {
          const prompt = buildQuestionsPrompt(m.tag, focusSubTag, undefined);
          const raw = await aiClient.completeJson<RawQuestion[]>(prompt);
          const questions = parseRawQuestions(raw, m.tag);
          if (questions.length > 0) {
            questionService.addMany(questions);
            consumeCall(rateKeyReview);
            results.push({ tag: m.tag, type: 'questions', count: questions.length, source: 'taxonomy' });
            return results;
          }
        } catch (err) { failures.push(describeError(err)); }
      }
    }

    // Nada gerado. Distinguir "não havia o que fazer" de "quebrou" é o
    // ponto: antes as duas situações produziam exatamente a mesma tela.
    if (failures.length > 0) {
      recordAttempt('failed');
      this.saveNotice(`Geração automática falhou: ${failures[0]}`);
    } else {
      recordAttempt('nothing');
    }

    return results;
  },

  getLastNotice(): string | null {
    const data = storageAdapter.getItem<{ text: string; date: string }>(STORAGE_NOTICE);
    if (!data) return null;
    const age = Date.now() - new Date(data.date).getTime();
    if (age > 86400000) {
      storageAdapter.removeItem(STORAGE_NOTICE);
      return null;
    }
    return data.text;
  },

  saveNotice(text: string) {
    storageAdapter.setItem(STORAGE_NOTICE, { text, date: new Date().toISOString() });
  },
};
