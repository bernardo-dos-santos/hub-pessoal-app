import { modules } from '../../core/module-registry/modules';
import { type ModuleId } from '../../core/module-registry/module-types';
import { SwitchRow } from '../../shared/ui';

type ModulePickerProps = {
  value: ModuleId[];
  onChange: (value: ModuleId[]) => void;
};

/** One row per module with a switch — shared by the first access and Configurações → Módulos. */
export function ModulePicker({ value, onChange }: ModulePickerProps) {
  function toggle(id: ModuleId) {
    onChange(value.includes(id) ? value.filter((m) => m !== id) : [...value, id]);
  }

  return (
    <div>
      {modules.filter((m) => m.status === 'active').map((module, index, list) => {
        const on = value.includes(module.id);
        return (
          <SwitchRow
            key={module.id}
            checked={on}
            onChange={() => toggle(module.id)}
            last={index === list.length - 1}
            label={module.name}
            description={module.description}
            leading={(
              <span
                className="grid h-8 w-8 shrink-0 place-items-center text-[11px] font-semibold"
                style={{
                  borderRadius: 'var(--hub-radius-control)',
                  background: on ? 'var(--hub-accent)' : 'var(--hub-track)',
                  color: on ? 'var(--hub-on-accent)' : 'var(--hub-subtle)',
                }}
              >
                {module.sigla}
              </span>
            )}
          />
        );
      })}
    </div>
  );
}
