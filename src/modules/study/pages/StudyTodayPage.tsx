import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ModuleHeader, Card, Eyebrow, ListRow } from '../../../shared/ui';
import { getStudyTabs } from '../components/studyTabs';
import { studyProgressService } from '../services/studyProgressService';
import { deckService } from '../services/deckService';
import { questionService } from '../services/questionService';
import { errorNotebookService } from '../services/errorNotebookService';
import { autoGenerateService } from '../services/autoGenerateService';
import { retentionService } from '../services/retentionService';
import { sessionCompletionService, type CompletionStatus } from '../services/sessionCompletionService';
import { jarvisCheckInService } from '../services/jarvisCheckInService';
import { subjectService } from '../../college/services/subjectService';
import type { WeeklySession } from '../../planner/types/routine';

const SESSION_TYPE_LABEL: Record<string, string> = {
  study: 'Estudo', review: 'Revisão', train: 'Treino', rest: 'Descanso', admin: 'Admin', other: 'Outro',
};

function TodaySession({
  session,
  index,
  weekOf,
  status,
  onMark,
}: {
  session: WeeklySession;
  index: number;
  weekOf: string;
  status: CompletionStatus | null;
  onMark: (status: CompletionStatus) => void;
}) {
  const statusColor = status === 'done' ? 'var(--hub-positive)' : status === 'partial' ? 'var(--hub-warning)' : status === 'skipped' ? 'var(--hub-negative)' : 'var(--hub-disabled)';

  return (
    <div
      key={`${weekOf}:${index}`}
      style={{
        paddingTop: '10px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--hub-border)',
        opacity: status === 'skipped' ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="tabular-nums shrink-0" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
              {session.startTime}
            </span>
            <span className="truncate" style={{ fontSize: '13px', color: status === 'done' ? 'var(--hub-positive)' : 'var(--hub-text)', textDecoration: status === 'skipped' ? 'line-through' : 'none' }}>
              {session.topic}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
              {SESSION_TYPE_LABEL[session.type] ?? session.type} · {session.durationMinutes}min
            </span>
            {status && (
              <span style={{ fontSize: '10px', color: statusColor, fontWeight: 500 }}>
                {status === 'done' ? '✓ Feito' : status === 'partial' ? '~ Parcial' : '✗ Pulado'}
              </span>
            )}
          </div>
        </div>

        {!status && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onMark('done')} className="text-xs transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-positive)' }}>✓</button>
            <button onClick={() => onMark('partial')} className="text-xs transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-warning)' }}>~</button>
            <button onClick={() => onMark('skipped')} className="text-xs transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-negative)' }}>✗</button>
          </div>
        )}

        {status && (
          <button
            onClick={() => {
              sessionCompletionService.markSession(weekOf, index, 'done' === status ? 'skipped' : 'done');
              onMark(status === 'done' ? 'skipped' : 'done');
            }}
            className="text-[10px] shrink-0 transition-opacity hover:opacity-70"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-disabled)' }}
          >
            desfazer
          </button>
        )}
      </div>
    </div>
  );
}

