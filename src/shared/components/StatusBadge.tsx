import { moduleStatuses, type ModuleStatus } from '../../core/module-registry/module-status';

type StatusBadgeProps = {
  status: ModuleStatus;
};

const statusColor: Record<ModuleStatus, string> = {
  active: 'var(--hub-positive)',
  planned: 'var(--hub-subtle)',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className="text-xs font-medium" style={{ color: statusColor[status] }}>
      {moduleStatuses[status].label}
    </span>
  );
}
