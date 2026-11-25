import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ModuleHeader, Card, Eyebrow, ListRow, Button } from '../../../shared/ui';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { studyAlertProvider } from '../alerts/studyAlertProvider';
import { getStudyTabs } from '../components/studyTabs';
import { studyProgressService } from '../services/studyProgressService';
import { studySessionService } from '../services/studySessionService';
import { deckService } from '../services/deckService';
import { questionService } from '../services/questionService';
import { errorNotebookService } from '../services/errorNotebookService';
import { autoGenerateService } from '../services/autoGenerateService';
import { retentionService } from '../services/retentionService';
import { sessionCompletionService, type CompletionStatus } from '../services/sessionCompletionService';
import { jarvisCheckInService } from '../services/jarvisCheckInService';
import { subjectService } from '../../college/services/subjectService';
import { TodaySessionRow } from '../../planner/components/TodaySessionRow';

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Resumo dos Estudos no formato dos módulos: o hero
 * responde "o que eu estudo agora?" num número e numa frase — o que está vencido
 * (flashcards + erros) e a disciplina mais fraca — com o botão que começa. Ao
 * lado (embaixo no celular) o "Precisa de você" do próprio alert provider; o
 * ritmo e as disciplinas vêm depois da resposta.
 */
export function StudyTodayPage() {
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Record<number, CompletionStatus>>({});
  const navigate = useNavigate();

  // Exclusivo (não inclusivo): tira só matéria arquivada — ver o comentário em
  // subjectService.listArchivedSubjectTags().
  const activeSubjects = subjectService.listActiveSubjects();
  const archivedTags = subjectService.listArchivedSubjectTags();
  const dueCards = deckService.dueQuestionsCount(archivedTags);
  const pendingErrors = errorNotebookService.countPending(archivedTags);
  const weakestTag = studyProgressService.getWeakestTag(archivedTags);
  const masteries = new Map(studyProgressService.getMasteriesForTags(activeSubjects.map((s) => s.name)).map((m) => [m.tag, m]));
  const weakest = weakestTag ? masteries.get(weakestTag) : undefined;
  const recentRetention = retentionService.getRecentRate(7);
  const streak = studySessionService.getStreak();
  const todayMinutes = studySessionService.getTodayMinutes();

  // O plano da semana tem o dia inteiro (treino, descanso…); aqui só o que é estudo.
  const todaySessions = sessionCompletionService.getTodaySessions()
    .filter(({ session }) => session.type === 'study' || session.type === 'review');
  const weekOf = sessionCompletionService.getCurrentWeekOf();

  const checkIn = jarvisCheckInService.getTodayCheckIn();
  const burnoutRisk = jarvisCheckInService.getBurnoutRisk();

  useEffect(() => {
    if (weekOf) setCompletions(sessionCompletionService.getWeekCompletions(weekOf));

    if (!autoGenerateService.isEnabled()) return;
    const notice = autoGenerateService.getLastNotice();
    if (notice) setAutoNotice(notice);

    (async () => {
      const results = await autoGenerateService.runAutoGenerate();

      if (results.length > 0) {
        const label = results
          .map((r) => `${r.count} ${r.type === 'questions' ? 'questões' : 'resumo'} de ${r.tag}`)
          .join(', ');
        const text = `Gerado automaticamente: ${label}`;
        autoGenerateService.saveNotice(text);
        setAutoNotice(text);
        return;
      }

      // O serviço grava o motivo de não ter gerado em study.autoGen.notice;
      // reler é o que faz o aviso chegar na tela em vez de falhar em silêncio.
      const after = autoGenerateService.getLastNotice();
      if (after) setAutoNotice(after);
    })().catch((err) => {
      autoGenerateService.saveNotice(`Geração automática falhou: ${err instanceof Error ? err.message : String(err)}`);
      setAutoNotice(autoGenerateService.getLastNotice() ?? '');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMark(sessionIndex: number, status: CompletionStatus) {
    if (!weekOf) return;
    sessionCompletionService.markSession(weekOf, sessionIndex, status);
    setCompletions(sessionCompletionService.getWeekCompletions(weekOf));
  }

  const dueTotal = dueCards + pendingErrors;
  const dueParts = [
    dueCards > 0 ? plural(dueCards, 'flashcard vencido', 'flashcards vencidos') : null,
    pendingErrors > 0 ? plural(pendingErrors, 'erro para revisar', 'erros para revisar') : null,
  ].filter(Boolean).join(' e ');
  const weakSentence = weakestTag
    ? `A mais fraca é ${weakestTag}${weakest && weakest.score > 0 ? ` (${weakest.score}% de acerto)` : ''} — a sessão começa por ela.`
    : activeSubjects.length === 0
      ? 'Cadastre as disciplinas na Faculdade para os Estudos se organizarem por elas.'
      : 'Ainda não há questões respondidas para saber qual disciplina está mais fraca.';

  const rhythm: { label: string; value: string; color?: string }[] = [
    { label: 'Sequência', value: streak > 0 ? plural(streak, 'dia', 'dias') : '—' },
    { label: 'Hoje', value: todayMinutes > 0 ? `${todayMinutes} min` : '—' },
  ];
  if (recentRetention !== null) {
    rhythm.push({
      label: 'Retenção 7 dias',
      value: `${recentRetention}%`,
      color: recentRetention >= 80 ? 'var(--hub-positive)' : recentRetention >= 60 ? 'var(--hub-warning)' : 'var(--hub-negative)',
    });
  }
  if (checkIn && checkIn.energy > 0) rhythm.push({ label: 'Energia', value: `${checkIn.energy}/5` });
  if (burnoutRisk === 'high') rhythm.push({ label: 'Carga', value: 'sobrecarga — pegue leve', color: 'var(--hub-negative)' });

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Hoje" tabs={getStudyTabs(pendingErrors)} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <p className="font-medium uppercase" style={sectionLabel}>Para hoje</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tabular-nums" style={{ fontSize: '58px', lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em', color: dueTotal > 0 ? 'var(--hub-text)' : 'var(--hub-positive)' }}>
                {dueTotal}
              </span>
              <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>
                {dueTotal > 0 ? 'para revisar' : 'em dia'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
              {dueTotal > 0 ? `${dueParts[0].toUpperCase()}${dueParts.slice(1)}. ` : 'Nada vencido — é dia de avançar matéria. '}
              {weakSentence}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button type="button" onClick={() => navigate(weakestTag ? `/estudos/questoes/praticar?tag=${encodeURIComponent(weakestTag)}` : '/estudos/questoes/praticar')}>
                Começar sessão
              </Button>
              {dueCards > 0 && (
                <Link to="/estudos/flashcards/praticar/misto" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
                  Revisar flashcards
                </Link>
              )}
              {pendingErrors > 0 && (
                <Link to="/estudos/erros/drill" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
                  Refazer erros
                </Link>
              )}
            </div>

            {autoNotice && (
              <p className="mt-4 text-xs" style={{ color: 'var(--hub-subtle)' }}>{autoNotice}</p>
            )}

            {todaySessions.length > 0 && weekOf && (
              <div className="mt-5" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
                <p className="font-medium uppercase" style={sectionLabel}>No plano de hoje</p>
                {todaySessions.map(({ session, index }, i) => (
                  <TodaySessionRow
                    key={`${weekOf}:${index}`}
                    session={session}
                    status={completions[index] ?? null}
                    last={i === todaySessions.length - 1}
                    onMark={(s) => handleMark(index, s)}
                  />
                ))}
              </div>
            )}
          </Card>

          <ModuleAttentionCard provider={studyAlertProvider} className="lg:hidden" />

          {/* Disciplinas. É a resposta para "preciso estudar Grafos" — a pergunta que
              o módulo não respondia, porque tudo era organizado por ferramenta e
              cada ferramenta perguntava a matéria depois. */}
          {activeSubjects.length > 0 && (
            <Card>
              <Eyebrow style={{ marginBottom: '8px' }}>Disciplinas</Eyebrow>
              {activeSubjects.map((subject, i) => {
                const questionCount = questionService.listBySubject(subject.name).length;
                const pending = errorNotebookService.listBySubject(subject.name)
                  .filter((e) => e.status !== 'mastered').length;
                const mastery = masteries.get(subject.name);
                const meta = [
                  questionCount > 0 ? plural(questionCount, 'questão', 'questões') : 'sem questões',
                  pending > 0 ? plural(pending, 'erro', 'erros') : null,
                ].filter(Boolean).join(' · ');
                return (
                  <ListRow
                    key={subject.id}
                    to={`/estudos/disciplina/${encodeURIComponent(subject.name)}`}
                    label={(
                      <>
                        <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{subject.name}</p>
                        <p className="mt-0.5 text-xs" style={{ color: pending > 0 ? 'var(--hub-warning)' : 'var(--hub-subtle)' }}>{meta}</p>
                      </>
                    )}
                    value={(
                      <span className="tabular-nums text-sm" style={{ color: mastery && mastery.score > 0 ? (mastery.score >= 70 ? 'var(--hub-positive)' : mastery.score >= 50 ? 'var(--hub-warning)' : 'var(--hub-negative)') : 'var(--hub-subtle)' }}>
                        {mastery && mastery.score > 0 ? `${mastery.score}%` : '—'}
                        {mastery?.trend === 'up' ? ' ↑' : mastery?.trend === 'down' ? ' ↓' : ''}
                      </span>
                    )}
                    last={i === activeSubjects.length - 1}
                  />
                );
              })}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={studyAlertProvider} className="hidden lg:block" />
          <Card>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>Ritmo</p>
            {rhythm.map((row, i) => (
              <ListRow
                key={row.label}
                label={row.label}
                value={<span className="tabular-nums" style={{ color: row.color ?? 'var(--hub-text)' }}>{row.value}</span>}
                last={i === rhythm.length - 1}
              />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
