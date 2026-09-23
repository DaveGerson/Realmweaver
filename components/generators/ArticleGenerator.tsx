import React from 'react';
import type { Article, NPC, Location, Faction } from '@/types/index';
import { generateArticle } from '@/services/aiService';
import { ArticleEditor } from '@/components/editors/ArticleEditor';
import { createDefaultArticle } from '@/utils/entityUtils';
import { QuickGeneratorForm, OfficialSettingNote } from '@/components/generators/QuickGeneratorForm';

interface ArticleGeneratorProps {
  onArticleCreated: (article: Omit<Article, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  allArticles?: Article[];
  npcs?: NPC[];
  locations?: Location[];
  factions?: Faction[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'The history of the ancient empire',
  'Local customs and traditions',
  'Legends about the dark forest',
  'The origin of a powerful magical artifact',
];

export const ArticleGenerator: React.FC<ArticleGeneratorProps> = ({
  onArticleCreated,
  isMockMode,
  isOfficialSetting = false,
  allArticles = [],
  npcs = [],
  locations = [],
  factions = [],
  campaignContext,
}) => (
  <QuickGeneratorForm<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>>
    entityType="article"
    title="Lore Article Generator"
    description={
      <>
        Describe a piece of lore, a historical event, or a cosmological concept for your world.
        <OfficialSettingNote show={isOfficialSetting} />
      </>
    }
    generateLabel="Generate Article"
    entityNoun="article"
    logTag="ArticleGenerator"
    placeholder="e.g., The creation myth of the world"
    rows={5}
    promptChips={PROMPT_CHIPS}
    isMockMode={isMockMode}
    campaignContext={campaignContext}
    generate={(prompt, signal) => generateArticle(prompt, isMockMode, campaignContext, signal)}
    onGenerated={(articleData) => onArticleCreated({ ...articleData, parentArticleId: undefined, subArticleIds: [] })}
    chatInitialData={createDefaultArticle()}
    onChatEntityCreated={(data) => {
      const { id, ...articleData } = data;
      onArticleCreated(articleData);
    }}
    renderChatPreview={(data, onUpdate) => (
      <ArticleEditor
        article={{ ...data, id: 'preview' }}
        allArticles={allArticles}
        allNpcs={npcs}
        allLocations={locations}
        allFactions={factions}
        onUpdate={(_, updates) => onUpdate(updates)}
        onDelete={() => {}}
        isMockMode={isMockMode}
      />
    )}
  />
);
