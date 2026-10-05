import { useEffect } from 'react';
import { RpgTabButton } from '../RpgTabButton';
import { useDragScroll } from '../../../../shared/hooks/useDragScroll';
import { type RpgTab } from '../../types/rpg';

type RpgCharacterTabsProps = {
  activeTab: RpgTab;
  onSelect: (tab: RpgTab) => void;
  tabs: Array<{ id: RpgTab; label: string }>;
};

export function RpgCharacterTabs({ activeTab, onSelect, tabs }: RpgCharacterTabsProps) {
  const dragScroll = useDragScroll<HTMLDivElement>();

  // Mesmo comportamento do ModuleHeader: mantém a aba ativa visível ao trocar
  // (sem isso, uma aba lá no fim da faixa — Historia, Revisao — fica fora da
  // vista sozinha, e a faixa não dava nenhuma pista de que rolava).
  useEffect(() => {
    const active = dragScroll.ref.current?.querySelector('.active');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <div
      ref={dragScroll.ref}
      className="hub-scroll-strip pb-3"
      style={{ overflowX: 'auto', maxWidth: '100%', cursor: 'grab' }}
      onMouseDown={dragScroll.onMouseDown}
      onMouseLeave={dragScroll.onMouseLeave}
      onMouseUp={dragScroll.onMouseUp}
      onMouseMove={dragScroll.onMouseMove}
      onClickCapture={dragScroll.onClickCapture}
    >
      <nav className="flex gap-1" aria-label="Abas da ficha RPG">
        {tabs.map((tab) => (
          <RpgTabButton key={tab.id} active={activeTab === tab.id} label={tab.label} tab={tab.id} onSelect={onSelect} />
        ))}
      </nav>
    </div>
  );
}
