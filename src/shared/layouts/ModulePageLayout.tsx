import { type ReactNode } from 'react';
import { type ModuleDefinition } from '../../core/module-registry/module-types';
import { PageContainer } from '../components/PageContainer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';

type ModulePageLayoutProps = {
  module: ModuleDefinition;
  children: ReactNode;
};

export function ModulePageLayout({ module, children }: ModulePageLayoutProps) {
  return (
    <PageContainer>
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <PageHeader eyebrow="Módulo" title={module.name} description={module.description} />
          <StatusBadge status={module.status} />
        </div>
      </section>
      {children}
    </PageContainer>
  );
}
