import { Card } from '../../../../../shared/ui';
import { RpgPanel } from '../../RpgPanel';
import { RpgNumberStepper } from '../RpgNumberStepper';
import { type RpgCharacter } from '../../../types/rpg';

type RpgAttributesTabProps = {
  character: RpgCharacter;
  groupedSkills: Record<string, RpgCharacter['skills']>;
  onChange: (updates: Partial<RpgCharacter>) => void;
};

export function RpgAttributesTab({ character, groupedSkills, onChange }: RpgAttributesTabProps) {
  return (
    <>
      <Card>
        <h2 className="mb-4 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-label)' }}>Atributos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {character.attributes.map((attribute) => (
            <article key={attribute.key} className="py-1">
              <h3 style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>{attribute.label}</h3>
              <input
                className="mt-1 h-12 w-full border-0 text-3xl tabular-nums"
                style={{ fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}
                type="number"
                value={attribute.value}
                onChange={(event) => onChange({
                  attributes: character.attributes.map((item) => (
                    item.key === attribute.key ? { ...item, value: Number(event.target.value) } : item
                  )),
                })}
              />
            </article>
          ))}
        </div>
      </Card>
      <section>
        <h2 className="mb-4 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-label)' }}>Pericias</h2>
        <div className="grid gap-4">
          {Object.entries(groupedSkills).map(([category, skills]) => (
            <RpgPanel key={category} title={category}>
              <div className="grid gap-2">
                {skills.map((skill) => (
                  <div key={skill.id} className="grid grid-cols-[minmax(0,1fr)_minmax(8.75rem,1fr)] items-center gap-3">
                    <span className="truncate text-sm" style={{ color: 'var(--hub-text-body)' }}>{skill.name}</span>
                    <div className="justify-self-center">
                      <RpgNumberStepper
                        value={skill.value}
                        onChange={(nextValue) => onChange({
                          skills: character.skills.map((item) => (item.id === skill.id ? { ...item, value: nextValue } : item)),
                        })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </RpgPanel>
          ))}
        </div>
      </section>
    </>
  );
}
