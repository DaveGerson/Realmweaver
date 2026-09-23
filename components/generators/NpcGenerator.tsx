import React, { useState } from 'react';
import type { NPC, Faction } from '@/types/index';
import { generateNpc } from '@/services/aiService';
import { NpcEditor } from '@/components/editors/NpcEditor';
import { createDefaultNpc } from '@/utils/entityUtils';
import { QuickGeneratorForm, GeneratorSelectField } from '@/components/generators/QuickGeneratorForm';

interface NpcGeneratorProps {
  onNpcCreated: (npc: Omit<NPC, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  factions?: Faction[];
  allNpcs?: NPC[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A mysterious tavern keeper',
  'A corrupt noble with a secret',
  'A battle-scarred veteran seeking redemption',
  "A young wizard's apprentice",
];

const CR_OPTIONS = [
  '', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'Non-combat',
];

const ALIGNMENT_OPTIONS = [
  '',
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
  'Unaligned',
];

export const NpcGenerator: React.FC<NpcGeneratorProps> = ({
  onNpcCreated,
  isMockMode,
  isOfficialSetting = false,
  factions = [],
  allNpcs = [],
  campaignContext,
}) => {
  const [cr, setCr] = useState('');
  const [alignment, setAlignment] = useState('');

  const buildFullPrompt = (prompt: string): string => {
    const parts: string[] = [];
    if (cr) parts.push(`[CR ${cr}]`);
    if (alignment) parts.push(`[${alignment}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  return (
    <QuickGeneratorForm<Omit<NPC, 'id' | 'factionId'>>
      entityType="npc"
      title="NPC Generator"
      description="Describe an NPC and let the AI bring them to life."
      generateLabel="Generate NPC"
      entityNoun="NPC"
      logTag="NpcGenerator"
      placeholder={isOfficialSetting ? "e.g., Drizzt Do'Urden, Elminster" : 'e.g., A gruff dwarven blacksmith...'}
      promptChips={PROMPT_CHIPS}
      isMockMode={isMockMode}
      campaignContext={campaignContext}
      buildPrompt={buildFullPrompt}
      onReset={() => {
        setCr('');
        setAlignment('');
      }}
      renderExtraFields={(isLoading) => (
        <div className="grid grid-cols-2 gap-3">
          <GeneratorSelectField
            label="Challenge Rating"
            value={cr}
            onChange={setCr}
            options={CR_OPTIONS}
            anyLabel="Any CR"
            disabled={isLoading}
          />
          <GeneratorSelectField
            label="Alignment"
            value={alignment}
            onChange={setAlignment}
            options={ALIGNMENT_OPTIONS}
            anyLabel="Any Alignment"
            disabled={isLoading}
          />
        </div>
      )}
      generate={(fullPrompt, signal) => generateNpc(fullPrompt, isMockMode, campaignContext, signal)}
      onGenerated={(npcData) => onNpcCreated({ ...npcData, factionId: undefined })}
      chatInitialData={createDefaultNpc()}
      onChatEntityCreated={(data) => {
        const { id, ...npcData } = data;
        onNpcCreated(npcData);
      }}
      renderChatPreview={(data, onUpdate) => (
        <NpcEditor
          npc={{ ...data, id: 'preview' }}
          factions={factions}
          allNpcs={allNpcs}
          onUpdate={(_, updates) => onUpdate(updates)}
          onDelete={() => {}}
          isMockMode={isMockMode}
        />
      )}
    />
  );
};
