
import React, { useState } from 'react';
import type { Article, NPC, Location, Faction } from '../../types/index';
import { generateArticle } from '../../services/aiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { SkeletonGeneratorOverlay } from '../common/SkeletonCard';
import { EntityChatGenerator } from './EntityChatGenerator';
import { ArticleEditor } from '../editors/ArticleEditor';
import { createDefaultArticle } from '../../utils/entityUtils';

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

export const ArticleGenerator: React.FC<ArticleGeneratorProps> = ({ onArticleCreated, isMockMode, isOfficialSetting = false, allArticles = [], npcs = [], locations = [], factions = [], campaignContext }) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const articleData = await generateArticle(prompt, isMockMode, campaignContext);
      const newArticle: Omit<Article, 'id'> = {
          ...articleData,
          parentArticleId: undefined,
          subArticleIds: []
      }
      onArticleCreated(newArticle);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate article. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (mode === 'chat') {
      return (
          <div className="absolute inset-0 z-20 bg-slate-950 p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
             <div className="mb-4 flex justify-between items-center flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setMode('quick')}>
                     <Icons.ChevronDown className="w-4 h-4 mr-2 rotate-90" /> Back to Quick Generator
                </Button>
                <h2 className="text-lg font-bold font-serif text-slate-100">Conversational Creator</h2>
             </div>
             <div className="flex-1 min-h-0 border border-slate-800 rounded-xl shadow-2xl overflow-hidden bg-slate-900">
                 <EntityChatGenerator
                    entityType="article"
                    isMockMode={isMockMode}
                    campaignContext={campaignContext}
                    onEntityCreated={(data) => {
                        const { id, ...articleData } = data;
                        onArticleCreated(articleData);
                        setMode('quick');
                    }}
                    initialData={createDefaultArticle()}
                    renderPreview={(data, onUpdate) => (
                        <ArticleEditor 
                            article={{...data, id: 'preview'}} 
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
             </div>
          </div>
      );
  }

  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && <SkeletonGeneratorOverlay />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Icons.Wizard className="w-7 h-7 text-amber-400" />
            <h2 className="text-2xl font-bold font-serif text-slate-100">Lore Article Generator</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
             <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
          </Button>
      </div>

      <p className="text-sm text-slate-400 flex-grow">
        Describe a piece of lore, a historical event, or a cosmological concept for your world.
        {isOfficialSetting && <span className="block mt-1 text-amber-400 text-xs">Google Search enabled for canon accuracy.</span>}
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., The creation myth of the world"
        rows={5}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleQuickGenerate} disabled={isLoading || !prompt.trim()} size="lg" className="w-full mt-auto">
        {isLoading ? 'Generating...' : 'Generate Article'}
      </Button>
    </div>
  );
};
