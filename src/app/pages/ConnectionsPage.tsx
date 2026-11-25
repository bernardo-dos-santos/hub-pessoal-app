import { isModuleEnabled, useSession } from '../../core/session/session';
import { FinanceConnectionSetup } from '../../modules/finance/components/FinanceConnectionSetup';
import { CollegeConnectionSetup } from '../../modules/college/components/CollegeConnectionSetup';
import { Card, ModuleHeader } from '../../shared/ui';

const sectionTitleStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
} as const;

/** Each user's own integrations, one card per module that has any. The first access shows the same components. */
export function ConnectionsPage() {
  const session = useSession();
  const finance = isModuleEnabled('finance', session);
  const college = isModuleEnabled('college', session);

  return (
    <div className="space-y-5">
      <ModuleHeader eyebrow="Configurações" title="Conexões" />
      {finance && (
        <Card>
          <h2 style={sectionTitleStyle}>Financeiro</h2>
          <p className="mt-1.5 mb-4 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
            De onde vêm as suas transações.
          </p>
          <FinanceConnectionSetup />
        </Card>
      )}
      {college && (
        <Card>
          <h2 style={sectionTitleStyle}>Faculdade</h2>
          <p className="mt-1.5 mb-4 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
            Onde você estuda — daí sai de onde vêm suas disciplinas, provas e tarefas.
          </p>
          <CollegeConnectionSetup />
        </Card>
      )}
      {!finance && !college && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-text-body)' }}>
            Nenhum módulo ligado tem conexões para configurar. Elas aparecem aqui quando você ligar o Financeiro ou a Faculdade.
          </p>
        </Card>
      )}
    </div>
  );
}
