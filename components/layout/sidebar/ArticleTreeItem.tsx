
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Icons } from '@/components/common/Icons';
import type { Article } from '@/types/index';

interface ArticleTreeItemProps {
  article: Article;
  allArticles: Article[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedArticles: Record<string, boolean>;
  toggleArticle: (id: string) => void;
}

export const ArticleTreeItem: React.FC<ArticleTreeItemProps> = ({
  article,
  allArticles,
  selectedId,
  onSelect,
  expandedArticles,
  toggleArticle,
}) => {
  const childArticles = allArticles.filter(a => a.parentArticleId === article.id);
  const isExpanded = !!expandedArticles[article.id];

  return (
    <div>
      <div className="flex items-center group">
        {childArticles.length > 0 ? (
          <button onClick={() => toggleArticle(article.id)} className="p-1 mr-1 text-slate-500 hover:text-slate-300">
            <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
          </button>
        ) : (
          <div className="w-5 mr-1 flex-shrink-0" /> // Placeholder for alignment
        )}
        <button
          onClick={() => onSelect(article.id)}
          className={twMerge(
            'flex-grow text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100 min-w-0',
            selectedId === article.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
          )}
          title={article.title}
        >
          <Icons.Scenes className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">{article.title}</span>
        </button>
      </div>
      {isExpanded && childArticles.length > 0 && (
        <div className="pl-4 border-l border-slate-700 ml-[10px] mt-1 space-y-0.5">
          {childArticles.map(child => (
            <ArticleTreeItem
              key={child.id}
              article={child}
              allArticles={allArticles}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedArticles={expandedArticles}
              toggleArticle={toggleArticle}
            />
          ))}
        </div>
      )}
    </div>
  );
};
