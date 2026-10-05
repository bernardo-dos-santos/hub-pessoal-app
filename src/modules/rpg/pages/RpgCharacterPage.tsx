import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { RpgAbilityPreviewModal } from '../components/character/RpgAbilityPreviewModal';
import { RpgCharacterHeader } from '../components/character/RpgCharacterHeader';
import { RpgCharacterTabs } from '../components/character/RpgCharacterTabs';
import { groupBy, rpgCharacterTabs } from '../components/character/rpgCharacterHelpers';
import { RpgAbilitiesTab } from '../components/character/tabs/RpgAbilitiesTab';
import { RpgAttributesTab } from '../components/character/tabs/RpgAttributesTab';
import { RpgCombatTab } from '../components/character/tabs/RpgCombatTab';
import { RpgGeneralTab } from '../components/character/tabs/RpgGeneralTab';
import { RpgInventoryTab } from '../components/character/tabs/RpgInventoryTab';
import { RpgReviewTab } from '../components/character/tabs/RpgReviewTab';
import { RpgStoryTab } from '../components/character/tabs/RpgStoryTab';
import { type RpgAbilityInput, type RpgInventoryItemInput, rpgCharacterService } from '../services/rpgCharacterService';
import {
  type RpgAbility,
  type RpgAbilityPreview,
  type RpgCharacter,
  type RpgResourceId,
  type RpgRulesProfile,
  type RpgTab,
} from '../types/rpg';
import { createRpgVariables, getReviewCount } from '../utils/rpgCalculations';

export function RpgCharacterPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const [activeTab, setActiveTab] = useState<RpgTab>('general');
  const [character, setCharacter] = useState(() => (characterId ? rpgCharacterService.get(characterId) : null));
  const [combatModeEnabled, setCombatModeEnabled] = useState(false);
  const [preview, setPreview] = useState<RpgAbilityPreview | null>(null);
  const variables = useMemo(() => (character ? createRpgVariables(character) : null), [character]);
  const groupedSkills = useMemo(() => (character ? groupBy(character.skills, (skill) => skill.category) : {}), [character]);
  const groupedAbilities = useMemo(() => (character ? groupBy(character.abilities, (ability) => ability.category) : {}), [character]);
  const reviewCount = character ? getReviewCount(character) : 0;

  if (!characterId || !character || !variables) {
    return <Navigate to="/rpg" replace />;
  }

  function refresh(nextCharacter?: RpgCharacter | null) {
    setCharacter(nextCharacter ?? rpgCharacterService.get(characterId!));
  }

  function updateCharacter(updates: Partial<RpgCharacter>) {
    refresh(rpgCharacterService.saveCharacter({ ...character!, ...updates }));
  }

  function updateResource(resourceId: RpgResourceId, current: number) {
    refresh(rpgCharacterService.updateResource(characterId!, resourceId, current));
  }

  function updateResourceMax(resourceId: RpgResourceId, max: number) {
    refresh(rpgCharacterService.updateResourceMax(characterId!, resourceId, max));
  }

  function updateRulesProfile(updates: Partial<RpgRulesProfile>) {
    refresh(rpgCharacterService.saveRulesProfile(characterId!, { ...character!.rulesProfile, ...updates }));
  }

  function updateAbilityTracker(abilityId: string, trackerId: string, used: number) {
    refresh(rpgCharacterService.updateAbilityTracker(characterId!, abilityId, trackerId, used));
  }

  function removeActiveEffect(effectId: string) {
    refresh(rpgCharacterService.removeActiveEffect(characterId!, effectId));
  }

  function toggleCombatMode() {
    if (combatModeEnabled) {
      refresh(rpgCharacterService.clearFrioAmargoActiveUses(characterId!));
      setCombatModeEnabled(false);
      return;
    }

    setCombatModeEnabled(true);
  }

  function openAbilityPreview(ability: RpgAbility) {
    setPreview(rpgCharacterService.createAbilityPreview(characterId!, ability.id));
  }

  function applyPreview() {
    if (!preview) {
      return;
    }

    refresh(rpgCharacterService.applyAbility(characterId!, preview.ability.id));
    setPreview(null);
  }

  function addInventoryItem(input: RpgInventoryItemInput) {
    const updated = rpgCharacterService.addInventoryItem(characterId!, input);
    refresh(updated);
    return updated;
  }

  function updateInventoryItem(itemId: string, updates: Partial<RpgInventoryItemInput>) {
    const updated = rpgCharacterService.updateInventoryItem(characterId!, itemId, updates);
    refresh(updated);
    return updated;
  }

  function deleteInventoryItem(itemId: string) {
    refresh(rpgCharacterService.deleteInventoryItem(characterId!, itemId));
  }

  function createAbility(input: RpgAbilityInput) {
    const updated = rpgCharacterService.createAbility(characterId!, input);
    refresh(updated);
    return updated;
  }

  function updateAbilityFields(ability: RpgAbility) {
    const updated = rpgCharacterService.updateAbility(characterId!, ability);
    refresh(updated);
    return updated;
  }

  function deleteAbility(abilityId: string) {
    refresh(rpgCharacterService.deleteAbility(characterId!, abilityId));
  }

  return (
    <div className="rpg-sheet min-h-screen pb-8" style={{ color: 'var(--hub-text)' }}>
      <header style={{ borderBottom: '1px solid var(--hub-border)' }}>
        <RpgCharacterHeader character={character} />
        <RpgCharacterTabs activeTab={activeTab} tabs={rpgCharacterTabs} onSelect={setActiveTab} />
      </header>

      <main className="grid gap-6 py-6">
        {activeTab === 'general' ? (
          <RpgGeneralTab character={character} combatModeEnabled={combatModeEnabled} reviewCount={reviewCount} rulesProfile={character.rulesProfile} variables={variables} onChange={updateCharacter} onRemoveEffect={removeActiveEffect} onResourceChange={updateResource} onResourceMaxChange={updateResourceMax} onRulesProfileChange={updateRulesProfile} onToggleCombatMode={toggleCombatMode} onTrackerChange={updateAbilityTracker} />
        ) : null}
        {activeTab === 'attributes' ? (
          <RpgAttributesTab character={character} groupedSkills={groupedSkills} onChange={updateCharacter} />
        ) : null}
        {activeTab === 'combat' ? (
          <RpgCombatTab character={character} rulesProfile={character.rulesProfile} variables={variables} onResourceChange={updateResource} onResourceMaxChange={updateResourceMax} onRulesProfileChange={updateRulesProfile} />
        ) : null}
        {activeTab === 'abilities' ? (
          <RpgAbilitiesTab character={character} groupedAbilities={groupedAbilities} variables={variables} onCreateAbility={createAbility} onDeleteAbility={deleteAbility} onTrackerChange={updateAbilityTracker} onUpdateAbility={updateAbilityFields} onUseAbility={openAbilityPreview} />
        ) : null}
        {activeTab === 'inventory' ? (
          <RpgInventoryTab character={character} onAddItem={addInventoryItem} onDeleteItem={deleteInventoryItem} onUpdateItem={updateInventoryItem} />
        ) : null}
        {activeTab === 'story' ? <RpgStoryTab character={character} onChange={updateCharacter} /> : null}
        {activeTab === 'review' ? <RpgReviewTab character={character} onConfirm={(kind, id) => refresh(rpgCharacterService.confirmReviewItem(characterId!, kind, id))} /> : null}
      </main>

      {preview ? <RpgAbilityPreviewModal preview={preview} onApply={applyPreview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
