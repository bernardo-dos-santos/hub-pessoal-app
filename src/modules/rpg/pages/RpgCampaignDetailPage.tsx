import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { rpgCampaignService } from '../services/rpgCampaignService';
import { type RpgCampaignStatus } from '../types/rpg';

type DetailTab = 'overview' | 'notes';

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

export function RpgCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [campaign, setCampaign] = useState(() => (campaignId ? rpgCampaignService.get(campaignId) : null));
  const [name, setName] = useState(campaign?.name ?? '');
  const [system, setSystem] = useState(campaign?.system ?? '');
  const [gm, setGm] = useState(campaign?.gm ?? '');
  const [status, setStatus] = useState<RpgCampaignStatus>(campaign?.status ?? 'active');
  const [notes, setNotes] = useState(campaign?.notes ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!campaign) {
    return <Navigate to="/rpg/campanhas" replace />;
  }

  function refresh() {
    if (!campaignId) return;
    setCampaign(rpgCampaignService.get(campaignId));
  }

  function handleOverviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      rpgCampaignService.update(campaignId!, { name, system: system || undefined, gm: gm || undefined, status });
      refresh();
      setMessage('Campanha atualizada.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    }
  }

  function handleNotesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rpgCampaignService.update(campaignId!, { notes: notes || undefined });
    refresh();
    setMessage('Notas salvas.');
  }

  function handleDelete() {
    if (!window.confirm(`Excluir a campanha "${campaign!.name}"?`)) {
      return;
    }

    rpgCampaignService.remove(campaignId!);
    navigate('/rpg/campanhas');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · RPG · Campanhas" title={campaign.name} />

      <div className="hub-scroll-strip mb-6" style={{ overflowX: 'auto', cursor: 'grab' }}>
        <nav className="flex gap-1" aria-label="Abas da campanha">
          <button className={`hub-tab whitespace-nowrap${activeTab === 'overview' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('overview')}>
            Visão geral
          </button>
          <button className={`hub-tab whitespace-nowrap${activeTab === 'notes' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('notes')}>
            Notas
          </button>
        </nav>
      </div>

      {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '20px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '20px' }}>{error}</p> : null}

      {activeTab === 'overview' ? (
        <Card>
          <form onSubmit={handleOverviewSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Sistema / regras">
                <input className={inputClass} value={system} onChange={(event) => setSystem(event.target.value)} />
              </Field>
              <Field label="Mestre">
                <input className={inputClass} value={gm} onChange={(event) => setGm(event.target.value)} />
              </Field>
              <Field label="Status">
                <Select className={selectClass} value={status} onChange={(value) => setStatus(value as RpgCampaignStatus)}>
                  <Select.Option value="active">Ativa</Select.Option>
                  <Select.Option value="paused">Pausada</Select.Option>
                  <Select.Option value="finished">Encerrada</Select.Option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" tone="primary">Salvar</ActionButton>
              <ActionButton type="button" tone="danger" onClick={handleDelete}>Excluir campanha</ActionButton>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleNotesSubmit} className="grid gap-4">
            <Field label="Notas da campanha">
              <textarea className={`${inputClass} leading-6`} rows={10} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <div>
              <ActionButton type="submit" tone="primary">Salvar notas</ActionButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
  type?: 'button' | 'submit';
}) {
  const color = tone === 'primary' ? 'var(--hub-accent)' : tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-subtle)';
  return (
    <button
      className="text-sm font-medium transition-opacity hover:opacity-70"
      style={{ color, background: 'none', border: 'none', cursor: 'pointer' }}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
