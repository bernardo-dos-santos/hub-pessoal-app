import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { getStudyTabs } from '../components/studyTabs';
import { errorNotebookService } from '../services/errorNotebookService';
import { studyContentService } from '../services/studyContentService';
import { MarkdownView } from '../components/MarkdownView';

/**
 * Aba Resumos. Ganhou `ModuleHeader` próprio: antes era headerless porque
 * dependia de um wrapper roteado (`ContentsRoute`) E era embutida como sub-aba
 * dentro de `GeneratePage` — a mesma tela em dois endereços com chrome
 * diferente. Agora tem uma rota só.
 */
export function ContentsPage() {
  const navigate = useNavigate();
  const tabs = getStudyTabs(errorNotebookService.countPending());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contents, setContents] = useState(() => studyContentService.listContents());

  function handleDelete(id: string) {
    studyContentService.delete(id);
    setContents(studyContentService.listContents());
    if (expandedId === id) setExpandedId(null);
    setDeletingId(null);
  }

  if (contents.length === 0) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Resumos" tabs={tabs} />
        <div className="py-8 text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--hub-subtle)' }}>Nenhum resumo salvo ainda</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Resumos gerados a partir de material da faculdade aparecem aqui — o salvamento é automático.
          </p>
          <Link
            to="/estudos/resumos/novo"
            className="mt-3 inline-block text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)' }}
          >
            Gerar um resumo →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Resumos" tabs={tabs} />
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{contents.length} resumo(s) salvo(s)</p>
        <Link to="/estudos/resumos/novo" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
          Novo resumo
        </Link>
      </div>

      {contents.map((c) => {
        const isExpanded = expandedId === c.id;
        const isDeleting = deletingId === c.id;
        const date = new Date(c.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        return (
          <div
            key={c.id}
            style={{ borderBottom: '1px solid var(--hub-border)' }}
          >
            {/* Cabeçalho */}
            <div
              className="flex cursor-pointer items-start justify-between gap-3 py-3"
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{c.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {c.subjectTag && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--hub-accent)' }}>
                      {c.subjectTag}
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: 'var(--hub-subtle)' }}>{date}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {!isDeleting ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/estudos/resumos/${c.id}`); }}
                      className="text-xs font-bold transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      📖 Abrir
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }}
                      className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Excluir
                    </button>
                  </>
                ) : (
                  <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs font-bold transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                <span className="text-xs select-none" style={{ color: 'var(--hub-subtle)' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Conteúdo expandido */}
            {isExpanded && (
              <div className="pb-4" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
                {c.summary ? (
                  <MarkdownView content={c.summary} />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Sem resumo salvo neste conteúdo.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
