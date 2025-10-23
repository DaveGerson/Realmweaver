import React, { useState } from 'react';
import type { Article } from '../types';
import { generateArticle } from '../services/geminiService';
import { Icons } from './Icons';
import { Button } from './common/Button';

interface ArticleGeneratorProps {
  onArticleCreated: (article: Omit<Article, 'id'>) => void;
  isMockMode: boolean;
}

export const ArticleGenerator: React.FC<ArticleGeneratorProps> = ({ onArticleCreated, isMockMode }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const articleData = await generateArticle(prompt, isMockMode);
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
  
  return (
    <div className="relative bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10 transition-opacity duration-300 animate-in fade-in">
          <Icons.Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="mt-2 text-sm text-slate-300">Generating Article...</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-200 font-serif">Generate New Lore Article</h3>
      </div>
      <p className="text-sm text-slate-400">
        Describe a piece of lore, a historical event, or a cosmological concept.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., The creation myth of the world"
        rows={3}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Icons.Coach className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Icons.FileCode className="w-4 h-4 mr-2" />
            Create Article
          </>
        )}
      </Button>
    </div>
  );
};
