import { RpgPanel } from '../../RpgPanel';
import { RpgReviewCard } from '../RpgReviewCard';
import { type RpgCharacter } from '../../../types/rpg';

type RpgReviewTabProps = {
  character: RpgCharacter;
  onConfirm: (kind: 'weapon' | 'ability', id: string) => void;
};

export function RpgReviewTab({ character, onConfirm }: RpgReviewTabProps) {
  const weaponReviews = character.weapons.filter((weapon) => weapon.needsReview);
  const abilityReviews = character.abilities.filter((ability) => ability.needsReview || ability.formulas.some((formula) => formula.needsReview));

  return (
    <RpgPanel title="Revisao da importacao" meta={`${weaponReviews.length + abilityReviews.length} pendente(s)`}>
      {weaponReviews.length + abilityReviews.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhuma revisao pendente.</p>
      ) : null}
      {weaponReviews.map((weapon) => (
        <RpgReviewCard key={weapon.id} title={weapon.name} note={weapon.notes ?? 'Formula ou texto importado precisa conferencia.'} onConfirm={() => onConfirm('weapon', weapon.id)} />
      ))}
      {abilityReviews.map((ability) => (
        <RpgReviewCard key={ability.id} title={ability.title} note="Habilidade importada de trecho cortado, invisivel ou incompleto nas imagens." onConfirm={() => onConfirm('ability', ability.id)} />
      ))}
    </RpgPanel>
  );
}
