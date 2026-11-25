import { useState } from 'react';
import { modules } from '../../core/module-registry/modules';
import { type ModuleId } from '../../core/module-registry/module-types';
import { updateMe, useSession } from '../../core/session/session';
import { Card, ModuleHeader } from '../../shared/ui';
import { ModulePicker } from '../components/ModulePicker';

const allModules = modules.filter((m) => m.status === 'active').map((m) => m.id);

export function ModulesPage() {
  const session = useSession();
  const [selected, setSelected] = useState<ModuleId[]>(session.modules ?? allModules);
  const [error, setError] = useState('');

  async function change(next: ModuleId[]) {
    if (next.length === 0) {
      setError('Deixe ao menos um módulo ligado.');
      return;
    }
    const previous = selected;
    setSelected(next);
    setError('');
    try {
      await updateMe({ modules: next });
    } catch (err) {
      setSelected(previous);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <div className="space-y-5">
      <ModuleHeader eyebrow="Configurações" title="Módulos" />
      <Card>
        <p className="mb-2 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>
          O que fica desligado some da navegação, da Home e dos alertas. Nada é apagado: religar traz tudo de volta.
        </p>
        <ModulePicker value={selected} onChange={change} />
        {error && <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
      </Card>
    </div>
  );
}
