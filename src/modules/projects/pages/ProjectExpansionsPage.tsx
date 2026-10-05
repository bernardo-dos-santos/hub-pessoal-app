import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Chip, EditableText, Eyebrow, ModuleHeader, Select, type Signal,
} from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { projectExpansionService } from '../services/projectExpansionService';
import { projectService } from '../services/projectService';
import {
  DEFAULT_EXPANSION_CATEGORY, EXPANSION_COMPLEXITY_LABEL, EXPANSION_FEASIBILITY_LABEL,
  EXPANSION_STATUS_LABEL, expansionCategoryLabel,
  type ExpansionComplexity, type ExpansionFeasibility, type ExpansionStatus,
  type ProjectExpansion,
} from '../types/projectExpansion';

const FEASIBILITY_SIGNAL: Record<ExpansionFeasibility, Signal> = {
  viable: 'positive',
  caveats: 'warning',
  not_viable: 'negative',
};

const COMPLEXITY_SIGNAL: Record<ExpansionComplexity, Signal> = {
  low: 'positive',
  medium: 'warning',
  high: 'negative',
};

export function ProjectExpansionsPage() {
  const { projectId = '' } = useParams();
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [complexity, setComplexity] = useState<ExpansionComplexity>('medium');
  const [error, setError] = useState('');

  const project = projectService.getById(projectId);
  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Expansões" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const all = projectExpansionService.listByProject(project.id);
  const knownCategories = projectExpansionService.listCategories(project.id);

  function add() {
    try {
      projectExpansionService.create({
        projectId: project!.id, title, category, complexity,
        description: description || undefined,
      });
      setTitle('');
      setDescription('');
      // A categoria PERMANECE: anotar várias ideias do mesmo assunto de uma vez
      // é o uso comum, e limpar obrigaria a redigitar a cada item.
      setError('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível anotar.');
    }
  }

  function setStatus(expansion: ProjectExpansion, status: ExpansionStatus) {
    projectExpansionService.setStatus(expansion.id, expansion.status === status ? 'backlog' : status);
    refresh();
  }

  function rename(expansion: ProjectExpansion, value: string) {
    projectExpansionService.setTitle(expansion.id, value);
    refresh();
  }

  function discard(expansion: ProjectExpansion) {
    if (!confirm(`Descartar "${expansion.title}"?`)) return;
    projectExpansionService.remove(expansion.id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Ideias"
        tabs={getProjectTabs(project)}
        back
      />

      <Card>
        <Eyebrow style={{ marginBottom: '8px' }}>Nova ideia</Eyebrow>
        <input
          className="w-full"
          placeholder="Ex.: widget Android de dias pro concurso"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <textarea
          className="mt-3 w-full leading-6 resize-none"
          rows={2}
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Categoria</span>
            <input
              className="w-full"
              placeholder={DEFAULT_EXPANSION_CATEGORY}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
          </label>
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Complexidade</span>
            <Select className="w-full" value={complexity} onChange={(value) => setComplexity(value as ExpansionComplexity)}>
              <Select.Option value="low">Baixa</Select.Option>
              <Select.Option value="medium">Média</Select.Option>
              <Select.Option value="high">Alta</Select.Option>
            </Select>
          </label>
        </div>
        {/* Sugestões como botões, e não um <datalist>: o popup do datalist é
            chrome do sistema operacional, exatamente o motivo pelo qual o
            <select> nativo é banido no guia. */}
        {knownCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {knownCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="text-xs transition-opacity hover:opacity-70"
                style={{
                  color: c.toLowerCase() === category.trim().toLowerCase()
                    ? 'var(--hub-accent)'
                    : 'var(--hub-subtle)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {expansionCategoryLabel(c)}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
        <div className="mt-4">
          <button onClick={add} className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Anotar
          </button>
        </div>
      </Card>

      {all.length === 0 ? (
        <Card><p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhuma ideia de expansão ainda.</p></Card>
      ) : (
        knownCategories.map((cat) => {
          const items = all.filter(
            (e) => (e.category?.trim() || DEFAULT_EXPANSION_CATEGORY).toLowerCase() === cat.toLowerCase(),
          );
          if (items.length === 0) return null;
          return (
            <Card key={cat}>
              <Eyebrow style={{ marginBottom: '10px' }}>{expansionCategoryLabel(cat)}</Eyebrow>
              {items.map((expansion, i) => {
                const discarded = expansion.status === 'discarded';
                return (
                  <div
                    key={expansion.id}
                    className="py-3"
                    style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--hub-border)', opacity: discarded ? 0.5 : 1 }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <EditableText
                        className="min-w-0"
                        inputClassName="min-w-0 flex-1 text-sm font-medium"
                        value={expansion.title}
                        onSave={(value) => rename(expansion, value)}
                        ariaLabel={`Renomear expansão ${expansion.title}`}
                      >
                        <span className="text-sm font-medium" style={{ color: 'var(--hub-text)', textDecoration: discarded ? 'line-through' : 'none' }}>
                          {expansion.title}
                        </span>
                      </EditableText>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <Chip signal={COMPLEXITY_SIGNAL[expansion.complexity]}>{EXPANSION_COMPLEXITY_LABEL[expansion.complexity]}</Chip>
                        {expansion.feasibility && (
                          <Chip signal={FEASIBILITY_SIGNAL[expansion.feasibility]}>{EXPANSION_FEASIBILITY_LABEL[expansion.feasibility]}</Chip>
                        )}
                        {expansion.status !== 'backlog' && (
                          <Chip signal="neutral">{EXPANSION_STATUS_LABEL[expansion.status]}</Chip>
                        )}
                      </div>
                    </div>

                    {expansion.description && (
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--hub-text-body)' }}>{expansion.description}</p>
                    )}
                    {expansion.feasibilityNote && (
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--hub-muted)' }}>
                        <span style={{ color: 'var(--hub-subtle)' }}>Viabilidade: </span>{expansion.feasibilityNote}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-baseline gap-4">
                      <button onClick={() => setStatus(expansion, 'implemented')} className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: expansion.status === 'implemented' ? 'var(--hub-positive)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        já implementada
                      </button>
                      <button onClick={() => setStatus(expansion, 'promoted')} className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: expansion.status === 'promoted' ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        virou frente/tarefa
                      </button>
                      <button onClick={() => discard(expansion)} className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        descartar
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })
      )}
    </div>
  );
}
