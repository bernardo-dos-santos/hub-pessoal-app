import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { getRpgTabs } from '../components/rpgTabs';
import { rpgCampaignService } from '../services/rpgCampaignService';
import { type RpgCampaign, type RpgCampaignStatus } from '../types/rpg';

type CampaignDraft = {
  name: string;
  system: string;
  gm: string;
  status: RpgCampaignStatus;
  notes: string;
};

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

const statusLabel: Record<RpgCampaignStatus, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  finished: 'Encerrada',
};

function emptyDraft(): CampaignDraft {
  return { name: '', system: '', gm: '', status: 'active', notes: '' };
}

function draftFromCampaign(campaign: RpgCampaign): CampaignDraft {
  return {
    name: campaign.name,
    system: campaign.system ?? '',
    gm: campaign.gm ?? '',
    status: campaign.status,
    notes: campaign.notes ?? '',
  };
}

export function RpgCampaignsPage() {
  const [campaigns, setCampaigns] = useState(() => rpgCampaignService.list());
  const [draft, setDraft] = useState<CampaignDraft>(() => emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function refresh() {
    setCampaigns(rpgCampaignService.list());
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        name: draft.name,
        system: draft.system || undefined,
        gm: draft.gm || undefined,
        status: draft.status,
        notes: draft.notes || undefined,
      };

      if (editingId) {
        rpgCampaignService.update(editingId, input);
        setMessage('Campanha atualizada.');
      } else {
        rpgCampaignService.create(input);
        setMessage('Campanha criada.');
      }

      refresh();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar a campanha.');
    }
  }

  function handleDelete(campaign: RpgCampaign) {
    if (!window.confirm(`Excluir a campanha "${campaign.name}"?`)) {
      return;
    }

    rpgCampaignService.remove(campaign.id);
    refresh();
    if (editingId === campaign.id) {
      resetDraft();
    }
    setMessage('Campanha excluída.');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · RPG" title="Campanhas" tabs={getRpgTabs()} />

      {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '20px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '20px' }}>{error}</p> : null}

      <Card className="mb-5">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            {editingId ? 'Editar campanha' : 'Criar campanha'}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Ex.: Mesa do Heitor"
              />
            </Field>
            <Field label="Sistema / regras">
              <input
                className={inputClass}
                value={draft.system}
                onChange={(event) => setDraft({ ...draft, system: event.target.value })}
                placeholder="Ex.: Ordem Paranormal híbrida"
              />
            </Field>
            <Field label="Mestre">
              <input
                className={inputClass}
                value={draft.gm}
                onChange={(event) => setDraft({ ...draft, gm: event.target.value })}
                placeholder="Ex.: Heitor"
              />
            </Field>
            <Field label="Status">
              <Select
                className={selectClass}
                value={draft.status}
                onChange={(value) => setDraft({ ...draft, status: value as RpgCampaignStatus })}
              >
                <Select.Option value="active">Ativa</Select.Option>
                <Select.Option value="paused">Pausada</Select.Option>
                <Select.Option value="finished">Encerrada</Select.Option>
              </Select>
            </Field>
          </div>

          <Field label="Notas (opcional)">
            <textarea
              className={`${inputClass} leading-6`}
              rows={2}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <ActionButton type="submit" tone="primary">
              {editingId ? 'Salvar campanha' : 'Criar campanha'}
            </ActionButton>
            {editingId ? <ActionButton type="button" onClick={resetDraft}>Cancelar</ActionButton> : null}
          </div>
        </form>
      </Card>

      <Card>
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}>
          Suas campanhas
        </p>
        {campaigns.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--hub-disabled)', fontStyle: 'italic' }}>
            Nenhuma campanha criada ainda.
          </p>
        ) : (
          <div>
            {campaigns.map((campaign, i) => (
              <div
                key={campaign.id}
                style={{ paddingBottom: '14px', marginBottom: i === campaigns.length - 1 ? 0 : '14px', borderBottom: i === campaigns.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <Link to={`/rpg/campanhas/${campaign.id}`} className="min-w-0 transition-opacity hover:opacity-75">
                    <p style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400 }}>{campaign.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                      {[campaign.system, campaign.gm ? `Mestre: ${campaign.gm}` : null].filter(Boolean).join(' · ') || 'Sem detalhes'}
                    </p>
                  </Link>
                  <span style={{ fontSize: '10px', color: campaign.status === 'active' ? 'var(--hub-positive)' : 'var(--hub-subtle)', flexShrink: 0 }}>
                    {statusLabel[campaign.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <InlineButton
                    label="Editar"
                    onClick={() => {
                      setEditingId(campaign.id);
                      setDraft(draftFromCampaign(campaign));
                      setMessage('');
                      setError('');
                    }}
                  />
                  <InlineButton label="Excluir" tone="danger" onClick={() => handleDelete(campaign)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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
  tone?: 'neutral' | 'primary';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      className="text-sm font-medium transition-opacity hover:opacity-70"
      style={{ color: tone === 'primary' ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InlineButton({ label, onClick, tone = 'neutral' }: { label: string; onClick(): void; tone?: 'neutral' | 'danger' }) {
  return (
    <button
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: tone === 'danger' ? 'var(--hub-negative)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
