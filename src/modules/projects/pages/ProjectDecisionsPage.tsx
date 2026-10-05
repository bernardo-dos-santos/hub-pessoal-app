import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, EditableText, Eyebrow, ModuleHeader, Select } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { frontService } from '../services/frontService';
import { projectDecisionService } from '../services/projectDecisionService';
import { projectService } from '../services/projectService';
import { type ProjectDecision } from '../types/projectDecision';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LABEL_STYLE = {
  fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', color: 'var(--hub-subtle)',
};

export function ProjectDecisionsPage() {
  const { projectId = '' } = useParams();
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [discarded, setDiscarded] = useState('');
  const [frontId, setFrontId] = useState('');
  const [error, setError] = useState('');

  const project = projectService.getById(projectId);
  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Decisões" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const fronts = frontService.listByProject(project.id);
  const decisions = projectDecisionService.listByProject(project.id);

  function save() {
    try {
      projectDecisionService.create({
        projectId: project!.id, title, why,
        discarded: discarded || undefined,
        frontId: frontId || undefined,
      });
      setTitle(''); setWhy(''); setDiscarded(''); setFrontId('');
      setError('');
      setOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar.');
    }
  }

  function rename(decision: ProjectDecision, value: string) {
    projectDecisionService.setTitle(decision.id, value);
    refresh();
  }

  function remove(decision: ProjectDecision) {
    if (!confirm(`Apagar o registro "${decision.title}"?\n\nO motivo por trás dela some junto.`)) return;
    projectDecisionService.remove(decision.id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Decisões"
        tabs={getProjectTabs(project)}
        back
        right={
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {open ? 'Cancelar' : '+ Registrar'}
          </button>
        }
      />

      {open && (
        <Card>
          <label className="block">
            <span style={LABEL_STYLE}>O que foi decidido</span>
            <input
              className="w-full"
              autoFocus
              placeholder="Ex.: frente no lugar de fase"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="mt-4 block">
            <span style={LABEL_STYLE}>Por quê</span>
            <textarea
              className="w-full leading-6 resize-none"
              rows={3}
              placeholder="O que motivou. É a parte que some da memória."
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          </label>

          <label className="mt-4 block">
            <span style={LABEL_STYLE}>O que foi descartado</span>
            <textarea
              className="w-full leading-6 resize-none"
              rows={2}
              placeholder="Opcional — o que se considerou e rejeitou, e por quê."
              value={discarded}
              onChange={(e) => setDiscarded(e.target.value)}
            />
          </label>

          {fronts.length > 0 && (
            <label className="mt-4 block">
              <span style={LABEL_STYLE}>Frente</span>
              <Select className="w-full" value={frontId} onChange={setFrontId}>
                <Select.Option value="">O projeto todo</Select.Option>
                {fronts.map((f) => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
              </Select>
            </label>
          )}

          {error && <p className="mt-3 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}

          <div className="mt-5">
            <button
              onClick={save}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Registrar decisão
            </button>
          </div>
        </Card>
      )}

      {decisions.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            Nenhuma decisão registrada. "O que decidimos" costuma sobreviver no código — "por quê"
            e "o que foi descartado" evaporam em semanas, e é o que faz a mesma discussão voltar do zero.
          </p>
        </Card>
      ) : (
        decisions.map((decision) => {
          const front = decision.frontId ? fronts.find((f) => f.id === decision.frontId) : null;
          const superseded = Boolean(decision.supersededById);
          return (
            <Card key={decision.id}>
              <div style={{ opacity: superseded ? 0.55 : 1 }}>
                <div className="flex items-baseline justify-between gap-3">
                  <EditableText
                    className="min-w-0"
                    inputClassName="min-w-0 flex-1 text-sm font-medium"
                    value={decision.title}
                    onSave={(value) => rename(decision, value)}
                    ariaLabel={`Renomear decisão ${decision.title}`}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>
                      {decision.title}
                    </span>
                  </EditableText>
                  <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
                    {formatDate(decision.decidedOn)}
                  </span>
                </div>

                <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {front?.name ?? 'projeto todo'}
                  {superseded && ' · substituída'}
                </p>

                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
                  <span style={{ color: 'var(--hub-text)' }}>Por quê: </span>
                  {decision.why}
                </p>

                {decision.discarded && (
                  <p
                    className="mt-3 pt-3 text-xs leading-5"
                    style={{ color: 'var(--hub-muted)', borderTop: '1px solid var(--hub-border)' }}
                  >
                    <span style={{ color: 'var(--hub-subtle)' }}>Descartado: </span>
                    {decision.discarded}
                  </p>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => remove(decision)}
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    apagar
                  </button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
