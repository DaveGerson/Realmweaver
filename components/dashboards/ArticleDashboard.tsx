
import React, { useState, useMemo } from 'react';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import type { Article, NPC, Location, Faction } from '../../types/index';
import { ArticleGenerator } from '../generators/ArticleGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { ArticleEditor } from '../editors/ArticleEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
import { createDefaultArticle } from '../../utils/entityUtils';

const ARTICLE_PROMPT_CHIPS = [
  'A historical event',
  'A deity profile',
  'A cultural tradition',
  'A magical phenomenon',
];

interface ArticleDashboardProps {
  articles: Article[];
  npcs?: NPC[];
  locations?: Location[];
  factions?: Faction[];
  onArticleCreated: (data: Omit<Article, 'id'>) => void;
  onSelectArticle: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const ArticleDashboard: React.FC<ArticleDashboardProps> = ({ articles, npcs = [], locations = [], factions = [], onArticleCreated, onSelectArticle, isMockMode, isOfficialSetting, campaignContext }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { getRovingProps } = useRovingTabIndex({ direction: 'both', columns: 3 });
  const filteredArticles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.content?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q)
    );
  }, [articles, searchTerm]);

  const handleArticleCreated = (data: any) => {
    const { id, ...articleData } = data;
    onArticleCreated({
      ...articleData,
      parentArticleId: undefined,
      subArticleIds: articleData.subArticleIds ?? [],
    });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <EntityCreationPanel
        entityLabel="Lore Article"
        chatPanel={
          <EntityChatGenerator
            entityType="article"
            isMockMode={isMockMode}
            campaignContext={campaignContext}
            onEntityCreated={handleArticleCreated}
            initialData={createDefaultArticle()}
            promptChips={ARTICLE_PROMPT_CHIPS}
            renderPreview={(data, onUpdate) => (
              <ArticleEditor
                article={{ ...data, id: 'preview' }}
                allArticles={articles}
                allNpcs={npcs}
                allLocations={locations}
                allFactions={factions}
                onUpdate={(_, updates) => onUpdate(updates)}
                onDelete={() => {}}
                isMockMode={isMockMode}
              />
            )}
          />
        }
        formPanel={
          <ArticleGenerator
            onArticleCreated={onArticleCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            allArticles={articles}
            npcs={npcs}
            locations={locations}
            factions={factions}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Lorebook Articles ({articles.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search articles..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArticles.map((article, index) => {
            const contentSnippet = article.content ? article.content.slice(0, 100) + (article.content.length > 100 ? '…' : '') : '';
            const categoryColors: Record<string, string> = {
              lore: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
              history: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
              cosmology: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
            };
            const categoryStyle = categoryColors[article.category] ?? 'bg-slate-700/60 text-slate-300 border-slate-600/30';
            return (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-cyan-500 text-left hover:border-slate-700 hover:border-l-cyan-400 transition-all space-y-2"
                {...getRovingProps(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-cyan-400 leading-tight">{article.title}</h3>
                  <span className={`flex-shrink-0 text-[10px] border rounded-full px-2 py-0.5 capitalize ${categoryStyle}`}>
                    {article.category}
                  </span>
                </div>
                {contentSnippet && (
                  <p className="text-xs text-slate-400 leading-relaxed">{contentSnippet}</p>
                )}
              </button>
            );
          })}
          {filteredArticles.length === 0 && articles.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No articles match "{searchTerm}"</p>
            </div>
          )}
          {articles.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.FileCode className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">History is written by the Game Master</p>
              <p className="text-sm text-slate-600">Use the generator to build your world's lore, legends, and forgotten truths.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