export function StudyTodayPage() {
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Record<number, CompletionStatus>>({});
  const navigate = useNavigate();

  // Exclusivo (não inclusivo): tira só matéria arquivada, mantém tópico de
  // concurso — ver o comentário em subjectService.listArchivedSubjectTags().
  const activeSubjects = subjectService.listActiveSubjects();
  const archivedTags = subjectService.listArchivedSubjectTags();
  const dueCards = deckService.dueQuestionsCount(archivedTags);
  const pendingErrors = errorNotebookService.countPending(archivedTags);
  const weakestTag = studyProgressService.getWeakestTag(archivedTags);
  const recentRetention = retentionService.getRecentRate(7);

  const todaySessions = sessionCompletionService.getTodaySessions();
  const weekOf = sessionCompletionService.getCurrentWeekOf();

  const checkIn = jarvisCheckInService.getTodayCheckIn();
  const burnoutRisk = jarvisCheckInService.getBurnoutRisk();

  useEffect(() => {
    if (weekOf) {
      setCompletions(sessionCompletionService.getWeekCompletions(weekOf));
    }

    const notice = autoGenerateService.getLastNotice();
    if (notice) setAutoNotice(notice);

    // Faculdade primeiro (uso principal do módulo), concurso só se sobrar cota.
    // A segunda chamada é barata quando a primeira gerou: `canGenerate` já vê
    // callCount no teto do dia e volta sem tocar na IA.
    (async () => {
      const fromCollege = await autoGenerateService.runAutoGenerate('college');
      const results = fromCollege.length > 0
        ? fromCollege
        : await autoGenerateService.runAutoGenerate('cbmsc');

      if (results.length > 0) {
        const label = results
          .map((r) => {
            const topic = r.subTag ? `${r.tag} — ${r.subTag}` : r.tag;
            return `${r.count} ${r.type === 'questions' ? 'questões' : 'resumo'} de ${topic}`;
          })
          .join(', ');
        const text = `Gerado automaticamente: ${label}`;
        autoGenerateService.saveNotice(text);
        setAutoNotice(text);
        return;
      }

      // Falhou em silêncio era o comportamento antigo: o serviço grava o motivo
      // em study.autoGen.notice, então basta reler para o aviso chegar na tela.
      const notice = autoGenerateService.getLastNotice();
      if (notice) setAutoNotice(notice);
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

  const hasToday = dueCards > 0 || pendingErrors > 0;

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Estudar" tabs={getStudyTabs(pendingErrors)} />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Estado do dia
          </p>
          <div className="flex items-center gap-3">
            {checkIn && checkIn.energy > 0 && (
              <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                ⚡{checkIn.energy}/5
              </span>
            )}
            {burnoutRisk === 'high' && (
              <span className="text-xs" style={{ color: 'var(--hub-negative)' }}>⚠ sobrecarga</span>
            )}
            {recentRetention !== null && (
              <span
                className="text-xs tabular-nums"
                style={{ color: recentRetention >= 80 ? 'var(--hub-positive)' : recentRetention >= 60 ? 'var(--hub-warning)' : 'var(--hub-negative)' }}
              >
                ret. {recentRetention}%
              </span>
            )}
          </div>
        </div>

        {autoNotice && (
          <p className="mb-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            ✨ {autoNotice}
          </p>
        )}

        {hasToday && (
          <div className="flex gap-4 mb-4">
            {dueCards > 0 && (
              <span className="text-xs" style={{ color: 'var(--hub-muted)' }}>
                <span className="tabular-nums font-medium" style={{ color: 'var(--hub-text)' }}>{dueCards}</span> vencidos
              </span>
            )}
            {pendingErrors > 0 && (
              <span className="text-xs" style={{ color: 'var(--hub-muted)' }}>
                <span className="tabular-nums font-medium" style={{ color: 'var(--hub-text)' }}>{pendingErrors}</span> erros pendentes
              </span>
            )}
          </div>
        )}
        {!hasToday && (
          <p className="mb-4 text-xs" style={{ color: 'var(--hub-subtle)' }}>Em dia — manter a sequência.</p>
        )}

        {/* Sessões planejadas para hoje */}
        {todaySessions.length > 0 && weekOf && (
          <div className="mb-4" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
            {todaySessions.map(({ session, index }) => (
              <TodaySession
                key={`${weekOf}:${index}`}
                session={session}
                index={index}
                weekOf={weekOf}
                status={completions[index] ?? null}
                onMark={(s) => handleMark(index, s)}
              />
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
          <button
            onClick={() => navigate('/estudos/questoes/praticar')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            className="group w-full"
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--hub-accent)' }}>
              ▶ Começar sessão
            </span>
            {weakestTag && (
              <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {dueCards > 0 ? `${dueCards} SM-2 · ` : ''}Praticar {weakestTag}
              </p>
            )}
          </button>
        </div>
      </Card>

      {/* Disciplinas. É a resposta para "preciso estudar Grafos" — a pergunta que
          o módulo não respondia, porque tudo era organizado por ferramenta e
          cada ferramenta perguntava a matéria depois. */}
      {activeSubjects.length > 0 && (
        <Card className="mt-5">
          <Eyebrow style={{ marginBottom: '8px' }}>Disciplinas</Eyebrow>
          {activeSubjects.map((subject, i) => {
            const questionCount = questionService.listBySubject(subject.name).length;
            const pending = errorNotebookService.listBySubject(subject.name)
              .filter((e) => e.status !== 'mastered').length;
            return (
              <ListRow
                key={subject.id}
                to={`/estudos/disciplina/${encodeURIComponent(subject.name)}`}
                label={<span style={{ fontSize: '14px', color: 'var(--hub-text)' }}>{subject.name}</span>}
                value={(
                  <span className="tabular-nums" style={{ fontSize: '12px', color: pending > 0 ? 'var(--hub-warning)' : 'var(--hub-subtle)' }}>
                    {questionCount > 0 ? `${questionCount}q` : '—'}
                    {pending > 0 && ` · ${pending} erro(s)`}
                  </span>
                )}
                last={i === activeSubjects.length - 1}
              />
            );
          })}
        </Card>
      )}
    </div>
  );
}
