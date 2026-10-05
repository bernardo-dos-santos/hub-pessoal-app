import { BackButton } from '../../../../shared/ui';
import { type RpgCharacter } from '../../types/rpg';

type RpgCharacterHeaderProps = {
  character: RpgCharacter;
};

export function RpgCharacterHeader({ character }: RpgCharacterHeaderProps) {
  return (
    <div className="py-4">
      <div className="mb-2"><BackButton /></div>
      <p className="truncate text-xs font-medium uppercase" style={{ letterSpacing: '0.12em', color: 'var(--hub-label)' }}>
        {character.campaign}
      </p>
      <h1 className="mt-2 truncate text-2xl" style={{ fontWeight: 500, color: 'var(--hub-text)' }}>{character.name}</h1>
      <p className="truncate text-sm" style={{ color: 'var(--hub-muted)' }}>{character.subtitle}</p>
      <p className="mt-2 text-xs" style={{ color: 'var(--hub-label)' }}>Mestre: {character.masterName}</p>
    </div>
  );
}
