
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { Article, ArticleCategory, Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';

interface ArticleEditorProps {
  article: Article;
  allArticles: Article[];
  // Optional props
  allNpcs?: any[];
  allLocations?: any[];
  allFactions?: any[];
  campaign?: Campaign;
  onUpdate: (id: string, updatedData: Partial<Article>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const categoryOptions: ArticleCategory[] = ['lore', 'history', 'cosmology'];

export const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, allArticles, allNpcs: propAllNpcs, allLocations: propAllLocations, allFactions: propAllFactions, campaign, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(article);
  const { confirm } = useConfirmDialog();

  const allNpcs = propAllNpcs ?? campaign?.npcs ?? [];
  const allLocations = propAllLocations ?? campaign?.locations ?? [];
  const allFactions = propAllFactions ?? campaign?.factions ?? [];

  // Tracks the last `article` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevArticleRef = useRef(article);

  useEffect(() => {
    const prevArticle = prevArticleRef.current;
    if (prevArticle !== article) {
      setFormData(prev => reconcileEntityFormData(prev, prevArticle, article));
    }
    prevArticleRef.current = article;
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

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Article', `Are you sure you want to delete the article "${article.title}"? This cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(article.id);
    }
  }

  // Used by MentionInput fields (onChange receives string, not event).
  // Local edits commit immediately for responsive typing, but the store write
  // (onUpdate) is debounced so unblurred keystrokes coalesce into a single
  // campaign-wide update instead of one per character.
  const mentionFieldTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = mentionFieldTimersRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);
  const handleMentionFieldChange = (field: keyof Article) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const timers = mentionFieldTimersRef.current;
    if (timers[field]) clearTimeout(timers[field]);
    timers[field] = setTimeout(() => {
      onUpdate(article.id, { [field]: value });
    }, 400);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, article.mentionedEntityIds),
    [campaign, article.mentionedEntityIds],
  );
  const [mentionedIdsByField, setMentionedIdsByField] = useState<Record<string, string[]>>(() => ({
    content: findMentionedIdsInText(article.content, mentionCandidates),
  }));
  // Kept in sync with `mentionedIdsByField` so the merged set can be computed
  // and reported without writing to the store from inside a setState updater
  // (React invokes functional updaters during the render phase, and StrictMode
  // intentionally double-invokes them — doing the store write there fired it twice).
  const mentionedIdsByFieldRef = useRef(mentionedIdsByField);
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    const next = { ...mentionedIdsByFieldRef.current, [field]: ids };
    mentionedIdsByFieldRef.current = next;
    setMentionedIdsByField(next);
    const merged = Array.from(new Set(Object.values(next).flat()));
    setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
    onUpdate(article.id, { mentionedEntityIds: merged });
  };

  const handleFieldRegenerate = (field: 'content') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(article.id, { [field]: newValue });
  };

  const articleEntityContext = `Article Title: ${formData.title}\nCategory: ${formData.category}\nContent summary: ${(formData.content || '').substring(0, 200)}...`;

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

  const subArticles = allArticles.filter(a => (article.subArticleIds || []).includes(a.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Category</label>
                <select
                    name="category"
                    value={formData.category}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
                >
                    {categoryOptions.map(c => (
                        <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                </select>
            </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Content</label>
              <RegenerateButton fieldName="content" currentValue={formData.content} entityType="Article" entityContext={articleEntityContext} onRegenerate={handleFieldRegenerate('content')} isMockMode={isMockMode} campaignContext={campaignContext} />
            </div>
          </div>
          <MentionInput
            value={formData.content}
            onChange={handleMentionFieldChange('content')}
            onMentionedIdsChange={handleMentionedIdsChange('content')}
            initialMentions={mentionCandidates}
            rows={15}
            placeholder="Write the article content here... (type @ to mention entities)"
          />
        </div>
        {formData.content && onNavigate && (
            <div className="text-sm text-slate-300 leading-relaxed mt-1 px-1 whitespace-pre-wrap">
                <LinkedText text={formData.content} onNavigate={onNavigate} />
            </div>
        )}
        
        {/* Related Entities Section */}
        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
            <label className="block text-sm font-medium text-slate-400 mb-3">Related Entities</label>
            {/* EntityLink chips for currently-selected entities */}
            {(formData.relatedEntityIds || []).length > 0 && onNavigate && (() => {
                const selectedLinks: React.ReactNode[] = [];
                for (const id of formData.relatedEntityIds || []) {
                    const npc = allNpcs.find((n: any) => n.id === id);
                    if (npc) { selectedLinks.push(<EntityLink key={id} entityType="npc" entityId={id} label={npc.name} onNavigate={onNavigate!} />); continue; }
                    const loc = allLocations.find((l: any) => l.id === id);
                    if (loc) { selectedLinks.push(<EntityLink key={id} entityType="location" entityId={id} label={loc.name} onNavigate={onNavigate!} />); continue; }
                    const fac = allFactions.find((f: any) => f.id === id);
                    if (fac) { selectedLinks.push(<EntityLink key={id} entityType="faction" entityId={id} label={fac.name} onNavigate={onNavigate!} />); }
                }
                return selectedLinks.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-800">
                        {selectedLinks}
                    </div>
                ) : null;
            })()}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto custom-scrollbar">
                <EntityList title="NPCs" entities={allNpcs} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
                <EntityList title="Locations" entities={allLocations} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
                <EntityList title="Factions" entities={allFactions} selectedIds={formData.relatedEntityIds || []} onToggle={handleRelatedEntityToggle} />
            </div>
             {(allNpcs.length === 0 && allLocations.length === 0 && allFactions.length === 0) && (
                <p className="text-xs text-slate-500 italic text-center py-2">Create NPCs, Locations, or Factions to link them here.</p>
            )}
        </div>

        {campaign && (
          <EntityHistoryManager
              subjectId={article.id}
              subjectType="article"
              campaign={campaign}
              onUpdateEntity={(type, id, changes) => {
                  if (type === 'npc') campaignService.updateNpc(id, changes);
                  if (type === 'location') campaignService.updateLocation(id, changes);
              }}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parent Article</label>
                <select
                    name="parentArticleId"
                    value={formData.parentArticleId || "none"}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                >
                    <option value="none">-- None (Top Level) --</option>
                    {possibleParents.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                </select>
                {formData.parentArticleId && onNavigate && (
                    <div className="mt-1.5">
                        <EntityLink
                            entityType="article"
                            entityId={formData.parentArticleId}
                            label={allArticles.find(a => a.id === formData.parentArticleId)?.title}
                            onNavigate={onNavigate}
                        />
                    </div>
                )}
            </div>

            <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1.5">Sub-Articles</label>
                 {subArticles.length > 0 ? (
                    <ul className="space-y-1 mt-2">
                        {subArticles.map(a => (
                            <li key={a.id} className="flex items-center gap-1.5 text-sm text-slate-300">
                                <Icons.FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                {onNavigate ? (
                                    <EntityLink
                                        entityType="article"
                                        entityId={a.id}
                                        label={a.title}
                                        onNavigate={onNavigate}
                                    />
                                ) : a.title}
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-sm text-slate-500 italic mt-2">No sub-articles assigned.</p>
                 )}
            </div>
        </div>

        {/* Backlinks Panel */}
        <BacklinksPanel entityId={article.id} entityType="article" onNavigate={onNavigate} />

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
                            className="rounded border-slate-600 bg-slate-900 text-amber-600 focus:ring-amber-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-slate-300 truncate">{entity.name}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}
