import { simuladoService } from './simuladoService';
import { questionService } from './questionService';
import type { SimuladoResult } from '../types/simulado';

export type SubjectMastery = {
  tag: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  questionCount: number;
};

// Calcula mastery de uma tag a partir dos resultados já carregados (evita N listResults())
function computeMastery(
  tag: string,
  questionCount: number,
  results: SimuladoResult[],
): SubjectMastery {
  const tagResults = results
    .filter((r) => r.byTag.some((t) => t.tag === tag))
    .slice(0, 6);

  if (tagResults.length === 0) return { tag, score: 0, trend: 'stable', questionCount };

  const tagScores = tagResults
    .map((r) => {
      const ts = r.byTag.find((t) => t.tag === tag);
      if (!ts || ts.total === 0) return null;
      return Math.round((ts.correct / ts.total) * 100);
    })
    .filter((s): s is number => s !== null);

  if (tagScores.length === 0) return { tag, score: 0, trend: 'stable', questionCount };

  const score = Math.round(tagScores.reduce((a, b) => a + b, 0) / tagScores.length);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (tagScores.length >= 3) {
    const recent = tagScores[0];
    const older = tagScores.slice(2).reduce((a, b) => a + b, 0) / tagScores.slice(2).length;
    if (recent - older > 5) trend = 'up';
    else if (older - recent > 5) trend = 'down';
  }

  return { tag, score, trend, questionCount };
}

export const studyProgressService = {
  getSubjectMastery(tag: string): SubjectMastery {
    const results = simuladoService.listResults();
    const questionCount = questionService.listBySubject(tag).length;
    return computeMastery(tag, questionCount, results);
  },

  getMasteriesForTags(tags: readonly string[]): SubjectMastery[] {
    return tags
      .map((tag) => this.getSubjectMastery(tag))
      .filter((m) => m.questionCount > 0)
      .sort((a, b) => a.score - b.score || b.questionCount - a.questionCount);
  },

  /**
   * Retorna mastery por sub-tópico dentro de uma disciplina.
   * Conta questões com q.subjectTag === subjectTag que têm cada sub-tag.
   * Ordenado por score ASC (mais fracos primeiro).
   */
  getSubTagMasteries(subjectTag: string): SubjectMastery[] {
    const questions = questionService.listBySubject(subjectTag);
    if (questions.length === 0) return [];

    // Conta questões por sub-tag
    const countPerSubTag = new Map<string, number>();
    for (const q of questions) {
      for (const subTag of q.tags) {
        if (subTag) countPerSubTag.set(subTag, (countPerSubTag.get(subTag) ?? 0) + 1);
      }
    }
    if (countPerSubTag.size === 0) return [];

    const results = simuladoService.listResults();
    return [...countPerSubTag.entries()]
      .map(([tag, count]) => computeMastery(tag, count, results))
      .sort((a, b) => a.score - b.score || b.questionCount - a.questionCount);
  },

  /**
   * Returns the tag with the lowest mastery among all subjects with questions.
   * `excludeTags` é opcional e EXCLUSIVO — ver o comentário em
   * `errorNotebookService.listPending`, mesma razão (não some tópico de concurso).
   */
  getWeakestTag(excludeTags?: Set<string>): string | null {
    const allTags = questionService.listSubjects().filter((t) => !excludeTags?.has(t));
    if (allTags.length === 0) return null;
    const masteries = this.getMasteriesForTags(allTags);
    return masteries[0]?.tag ?? null;
  },
};
