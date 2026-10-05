import { EmptyState } from '../../shared/components/EmptyState';
import { PageContainer } from '../../shared/components/PageContainer';
import { PageHeader } from '../../shared/components/PageHeader';

export function CommandPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Entrada rápida" title="Comando" />
      <EmptyState title="Comando rápido, IA e voz ficam para uma fase futura." />
    </PageContainer>
  );
}
