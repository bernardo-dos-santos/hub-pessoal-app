import { type ReactNode } from 'react';
import { ModuleHeader, type ModuleTab } from '../../../shared/ui';

const tabs: ModuleTab[] = [
  { label: 'Painel',    to: '/treino',           end: true },
  { label: 'Registrar', to: '/treino/registrar' },
  { label: 'Histórico', to: '/treino/historico' },
  { label: 'TAF',       to: '/treino/taf' },
  { label: 'Plano',     to: '/treino/plano' },
];

export function FitnessLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Preparação CBMSC" title="Treino" tabs={tabs} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
