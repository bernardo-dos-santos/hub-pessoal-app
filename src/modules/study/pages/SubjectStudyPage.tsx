import { Link, useParams } from 'react-router-dom';
import { Card, Eyebrow, ListRow, ModuleHeader } from '../../../shared/ui';
import { MasteryRow } from '../components/MasteryRow';
import { errorNotebookService } from '../services/errorNotebookService';
import { questionService } from '../services/questionService';
import { studyContentService } from '../services/studyContentService';
import { studyProgressService } from '../services/studyProgressService';

/**
 * Tudo de uma matéria num lugar só, com as ações já apontando para ela.
 *
 * O módulo era organizado por ferramenta (gerar / simular / praticar), e cada
 * ferramenta perguntava "qual matéria?". Mas a pergunta que o Bernardo traz é o
 * contrário — "preciso estudar Grafos" — e não havia tela que respondesse a ela.
 * Aqui a matéria é o assunto e as ferramentas são os verbos, todas com `?tag=`
 * preenchido para não repetir a escolha na tela seguinte.
 */
export function SubjectStudyPage() {
  const { tag = '' } = useParams();
  const subjectTag = decodeURIComponent(tag);
  const q = encodeURIComponent(subjectTag);

  const questions = questionService.listBySubject(subjectTag);
  const contents = studyContentService.listContents().filter((c) => c.subjectTag === subjectTag);
  const errors = errorNotebookService.listBySubject(subjectTag);
  const pendingErrors = errors.filter((e) => e.status !== 'mastered');
  const mastery = studyProgressService.getSubjectMastery(subjectTag);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title={subjectTag} />

      <Card className="mb-5">
        <Eyebrow style={{ marginBottom: '8px' }}>Domínio</Eyebrow>
        {mastery.questionCount > 0 ? (
          <MasteryRow
            label={subjectTag}
            score={mastery.score}
            trend={mastery.trend}
            detail={`${mastery.questionCount} questão(ões) no banco`}
          />
        ) : (
          <p className="py-2 text-sm" style={{ color: 'var(--hub-disabled)' }}>
            Sem questões ainda — o domínio aparece depois do primeiro simulado.
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <Eyebrow style={{ marginBottom: '8px' }}>Material</Eyebrow>
        <ListRow
          to={`/estudos/resumos`}
          label={<span style={{ fontSize: '14px', color: 'var(--hub-text)' }}>Resumos</span>}
          value={<span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>{contents.length}</span>}
        />
        <ListRow
          to={`/estudos/questoes`}
          label={<span style={{ fontSize: '14px', color: 'var(--hub-text)' }}>Questões</span>}
          value={<span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>{questions.length}</span>}
        />
        <ListRow
          to={`/estudos/erros`}
          label={<span style={{ fontSize: '14px', color: 'var(--hub-text)' }}>Erros pendentes</span>}
          value={(
            <span
              className="tabular-nums"
              style={{ fontSize: '12px', color: pendingErrors.length > 0 ? 'var(--hub-warning)' : 'var(--hub-subtle)' }}
            >
              {pendingErrors.length}
            </span>
          )}
          last
        />
      </Card>

      <Card>
        <Eyebrow style={{ marginBottom: '10px' }}>Estudar isto</Eyebrow>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Link to={`/estudos/resumos/novo?tag=${q}`} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
            Gerar resumo
          </Link>
          <Link to={`/estudos/questoes/gerar?tag=${q}`} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
            Gerar questões
          </Link>
          {questions.length > 0 && (
            <Link to={`/estudos/questoes/praticar?tag=${q}`} className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--hub-text-body)' }}>
              Praticar
            </Link>
          )}
          {questions.length > 0 && (
            <Link to={`/estudos/simulados?tag=${q}`} className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--hub-text-body)' }}>
              Simulado
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
