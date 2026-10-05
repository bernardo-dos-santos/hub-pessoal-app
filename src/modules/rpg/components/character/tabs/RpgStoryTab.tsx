import { RpgPanel } from '../../RpgPanel';
import { type RpgCharacter } from '../../../types/rpg';

type RpgStoryTabProps = {
  character: RpgCharacter;
  onChange: (updates: Partial<RpgCharacter>) => void;
};

export function RpgStoryTab({ character, onChange }: RpgStoryTabProps) {
  return (
    <RpgPanel title="Historia e notas">
      <textarea
        className="min-h-64 text-sm leading-6"
        value={character.storyNotes}
        onChange={(event) => onChange({ storyNotes: event.target.value })}
      />
    </RpgPanel>
  );
}
