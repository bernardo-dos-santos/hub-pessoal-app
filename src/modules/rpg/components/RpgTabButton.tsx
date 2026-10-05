import { type RpgTab } from '../types/rpg';

type RpgTabButtonProps = {
  active: boolean;
  label: string;
  tab: RpgTab;
  onSelect: (tab: RpgTab) => void;
};

export function RpgTabButton({ active, label, onSelect, tab }: RpgTabButtonProps) {
  return (
    <button
      className={`hub-tab whitespace-nowrap${active ? ' active' : ''}`}
      type="button"
      onClick={() => onSelect(tab)}
    >
      {label}
    </button>
  );
}
