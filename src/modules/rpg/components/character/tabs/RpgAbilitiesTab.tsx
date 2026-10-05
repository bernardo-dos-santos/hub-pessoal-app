import { type FormEvent, useState } from 'react';
import { Select } from '../../../../../shared/ui';
import { rpgAbilityPresets } from '../../../data/rpgAbilityPresets';
import { rpgAbilityCategoryLabels } from '../rpgCharacterHelpers';
import { RpgFormulaChip } from '../../RpgFormulaChip';
import { RpgPanel } from '../../RpgPanel';
import { RpgTrackerList } from '../RpgTrackerList';
import { type RpgAbility, type RpgAbilityCategory, type RpgAbilityInput, type RpgCharacter } from '../../../types/rpg';
import { applyRpgDamageModifiers } from '../../../utils/rpgCombatModifiers';
import { type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgAbilitiesTabProps = {
  character: RpgCharacter;
  groupedAbilities: Record<string, RpgAbility[]>;
  variables: RpgFormulaVariables;
  onCreateAbility: (input: RpgAbilityInput) => void;
  onUpdateAbility: (ability: RpgAbility) => void;
  onDeleteAbility: (abilityId: string) => void;
  onTrackerChange: (abilityId: string, trackerId: string, used: number) => void;
  onUseAbility: (ability: RpgAbility) => void;
};

type AbilityDraft = {
  category: RpgAbilityCategory;
  title: string;
  summary: string;
  description: string;
};

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

function emptyDraft(): AbilityDraft {
  return { category: 'other', title: '', summary: '', description: '' };
}

function draftFromAbility(ability: RpgAbility): AbilityDraft {
  return { category: ability.category, title: ability.title, summary: ability.summary ?? '', description: ability.description };
}

export function RpgAbilitiesTab({
  character,
  groupedAbilities,
  variables,
  onCreateAbility,
  onUpdateAbility,
  onDeleteAbility,
  onTrackerChange,
  onUseAbility,
}: RpgAbilitiesTabProps) {
  const [draft, setDraft] = useState<AbilityDraft>(() => emptyDraft());
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
    const preset = rpgAbilityPresets.find((item) => item.id === id);
    if (preset) {
      setDraft({ category: preset.category, title: preset.title, summary: preset.summary ?? '', description: preset.description });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      if (editingId) {
        const current = character.abilities.find((ability) => ability.id === editingId);
        if (!current) {
          throw new Error('Habilidade não encontrada.');
        }

        const title = draft.title.trim();
        if (!title) {
          throw new Error('Dê um título à habilidade.');
        }

        onUpdateAbility({
          ...current,
          category: draft.category,
          title,
          summary: draft.summary.trim() || undefined,
          description: draft.description.trim(),
          updatedAt: new Date().toISOString(),
        });
        setMessage('Habilidade atualizada.');
      } else {
        onCreateAbility({
          category: draft.category,
          title: draft.title,
          summary: draft.summary || undefined,
          description: draft.description,
        });
        setMessage('Habilidade criada. Fórmulas, custos e trackers continuam editáveis só via importação por enquanto.');
      }

      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar a habilidade.');
    }
  }

  function handleDelete(ability: RpgAbility) {
    if (!window.confirm(`Excluir a habilidade "${ability.title}"?`)) {
      return;
    }

    onDeleteAbility(ability.id);
    if (editingId === ability.id) {
      resetDraft();
    }
    setMessage('Habilidade excluída.');
  }

  return (
    <div className="grid gap-4">
      <RpgPanel title={editingId ? 'Editar habilidade' : 'Criar habilidade'}>
        {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)' }}>{message}</p> : null}
        {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)' }}>{error}</p> : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {!editingId && (
            <Field label="Preset (opcional)">
              <Select className={selectClass} value={presetId} onChange={(value) => applyPreset(value)}>
                <Select.Option value="">Habilidade personalizada</Select.Option>
                {rpgAbilityPresets.map((preset) => (
                  <Select.Option key={preset.id} value={preset.id}>{preset.title}</Select.Option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <Select
                className={selectClass}
                value={draft.category}
                onChange={(value) => setDraft({ ...draft, category: value as RpgAbilityCategory })}
              >
                {Object.entries(rpgAbilityCategoryLabels).map(([value, label]) => (
                  <Select.Option key={value} value={value}>{label}</Select.Option>
                ))}
              </Select>
            </Field>
            <Field label="Título">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Ex.: Golpe certeiro"
              />
            </Field>
          </div>

          <Field label="Resumo (opcional)">
            <input
              className={inputClass}
              value={draft.summary}
              onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
              placeholder="Uma linha curta"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              className={`${inputClass} leading-6`}
              rows={3}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <ActionButton type="submit" tone="primary">
              {editingId ? 'Salvar habilidade' : 'Criar habilidade'}
            </ActionButton>
            {editingId ? <ActionButton type="button" onClick={resetDraft}>Cancelar</ActionButton> : null}
          </div>
        </form>
      </RpgPanel>

      {Object.entries(rpgAbilityCategoryLabels).map(([category, label]) => {
        const abilities = groupedAbilities[category] ?? [];
        if (abilities.length === 0) {
          return null;
        }

        return (
          <RpgPanel key={category} title={label}>
            <div className="grid gap-3">
              {abilities.map((ability) => (
                <article key={ability.id} className="grid gap-3 py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{ability.title}</h3>
                      {ability.summary ? <p className="mt-1 text-xs" style={{ color: 'var(--hub-accent)' }}>{ability.summary}</p> : null}
                    </div>
                    <button
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={() => onUseAbility(ability)}
                    >
                      Usar
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{ability.description}</p>
                  <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
                    {ability.formulas.map((formula) => {
                      const expression = applyRpgDamageModifiers(formula.expression, character, { ability, formula });

                      return (
                        <RpgFormulaChip key={formula.id} expression={expression} label={formula.label} variables={variables} />
                      );
                    })}
                  </div>
                  {ability.costs.length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                      {ability.costs.map((cost) => (
                        <span key={`${cost.resourceId}-${cost.expression}`} className="text-xs font-medium" style={{ color: 'var(--hub-negative)' }}>
                          {cost.label ?? 'Custo'}: {cost.expression} {cost.resourceId}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {ability.trackers.length > 0 ? <RpgTrackerList ability={ability} onTrackerChange={onTrackerChange} /> : null}
                  {ability.needsReview ? <span className="text-xs font-medium uppercase" style={{ letterSpacing: '0.1em', color: 'var(--hub-warning)' }}>Revisar importacao</span> : null}
                  <div className="flex flex-wrap gap-2">
                    <InlineButton
                      label="Editar"
                      onClick={() => {
                        setEditingId(ability.id);
                        setPresetId('');
                        setDraft(draftFromAbility(ability));
                        setMessage('');
                        setError('');
                      }}
                    />
                    <InlineButton label="Excluir" tone="danger" onClick={() => handleDelete(ability)} />
                  </div>
                </article>
              ))}
            </div>
          </RpgPanel>
        );
      })}
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
