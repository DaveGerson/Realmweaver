import React, { useState } from 'react';
import type { Location, Faction } from '@/types/index';
import { generateLocation } from '@/services/aiService';
import { LocationEditor } from '@/components/editors/LocationEditor';
import { createDefaultLocation } from '@/utils/entityUtils';
import {
  QuickGeneratorForm,
  GeneratorSelectField,
  OfficialSettingNote,
} from '@/components/generators/QuickGeneratorForm';

interface LocationGeneratorProps {
  onLocationCreated: (location: Omit<Location, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  allLocations?: Location[];
  factions?: Faction[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A haunted forest clearing',
  'A bustling market district',
  'An ancient dwarven forge',
  'A hidden coastal smuggler\'s cove',
];

const BIOME_OPTIONS = [
  '', 'Forest', 'Mountain', 'Desert', 'Urban', 'Coastal',
  'Underground', 'Swamp', 'Arctic', 'Planar',
];

export const LocationGenerator: React.FC<LocationGeneratorProps> = ({
  onLocationCreated,
  isMockMode,
  isOfficialSetting = false,
  allLocations = [],
  factions = [],
  campaignContext,
}) => {
  const [biome, setBiome] = useState('');

  const buildFullPrompt = (prompt: string): string => {
    const parts: string[] = [];
    if (biome) parts.push(`[${biome}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  return (
    <QuickGeneratorForm<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>
      entityType="location"
      title="Location Generator"
      description={
        <>
          Describe a location, and the AI will create a vivid description and hidden secrets.
          <OfficialSettingNote show={isOfficialSetting} />
        </>
      }
      generateLabel="Generate Location"
      entityNoun="location"
      logTag="LocationGenerator"
      placeholder="e.g., A forgotten library hidden behind a waterfall."
      promptChips={PROMPT_CHIPS}
      isMockMode={isMockMode}
      campaignContext={campaignContext}
      buildPrompt={buildFullPrompt}
      onReset={() => setBiome('')}
      renderExtraFields={(isLoading) => (
        <GeneratorSelectField
          label="Biome / Setting"
          value={biome}
          onChange={setBiome}
          options={BIOME_OPTIONS}
          anyLabel="Any Biome"
          disabled={isLoading}
        />
      )}
      generate={(fullPrompt, signal) => generateLocation(fullPrompt, isMockMode, campaignContext, signal)}
      onGenerated={(locationData) => onLocationCreated({
        ...locationData,
        parentLocationId: undefined,
        subLocationIds: [],
        connections: [],
        pointsOfInterest: [],
        loot: [],
      })}
      chatInitialData={createDefaultLocation()}
      onChatEntityCreated={(data) => {
        const { id, ...locationData } = data;
        onLocationCreated(locationData);
      }}
      renderChatPreview={(data, onUpdate) => (
        <LocationEditor
          location={{ ...data, id: 'preview' }}
          allLocations={allLocations}
          allFactions={factions}
          onUpdate={(_, updates) => onUpdate(updates)}
          onDelete={() => {}}
          isMockMode={isMockMode}
        />
      )}
    />
  );
};
