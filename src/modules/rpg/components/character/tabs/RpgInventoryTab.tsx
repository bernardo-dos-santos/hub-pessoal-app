import { type FormEvent, useState } from 'react';
import { Select } from '../../../../../shared/ui';
import { rpgInventoryPresets } from '../../../data/rpgInventoryPresets';
import { type RpgCharacter, type RpgInventoryItem, type RpgInventoryItemInput } from '../../../types/rpg';
import { RpgPanel } from '../../RpgPanel';

type RpgInventoryTabProps = {
  character: RpgCharacter;
  onAddItem: (input: RpgInventoryItemInput) => void;
  onUpdateItem: (itemId: string, updates: Partial<RpgInventoryItemInput>) => void;
  onDeleteItem: (itemId: string) => void;
};

type ItemDraft = {
  name: string;
  quantity: number;
  notes: string;
};

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

function emptyDraft(): ItemDraft {
  return { name: '', quantity: 1, notes: '' };
}

function draftFromItem(item: RpgInventoryItem): ItemDraft {
  return { name: item.name, quantity: item.quantity, notes: item.notes ?? '' };
}

export function RpgInventoryTab({ character, onAddItem, onUpdateItem, onDeleteItem }: RpgInventoryTabProps) {
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft());
  const [presetId, setPresetId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetDraft() {
    setEditingId(null);
    setPresetId('');
    setDraft(emptyDraft());
  }

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = rpgInventoryPresets.find((item) => item.id === id);
    if (preset) {
      setDraft({ name: preset.name, quantity: preset.quantity, notes: preset.notes ?? '' });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = { name: draft.name, quantity: draft.quantity, notes: draft.notes || undefined };

      if (editingId) {
        onUpdateItem(editingId, input);
        setMessage('Item atualizado.');
      } else {
        onAddItem(input);
        setMessage('Item adicionado ao inventário.');
      }

      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o item.');
    }
  }

  function handleDelete(item: RpgInventoryItem) {
    if (!window.confirm(`Excluir "${item.name}" do inventário?`)) {
      return;
    }

    onDeleteItem(item.id);
    if (editingId === item.id) {
      resetDraft();
    }
    setMessage('Item excluído.');
  }

  return (
    <div className="grid gap-4">
      <RpgPanel title={editingId ? 'Editar item' : 'Adicionar item'}>
        {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)' }}>{message}</p> : null}
        {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)' }}>{error}</p> : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {!editingId && (
            <Field label="Preset (opcional)">
              <Select className={selectClass} value={presetId} onChange={(value) => applyPreset(value)}>
                <Select.Option value="">Item personalizado</Select.Option>
                {rpgInventoryPresets.map((preset) => (
                  <Select.Option key={preset.id} value={preset.id}>{preset.name}</Select.Option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Nome">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Ex.: Kit médico"
              />
            </Field>
            <Field label="Quantidade">
              <input
                className={`${inputClass} tabular-nums`}
                type="number"
                min={0}
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })}
              />
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
              {editingId ? 'Salvar item' : 'Adicionar item'}
            </ActionButton>
            {editingId ? <ActionButton type="button" onClick={resetDraft}>Cancelar</ActionButton> : null}
          </div>
        </form>
      </RpgPanel>

      <RpgPanel title="Inventário">
        {character.inventory.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--hub-disabled)' }}>Nenhum item no inventário ainda.</p>
        ) : (
          character.inventory.map((item, i) => (
            <article
              key={item.id}
              className="py-3"
              style={{ borderBottom: i === character.inventory.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{item.name}</h3>
                <span className="shrink-0 text-sm tabular-nums" style={{ color: 'var(--hub-muted)' }}>×{item.quantity}</span>
              </div>
              {item.notes ? <p className="mt-2 text-sm leading-6" style={{ color: 'var(--hub-muted)' }}>{item.notes}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <InlineButton
                  label="Editar"
                  onClick={() => {
                    setEditingId(item.id);
                    setPresetId('');
                    setDraft(draftFromItem(item));
                    setMessage('');
                    setError('');
                  }}
                />
                <InlineButton label="Excluir" tone="danger" onClick={() => handleDelete(item)} />
              </div>
            </article>
          ))
        )}
      </RpgPanel>
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
