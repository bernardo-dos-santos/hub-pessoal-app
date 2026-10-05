import { modules } from '../../core/module-registry/modules';
import { PageContainer } from '../../shared/components/PageContainer';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';

export function ModulesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Arquitetura"
        title="Módulos"
        description="Registro central dos módulos disponíveis nesta fase inicial."
      />

      <div>
        <div
          className="hidden grid-cols-[1.2fr_2fr_0.9fr_1fr] gap-4 py-3 font-medium uppercase md:grid"
          style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', borderBottom: '1px solid var(--hub-border)' }}
        >
          <span>Nome</span>
          <span>Descrição</span>
          <span>Status</span>
          <span>Rota base</span>
        </div>
        <div>
          {modules.map((module) => (
            <article
              key={module.id}
              className="grid gap-3 py-4 md:grid-cols-[1.2fr_2fr_0.9fr_1fr] md:items-center"
              style={{ borderBottom: '1px solid var(--hub-border)' }}
            >
              <div>
                <strong className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{module.name}</strong>
                <span className="mt-1 block text-xs md:hidden" style={{ color: 'var(--hub-subtle)' }}>{module.basePath}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>{module.description}</p>
              <StatusBadge status={module.status} />
              <code className="hidden text-xs md:inline-block" style={{ color: 'var(--hub-subtle)' }}>
                {module.basePath}
              </code>
            </article>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
