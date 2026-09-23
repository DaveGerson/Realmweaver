import React from 'react';
import type { Scene, NPC, Location } from '@/types/index';
import { generateScene } from '@/services/aiService';
import { SceneEditor } from '@/components/editors/SceneEditor';
import { createDefaultScene } from '@/utils/entityUtils';
import { QuickGeneratorForm, OfficialSettingNote } from '@/components/generators/QuickGeneratorForm';

interface SceneGeneratorProps {
  onSceneCreated: (scene: Omit<Scene, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  allNpcs?: NPC[];
  allLocations?: Location[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A tense negotiation with a rival faction',
  'An ambush in a narrow mountain pass',
  'A mysterious discovery in ancient ruins',
  'A daring escape from a collapsing dungeon',
];

export const SceneGenerator: React.FC<SceneGeneratorProps> = ({
  onSceneCreated,
  isMockMode,
  isOfficialSetting = false,
  allNpcs = [],
  allLocations = [],
  campaignContext,
}) => (
  <QuickGeneratorForm<Omit<Scene, 'id' | 'locationId' | 'npcIds'>>
    entityType="scene"
    title="Scene Generator"
    description={
      <>
        Describe a situation, and the AI will build a complete scene with read-aloud text and GM notes.
        <OfficialSettingNote show={isOfficialSetting} />
      </>
    }
    generateLabel="Generate Scene"
    entityNoun="scene"
    logTag="SceneGenerator"
    placeholder="e.g., A tense negotiation with a goblin chief"
    rows={5}
    promptChips={PROMPT_CHIPS}
    isMockMode={isMockMode}
    campaignContext={campaignContext}
    generate={(prompt, signal) => generateScene(prompt, isMockMode, campaignContext, signal)}
    onGenerated={(sceneData) => onSceneCreated({ ...sceneData, locationId: undefined, npcIds: [] })}
    chatInitialData={createDefaultScene()}
    onChatEntityCreated={(data) => {
      const { id, ...sceneData } = data;
      onSceneCreated(sceneData);
    }}
    renderChatPreview={(data, onUpdate) => (
      <SceneEditor
        scene={{ ...data, id: 'preview' }}
        allNpcs={allNpcs}
        allLocations={allLocations}
        onUpdate={(_, updates) => onUpdate(updates)}
        onDelete={() => {}}
        isMockMode={isMockMode}
      />
    )}
  />
);
