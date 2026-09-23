import React, { useState } from 'react';
import { generateAdventure } from '@/services/aiService';
import type { AdventureForBatchAdd, Campaign } from '@/types/index';
import { createDefaultAdventure } from '@/utils/entityUtils';
import { AdventureEditor } from '@/components/editors/AdventureEditor';
import { inputBaseClasses } from '@/components/common/Textarea';
import {
  QuickGeneratorForm,
  GeneratorSelectField,
  OfficialSettingNote,
} from '@/components/generators/QuickGeneratorForm';

interface AdventureGeneratorProps {
  onAdventureCreated: (adventureData: AdventureForBatchAdd) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A heist in a noble\'s manor',
  'An investigation into disappearing townsfolk',
  'A race to stop a ritual before the solstice',
  'A journey through a monster-haunted wilderness',
];

const LEVEL_RANGE_OPTIONS = ['', '1-4', '5-10', '11-16', '17-20'];

const PREVIEW_CAMPAIGN: Campaign = {
  id: 'preview',
  title: 'Preview',
  setting: '',
  settingType: 'custom',
  articles: [],
  adventures: [],
  npcs: [],
  locations: [],
  factions: [],
  items: [],
  sessionLogs: [],
  playerCharacters: [],
  notes: [],
  plots: [],
};

export const AdventureGenerator: React.FC<AdventureGeneratorProps> = ({
  onAdventureCreated,
  isMockMode,
  isOfficialSetting = false,
  campaignContext,
}) => {
  const [levelRange, setLevelRange] = useState('');
  const [partySize, setPartySize] = useState<number | ''>(4);

  const buildFullPrompt = (prompt: string): string => {
    const parts: string[] = [];
    if (levelRange) parts.push(`[Levels ${levelRange}]`);
    if (partySize !== '') parts.push(`[Party of ${partySize}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  return (
    <QuickGeneratorForm<AdventureForBatchAdd>
      entityType="adventure"
      title="Adventure Generator"
      description={
        <>
          Describe a concept for an adventure, and the AI will generate a complete outline with a hook, theme, and multiple scenes to get you started.
          <OfficialSettingNote show={isOfficialSetting} />
        </>
      }
      generateLabel="Generate Adventure"
      entityNoun="adventure"
      logTag="AdventureGenerator"
      placeholder="e.g., A mystery in a wizard's tower where spells have started to go haywire."
      promptChips={PROMPT_CHIPS}
      isMockMode={isMockMode}
      campaignContext={campaignContext}
      buildPrompt={buildFullPrompt}
      onReset={() => {
        setLevelRange('');
        setPartySize(4);
      }}
      renderExtraFields={(isLoading) => (
        <div className="grid grid-cols-2 gap-3">
          <GeneratorSelectField
            label="Level Range"
            value={levelRange}
            onChange={setLevelRange}
            options={LEVEL_RANGE_OPTIONS}
            anyLabel="Any Level"
            formatOption={(opt) => `Levels ${opt}`}
            disabled={isLoading}
          />
          <div>
            <label className="block text-sm text-slate-400 mb-1">Party Size</label>
            <input
              type="number"
              min={1}
              max={10}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={isLoading}
              className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
            />
          </div>
        </div>
      )}
      generate={(fullPrompt, signal) => generateAdventure(fullPrompt, isMockMode, campaignContext, signal)}
      onGenerated={onAdventureCreated}
      chatInitialData={createDefaultAdventure()}
      onChatEntityCreated={(data) => {
        const { id, ...advData } = data;
        onAdventureCreated(advData);
      }}
      renderChatPreview={(data, onUpdate) => (
        <AdventureEditor
          adventure={{ ...data, id: 'preview' }}
          campaign={PREVIEW_CAMPAIGN}
          onUpdate={(_, updates) => onUpdate(updates)}
          isMockMode={isMockMode}
          campaignContext={campaignContext}
        />
      )}
    />
  );
};
