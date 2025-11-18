
import React, { useState, useEffect } from 'react';
import type { Article, ArticleCategory, NPC, Location, Faction } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';

interface ArticleEditorProps {
  article: Article;
  allArticles: Article[];
  allNpcs?: NPC[];
  allLocations?: Location[];
  allFactions?: Faction[];
  onUpdate: (id: string, updatedData: Partial<Article>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

const categoryOptions: ArticleCategory[] = ['lore', 'history', 'cosmology'];

export const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, allArticles, allNpcs = [], allLocations = [], allFactions = [], onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(article);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds' | 'category'> | null>(null);

  useEffect(() => {
    setFormData(article);
  }, [article]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Article] !== article[e.target.name as keyof Article]) {
      onUpdate(article.id, { [e.target.name]: e.target.value });
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    onUpdate(article.id, { [name]: finalValue });
  };
  
  const handleRelatedEntityToggle = (entityId: string) => {
      const currentRelated = formData.relatedEntityIds || [];
      const newRelated = currentRelated.includes(entityId)
        ? currentRelated.filter(id => id !== entityId)
        : [...currentRelated, entityId];
        
      setFormData(prev => ({ ...prev, relatedEntityIds: newRelated }));
      onUpdate(article.id, { relatedEntityIds: newRelated });
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the article "${article.title}"? This cannot be undone.`)) {
        onDelete(article.id);
    }
  }

  const handleAiGenerate = async (field: 'content') => {
    setIsGenerating(field);
    const context = `Article Title: ${formData.title}\nCategory: ${formData.category}`;
    const prompt = `Based on the following article info, generate compelling content:\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(article.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const possibleParents = allArticles.filter(a => {
    if (a.id === article.id) return false;
    let current = a;
    while (current.parentArticleId) {
      if (current.parentArticleId === article.id) return false;
      const parent = allArticles.find(p => p.id === current.parentArticleId);
      if (!parent) break;
      current = parent;
    }
    return true;
  });

  const subArticles = allArticles.filter(a => article.subArticleIds.includes(a.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.FileCode className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Lorebook Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Article
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Article Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Category</label>
                <select
                    name="category"
                    value={formData.category}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all capitalize"
                >
                    {categoryOptions.map(c => (
                        <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                </select>
            </div>
        </div>

        <AiTextarea
          label="Content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={15}
          onAiGenerate={() => handleAiGenerate('content')}
          isGenerating={isGenerating === 'content'}
        />
        
        {/* Related Entities Section */}
        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
            <label className="block text-sm font-medium text-slate-400 mb-3">Related Entities</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto custom-scrollbar">
                <EntityList title="NPCs" entities={allNpcs} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
                <EntityList title="Locations" entities={allLocations} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
                <EntityList title="Factions" entities={allFactions} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
            </div>
             {(allNpcs.length === 0 && allLocations.length === 0 && allFactions.length === 0) && (
                <p className="text-xs text-slate-500 italic text-center py-2">Create NPCs, Locations, or Factions to link them here.</p>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parent Article</label>
                <select
                    name="parentArticleId"
                    value={formData.parentArticleId || "none"}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                >
                    <option value="none">-- None (Top Level) --</option>
                    {possibleParents.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                </select>
            </div>

            <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1.5">Sub-Articles</label>
                 {subArticles.length > 0 ? (
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 mt-2 pl-2">
                        {subArticles.map(a => <li key={a.id}>{a.title}</li>)}
                    </ul>
                 ) : (
                    <p className="text-sm text-slate-500 italic mt-2">No sub-articles assigned.</p>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};

const EntityList = ({ title, entities, selectedIds, onToggle }: { title: string, entities: {id: string, name: string}[], selectedIds: string[], onToggle: (id: string) => void }) => {
    if (entities.length === 0) return null;
    return (
        <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{title}</h4>
            <div className="space-y-1">
                {entities.map(entity => (
                    <label key={entity.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-800 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.includes(entity.id)} 
                            onChange={() => onToggle(entity.id)}
                            className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-slate-300 truncate">{entity.name}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}
