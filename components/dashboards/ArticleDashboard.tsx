
import React from 'react';
import type { Article } from '../../types/index';
import { ArticleGenerator } from '../generators/ArticleGenerator';
import { Icons } from '../common/Icons';

interface ArticleDashboardProps {
  articles: Article[];
  onArticleCreated: (data: Omit<Article, 'id'>) => void;
  onSelectArticle: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
}

export const ArticleDashboard: React.FC<ArticleDashboardProps> = ({ articles, onArticleCreated, onSelectArticle, isMockMode, isOfficialSetting }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ArticleGenerator onArticleCreated={onArticleCreated} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Lorebook Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{article.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{article.content}</p>
                <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 capitalize">{article.category}</span>
              </button>
            ))}
            {articles.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.FileCode className="w-12 h-12 mx-auto mb-2" />
                    <p>No lore articles created yet. Use the generator to start building your world's history.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
