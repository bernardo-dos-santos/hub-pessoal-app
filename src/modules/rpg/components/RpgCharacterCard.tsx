import React from 'react';
import { Link } from 'react-router-dom';
import { type RpgCharacter } from '../types/rpg';
import { getResource } from '../utils/rpgCalculations';
import { Card, HeroValue } from '../../../shared/ui';

interface RpgCharacterCardProps {
  character: RpgCharacter;
  defense: number;
  reviewCount: number;
}

const RESOURCE_COLOR = {
  vida: 'var(--hub-negative)',
  sanidade: 'var(--hub-accent)',
  fadiga: 'var(--hub-warning)',
} as const;

function ResourceBar({ label, color, current, max }: { label: string; color: string; current: number; max: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px]">
        <span className="font-semibold uppercase" style={{ letterSpacing: '0.12em', color }}>{label}</span>
        <span className="tabular-nums" style={{ color: 'var(--hub-muted)' }}>{current} / {max}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(58,44,34,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (current / Math.max(1, max)) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export const RpgCharacterCard: React.FC<RpgCharacterCardProps> = ({
  character,
  defense,
  reviewCount,
}) => {
  const vida = getResource(character, 'vida');
  const sanidade = getResource(character, 'sanidade');
  const fadiga = getResource(character, 'fadiga');

  return (
    <Link to={`personagem/${character.id}`} className="group block w-full">
      <Card hero>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-medium leading-tight" style={{ color: 'var(--hub-text)' }}>
              {character.name}
            </h3>
            <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>{character.subtitle}</p>
          </div>
          {reviewCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--hub-warning)' }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--hub-warning)' }} />
              <span>{reviewCount} {reviewCount === 1 ? 'revisão' : 'revisões'}</span>
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <span className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Campanha</span>
            <p className="truncate text-sm" style={{ color: 'var(--hub-text-body)' }}>{character.campaign}</p>
          </div>
          <div>
            <span className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Mestre</span>
            <p className="truncate text-sm" style={{ color: 'var(--hub-text-body)' }}>{character.masterName}</p>
          </div>
        </div>

        <div className="space-y-4">
          <ResourceBar label="Vida" color={RESOURCE_COLOR.vida} current={vida?.current ?? 0} max={vida?.max ?? 1} />
          <ResourceBar label="Sanidade" color={RESOURCE_COLOR.sanidade} current={sanidade?.current ?? 0} max={sanidade?.max ?? 1} />
          <ResourceBar label="Esforço" color={RESOURCE_COLOR.fadiga} current={fadiga?.current ?? 0} max={fadiga?.max ?? 1} />
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)', marginBottom: '4px' }}>Defesa</p>
            <HeroValue size={24}>{defense}</HeroValue>
          </div>
          <span className="text-sm font-medium transition-opacity group-hover:opacity-70" style={{ color: 'var(--hub-primary)' }}>
            Acessar ficha →
          </span>
        </div>
      </Card>
    </Link>
  );
};
