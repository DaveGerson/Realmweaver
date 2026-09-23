import React from 'react';
import type { Faction, NPC, Location } from '@/types/index';
import { generateFaction } from '@/services/aiService';
import { FactionEditor } from '@/components/editors/FactionEditor';
import { createDefaultFaction } from '@/utils/entityUtils';
import { QuickGeneratorForm, OfficialSettingNote } from '@/components/generators/QuickGeneratorForm';

interface FactionGeneratorProps {
  onFactionCreated: (faction: Omit<Faction, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  npcs?: NPC[];
  allLocations?: Location[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A thieves\' guild with a code of honor',
  'A religious order guarding dark secrets',
  'A merchant consortium with political ambitions',
  'A rebel cell fighting against an oppressive empire',
];

export const FactionGenerator: React.FC<FactionGeneratorProps> = ({
  onFactionCreated,
  isMockMode,
  isOfficialSetting = false,
  npcs = [],
  allLocations = [],
  campaignContext,
}) => (
  <QuickGeneratorForm<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>>
    entityType="faction"
    title="Faction Generator"
    description={
      <>
        Describe a faction or organization, and the AI will define its goals and purpose.
        <OfficialSettingNote show={isOfficialSetting} />
      </>
    }
    generateLabel="Generate Faction"
    entityNoun="faction"
    logTag="FactionGenerator"
    placeholder="e.g., A shadowy assassins guild that communicates via coded messages."
    rows={5}
    promptChips={PROMPT_CHIPS}
    isMockMode={isMockMode}
    campaignContext={campaignContext}
    generate={(prompt, signal) => generateFaction(prompt, isMockMode, campaignContext, signal)}
    onGenerated={(factionData) => onFactionCreated({ ...factionData, leaderId: undefined, memberIds: [] })}
    chatInitialData={createDefaultFaction()}
    onChatEntityCreated={(data) => {
      const { id, ...factionData } = data;
      onFactionCreated(factionData);
    }}
    renderChatPreview={(data, onUpdate) => (
      <FactionEditor
        faction={{ ...data, id: 'preview' }}
        allNpcs={npcs}
        allLocations={allLocations}
        onUpdate={(_, updates) => onUpdate(updates)}
        onDelete={() => {}}
        isMockMode={isMockMode}
      />
    )}
  />
);
