import { modules } from '../../core/module-registry/modules';
import { type ModuleId } from '../../core/module-registry/module-types';
import { moduleMaintenance, useSession } from '../../core/session/session';
import { Card, ModuleHeader } from '../../shared/ui';

/** What a module in maintenance shows to everyone but the admin fixing it. */
export function MaintenancePage({ moduleId }: { moduleId: ModuleId }) {
  const session = useSession();
  const entry = moduleMaintenance(moduleId, session);
  const name = modules.find((m) => m.id === moduleId)?.name ?? moduleId;

  return (
    <div className="space-y-5">
      <ModuleHeader eyebrow={`Módulo · ${name}`} title="Em manutenção" />
      <Card>
        <p className="text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          {entry?.message ?? 'Este módulo está passando por manutenção.'}
        </p>
        <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          Seus dados continuam guardados — nada foi apagado. Quando o módulo voltar, tudo estará como você deixou.
        </p>
      </Card>
    </div>
  );
}
