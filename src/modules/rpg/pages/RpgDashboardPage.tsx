import { type FormEvent, useState } from 'react';
import { Card, ConfirmDialog, ModuleHeader } from '../../../shared/ui';
import { RpgCharacterCard } from '../components/RpgCharacterCard';
import { getRpgTabs } from '../components/rpgTabs';
import { rpgCharacterService } from '../services/rpgCharacterService';
import { type RpgCharacter } from '../types/rpg';
import { calculateDefense, getReviewCount } from '../utils/rpgCalculations';

type CharacterDraft = {
  name: string;
  subtitle: string;
  masterName: string;
  campaign: string;
};

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';

function emptyDraft(): CharacterDraft {
  return { name: '', subtitle: '', masterName: '', campaign: '' };
}

export const RpgDashboardPage: React.FC = () => {
  const [characters, setCharacters] = useState(() => rpgCharacterService.list());
  const [draft, setDraft] = useState<CharacterDraft>(() => emptyDraft());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingCharacter, setDeletingCharacter] = useState<RpgCharacter | null>(null);

  function refresh() {
    setCharacters(rpgCharacterService.list());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      rpgCharacterService.create({
        name: draft.name,
        subtitle: draft.subtitle || undefined,
        masterName: draft.masterName || undefined,
        campaign: draft.campaign || undefined,
      });
      refresh();
      setDraft(emptyDraft());
      setMessage('Personagem criado.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar o personagem.');
    }
  }

  function confirmDelete() {
    if (!deletingCharacter) {
      return;
    }

    rpgCharacterService.remove(deletingCharacter.id);
    refresh();
    setMessage('Personagem excluído.');
    setDeletingCharacter(null);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Ficha automática" title="RPG" tabs={getRpgTabs()} />

      {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '20px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '20px' }}>{error}</p> : null}

      <div className="space-y-6">
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {characters.map((character) => (
            <div key={character.id} className="grid gap-2">
              <RpgCharacterCard
                character={character}
                defense={calculateDefense(character, character.rulesProfile)}
                reviewCount={getReviewCount(character)}
              />
              <button
                className="justify-self-end text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="button"
                onClick={() => setDeletingCharacter(character)}
              >
                Excluir personagem
              </button>
            </div>
          ))}
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
              Criar personagem
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Ex.: Lucas"
                />
              </Field>
              <Field label="Subtítulo (opcional)">
                <input
                  className={inputClass}
                  value={draft.subtitle}
                  onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
                  placeholder="Ex.: Atirador de elite"
                />
              </Field>
              <Field label="Mestre (opcional)">
                <input
                  className={inputClass}
                  value={draft.masterName}
                  onChange={(event) => setDraft({ ...draft, masterName: event.target.value })}
                />
              </Field>
              <Field label="Campanha (opcional)">
                <input
                  className={inputClass}
                  value={draft.campaign}
                  onChange={(event) => setDraft({ ...draft, campaign: event.target.value })}
                  placeholder="Texto livre — vínculo com campanhas ainda não existe"
                />
              </Field>
            </div>

            <div>
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                Criar personagem
              </button>
            </div>
          </form>
        </Card>
      </div>

      {deletingCharacter ? (
        <ConfirmDialog
          title={`Excluir "${deletingCharacter.name}"?`}
          description="Isso apaga a ficha inteira (atributos, habilidades, inventário) e não pode ser desfeito."
          confirmLabel="Excluir"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingCharacter(null)}
        />
      ) : null}
    </div>
  );
};

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
