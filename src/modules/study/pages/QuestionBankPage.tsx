import { Link } from 'react-router-dom';
import { Card, Eyebrow, ListRow, ModuleHeader } from '../../../shared/ui';
import { getStudyTabs } from '../components/studyTabs';
import { deckService } from '../services/deckService';
import { errorNotebookService } from '../services/errorNotebookService';
import { questionService } from '../services/questionService';

/**
 * Aba Questões: o banco por disciplina, com as duas ações que se faz com ele.
 *
 * Existe porque a aba precisava de um destino próprio — antes o banco de questões
 * não tinha tela nenhuma: as questões eram geradas em "Criar conteúdo" e só
 * reapareciam dentro de um simulado ou de uma sessão, sem lugar onde olhar
 * quantas existem e de quê.
 */
export function QuestionBankPage() {
  const subjects = questionService.listSubjects();
  const total = questionService.count();
  const due = deckService.dueQuestionsCount();

  return (
    <div>
      <ModuleHeader
        eyebrow="Módulo · Estudos"
        title="Questões"
        tabs={getStudyTabs(errorNotebookService.countPending())}
      />

      <Card className="mb-5">
        <Eyebrow style={{ marginBottom: '8px' }}>Banco</Eyebrow>
        {subjects.length === 0 ? (
          <p className="py-2 text-sm" style={{ color: 'var(--hub-disabled)' }}>
            Nenhuma questão ainda. Gere a partir de um material da faculdade ou de um tema de concurso.
          </p>
        ) : (
          subjects.map((tag, i) => (
            <ListRow
              key={tag}
              to={`/estudos/questoes/gerar?tag=${encodeURIComponent(tag)}`}
              label={<span style={{ fontSize: '14px', color: 'var(--hub-text)' }}>{tag}</span>}
              value={(
                <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
                  {questionService.listBySubject(tag).length}
                </span>
              )}
              last={i === subjects.length - 1}
            />
          ))
        )}
      </Card>

      <div className="flex items-baseline gap-5">
        <Link
          to="/estudos/questoes/gerar"
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)' }}
        >
          Gerar questões
        </Link>
        {total > 0 && (
          <Link
            to="/estudos/questoes/praticar"
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-text-body)' }}
          >
            Praticar{due > 0 ? ` · ${due} vencidas` : ''}
          </Link>
        )}
      </div>
    </div>
  );
}
