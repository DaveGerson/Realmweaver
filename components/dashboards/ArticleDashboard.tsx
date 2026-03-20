
import React from 'react';
import type { Article, NPC, Location, Faction } from '../../types/index';
import { ArticleGenerator } from '../generators/ArticleGenerator';
import { Icons } from '../common/Icons';

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
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-full">
          <ArticleGenerator onArticleCreated={onArticleCreated} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} allArticles={articles} npcs={npcs} locations={locations} factions={factions} campaignContext={campaignContext} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Lorebook Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-cyan-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-cyan-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-cyan-400">{article.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{article.content}</p>
                <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 capitalize">{article.category}</span>
              </button>
            ))}
            {articles.length === 0 && (
                <div className="md:col-span-2 text-center py-16">
                    <Icons.FileCode className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p className="text-lg font-serif text-slate-400 mb-2">History is written by the Game Master</p>
                    <p className="text-sm text-slate-600">Use the generator to build your world's lore, legends, and forgotten truths.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
