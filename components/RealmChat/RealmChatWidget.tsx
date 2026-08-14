
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { inputBaseClasses } from '../common/Textarea';
import type { Campaign, ChatMessage, DraftEntity, ModelTier, NPC, Location, Faction, Item, Adventure, Article } from '../../types/index';
import { chatWithRealmWeaver } from '../../services/aiService';
import { twMerge } from 'tailwind-merge';
import { buildCampaignContext } from '../../services/contextBuilder';
import { LinkedText } from '../common/LinkedText';
import type { QuickCardEntityType } from '../common/EntityQuickCard';

// Editors
import { NpcEditor } from '../editors/NpcEditor';
import { LocationEditor } from '../editors/LocationEditor';
import { FactionEditor } from '../editors/FactionEditor';
import { ItemEditor } from '../editors/ItemEditor';
import { AdventureEditor } from '../editors/AdventureEditor';
import { ArticleEditor } from '../editors/ArticleEditor';

interface RealmChatWidgetProps {
  campaign: Campaign;
  onAddToCampaign: (type: string, data: any) => void;
  onUpdateCampaign?: (type: string, id: string, data: any) => void;
  isMockMode: boolean;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const RealmChatWidget: React.FC<RealmChatWidgetProps> = ({ campaign, onAddToCampaign, onUpdateCampaign, isMockMode, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // New state for minimized view
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tier, setTier] = useState<ModelTier>('medium');
  const [isEntityPickerOpen, setIsEntityPickerOpen] = useState(false);
  const [entityPickerSearch, setEntityPickerSearch] = useState('');

  // Session-persistent chat history keyed by campaign ID
  const storageKey = `realmchat-history-${campaign.id}`;
  const [history, setHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as ChatMessage[];
    } catch {
      // ignore parse errors
    }
    return [];
  });

  // Persist history to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // sessionStorage quota exceeded — ignore
    }
  }, [history, storageKey]);

  // State for generated content
  const [drafts, setDrafts] = useState<DraftEntity[]>([]);
  const [approvedLog, setApprovedLog] = useState<string[]>([]);

  // Modal State for editing/approving
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  // Context for AI calls (e.g. RegenerateButton, "Generate next scene") made
  // from *inside* a draft editor below — CLAUDE.md requires campaignContext
  // be passed to every AI generation call so results stay consistent with
  // the world (finding #64).
  const draftEditorContext = useMemo(
    () => buildCampaignContext({ variant: 'generation', campaign }),
    [campaign],
  );

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isOpen, isMinimized]);

  const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
  }

  const handleNewConversation = () => {
      setHistory([]);
      setDrafts([]);
      setApprovedLog([]);
      setSelectedDraftId(null);
      try {
          sessionStorage.removeItem(storageKey);
      } catch {
          // ignore
      }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const newUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    setHistory(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    const context = buildCampaignContext({
      variant: 'chat',
      campaign,
      activeSceneId: campaign.activeSceneId,
      activeSessionId: campaign.activeSessionId,
    });

    try {
      const response = await chatWithRealmWeaver(
        [...history, newUserMsg],
        drafts,
        approvedLog,
        context,
        tier,
        isMockMode, // Pass isMockMode
        undefined // No focused entity type for general chat
      );

      const newAiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: response.message,
        suggestions: response.suggestions,
        timestamp: Date.now()
      };

      setHistory(prev => [...prev, newAiMsg]);
      
      // Merge drafts based on ID
      if (response.draftEntities.length > 0) {
        setDrafts(prev => {
            const updatedMap = new Map(prev.map(d => [d.id, d]));
            response.draftEntities.forEach(d => updatedMap.set(d.id, d));
            return Array.from(updatedMap.values());
        });
      }

    } catch (error) {
      console.error(error);
      setHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Sorry, something went wrong.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = (draftId: string) => {
      const draft = drafts.find(d => d.id === draftId);
      if (!draft) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { id, ...dataWithoutId } = draft.data as any; 
      
      // Check if this is an existing entity (by ID presence in campaign)
      const isExisting = 
        campaign.npcs.some(n => n.id === draft.id) ||
        campaign.locations.some(l => l.id === draft.id) ||
        campaign.factions.some(f => f.id === draft.id) ||
        campaign.items.some(i => i.id === draft.id) ||
        campaign.adventures.some(a => a.id === draft.id) ||
        campaign.articles.some(a => a.id === draft.id);

      if (isExisting && onUpdateCampaign) {
          onUpdateCampaign(draft.type, draft.id, dataWithoutId);
          setApprovedLog(prev => [...prev, `Updated ${draft.type}: ${(draft.data as any).name || (draft.data as any).title}`]);
          setHistory(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'model',
              text: `I've updated "${(draft.data as any).name || (draft.data as any).title}" in the campaign.`,
              timestamp: Date.now()
          }]);
      } else {
          onAddToCampaign(draft.type, dataWithoutId);
          setApprovedLog(prev => [...prev, `Created ${draft.type}: ${(draft.data as any).name || (draft.data as any).title}`]);
          setHistory(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'model',
              text: `I've added "${(draft.data as any).name || (draft.data as any).title}" to the campaign.`,
              timestamp: Date.now()
          }]);
      }
      
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      setSelectedDraftId(null);
  };

  const handleUpdateDraft = (id: string, updates: any) => {
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, data: { ...d.data, ...updates } } : d));
  };
  
  const handleDiscardDraft = (id: string) => {
      setDrafts(prev => prev.filter(d => d.id !== id));
      setSelectedDraftId(null);
  }

  const handleImportEntity = (type: string, id: string) => {
      let entity: any = null;
      if (type === 'npc') entity = campaign.npcs.find(n => n.id === id);
      else if (type === 'location') entity = campaign.locations.find(l => l.id === id);
      else if (type === 'faction') entity = campaign.factions.find(f => f.id === id);
      else if (type === 'item') entity = campaign.items.find(i => i.id === id);
      else if (type === 'adventure') entity = campaign.adventures.find(a => a.id === id);
      else if (type === 'article') entity = campaign.articles.find(a => a.id === id);

      if (entity) {
          const newDraft: DraftEntity = {
              id: entity.id,
              type: type as any,
              status: 'draft',
              data: { ...entity }
          };
          
          // Remove if already exists to overwrite
          setDrafts(prev => [...prev.filter(d => d.id !== entity.id), newDraft]);
          setHistory(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'model',
              text: `I've loaded "${entity.name || entity.title}" into the chat. What would you like to change?`,
              timestamp: Date.now()
          }]);
          setIsEntityPickerOpen(false);
          setEntityPickerSearch('');
      }
  }

  // Filter all entity lists for the entity picker search (case-insensitive name match)
  const filteredPickerNpcs = useMemo(() => {
      if (!entityPickerSearch) return campaign.npcs;
      const q = entityPickerSearch.toLowerCase();
      return campaign.npcs.filter(e => e.name.toLowerCase().includes(q));
  }, [campaign.npcs, entityPickerSearch]);
  const filteredPickerLocations = useMemo(() => {
      if (!entityPickerSearch) return campaign.locations;
      const q = entityPickerSearch.toLowerCase();
      return campaign.locations.filter(e => e.name.toLowerCase().includes(q));
  }, [campaign.locations, entityPickerSearch]);
  const filteredPickerFactions = useMemo(() => {
      if (!entityPickerSearch) return campaign.factions;
      const q = entityPickerSearch.toLowerCase();
      return campaign.factions.filter(e => e.name.toLowerCase().includes(q));
  }, [campaign.factions, entityPickerSearch]);
  const filteredPickerItems = useMemo(() => {
      if (!entityPickerSearch) return campaign.items;
      const q = entityPickerSearch.toLowerCase();
      return campaign.items.filter(e => e.name.toLowerCase().includes(q));
  }, [campaign.items, entityPickerSearch]);
  const filteredPickerAdventures = useMemo(() => {
      if (!entityPickerSearch) return campaign.adventures;
      const q = entityPickerSearch.toLowerCase();
      return campaign.adventures.filter(e => e.title.toLowerCase().includes(q));
  }, [campaign.adventures, entityPickerSearch]);
  const filteredPickerArticles = useMemo(() => {
      if (!entityPickerSearch) return campaign.articles;
      const q = entityPickerSearch.toLowerCase();
      return campaign.articles.filter(e => e.title.toLowerCase().includes(q));
  }, [campaign.articles, entityPickerSearch]);

  const selectedDraft = drafts.find(d => d.id === selectedDraftId);

  return (
    <>
        {/* FAB */}
        {!isOpen && (
            <button
                onClick={handleOpen}
                className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-500 transition-transform hover:scale-105 z-[70]"
                aria-label="Open RealmChat"
            >
                <Icons.Chat className="w-8 h-8" />
            </button>
        )}

        {/* Main Window */}
        {isOpen && (
            <div className={twMerge(
                "fixed bottom-3 right-3 sm:bottom-6 sm:right-6 w-full sm:w-[450px] max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-[70] transition-all duration-300",
                isMinimized ? "h-auto" : "h-[calc(100vh-6rem)] sm:h-[700px] animate-fade-in"
            )}>
                {/* Header */}
                <header 
                    className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700 cursor-pointer"
                    onClick={() => isMinimized && setIsMinimized(false)}
                >
                    <div className="flex items-center gap-2">
                        <Icons.Chat className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-serif font-bold text-slate-100">RealmChat</h3>
                        {isMockMode && <span className="px-2 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full font-sans font-bold">MOCK</span>}
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                         {!isMinimized && (
                             <>
                                <Button
                                    variant="icon"
                                    onClick={handleNewConversation}
                                    title="New Conversation"
                                    className="hover:text-amber-300"
                                >
                                    <Icons.Plus className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="icon"
                                    onClick={() => setIsEntityPickerOpen(p => !p)}
                                    title="Load Existing Entity"
                                    className={isEntityPickerOpen ? 'bg-indigo-600 text-white hover:bg-indigo-500' : ''}
                                >
                                    <Icons.FolderOpen className="w-4 h-4" />
                                </Button>
                                <select
                                    value={tier}
                                    onChange={(e) => setTier(e.target.value as ModelTier)}
                                    className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500 max-w-[100px]"
                                >
                                    <option value="performance">Fast</option>
                                    <option value="medium">Smart</option>
                                    <option value="quality">Best</option>
                                </select>
                             </>
                         )}
                        {isMinimized ? (
                            <Button variant="icon" onClick={() => setIsMinimized(false)} title="Expand">
                                <Icons.Maximize className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button variant="icon" onClick={() => setIsMinimized(true)} title="Minimize">
                                <Icons.Minus className="w-4 h-4" />
                            </Button>
                        )}
                        <Button variant="icon" onClick={() => setIsOpen(false)} title="Close">
                            <Icons.X className="w-4 h-4" />
                        </Button>
                    </div>
                </header>

                {!isMinimized && (
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        
                        {/* Entity Picker Overlay */}
                        {isEntityPickerOpen && (
                            <div className="absolute inset-0 bg-slate-900 z-20 flex flex-col animate-in fade-in duration-200">
                                <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                                    <h4 className="text-sm font-semibold text-slate-200">Load Entity to Edit</h4>
                                    <Button variant="icon" onClick={() => { setIsEntityPickerOpen(false); setEntityPickerSearch(''); }}>
                                        <Icons.X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="p-2 border-b border-slate-700/50 bg-slate-800/50">
                                    <input
                                        type="text"
                                        value={entityPickerSearch}
                                        onChange={e => setEntityPickerSearch(e.target.value)}
                                        placeholder="Search entities..."
                                        className={`${inputBaseClasses} w-full px-3 py-1.5 text-sm`}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    <EntityPickerList title="NPCs" items={filteredPickerNpcs} type="npc" onSelect={handleImportEntity} />
                                    <EntityPickerList title="Locations" items={filteredPickerLocations} type="location" onSelect={handleImportEntity} />
                                    <EntityPickerList title="Factions" items={filteredPickerFactions} type="faction" onSelect={handleImportEntity} />
                                    <EntityPickerList title="Items" items={filteredPickerItems} type="item" onSelect={handleImportEntity} />
                                    <EntityPickerList title="Adventures" items={filteredPickerAdventures} type="adventure" onSelect={handleImportEntity} />
                                    <EntityPickerList title="Lore" items={filteredPickerArticles} type="article" onSelect={handleImportEntity} />
                                    {entityPickerSearch && filteredPickerNpcs.length === 0 && filteredPickerLocations.length === 0 && filteredPickerFactions.length === 0 && filteredPickerItems.length === 0 && filteredPickerAdventures.length === 0 && filteredPickerArticles.length === 0 && (
                                        <p className="text-center text-slate-500 text-sm py-6">No entities match "{entityPickerSearch}"</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-4">
                            {/* Drafts Panel (Overlay at top if present) */}
                            {drafts.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto py-2 mb-2 border-b border-slate-800/50">
                                    {drafts.map(draft => (
                                        <button 
                                            key={draft.id}
                                            onClick={() => setSelectedDraftId(draft.id)}
                                            className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/30 px-3 py-1.5 rounded-full text-xs text-indigo-200 whitespace-nowrap hover:bg-indigo-900/50 transition-colors"
                                        >
                                            <Icons.Edit className="w-3 h-3" />
                                            {/* @ts-ignore */}
                                            <span className="max-w-[100px] truncate">{draft.data.name || draft.data.title || 'Untitled'}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {history.length === 0 && (
                                <div className="text-center text-slate-500 mt-10 space-y-2">
                                    <Icons.Sparkles className="w-8 h-8 mx-auto opacity-50" />
                                    <p>Hello! I'm RealmChat.</p>
                                    <p className="text-sm">I can help you create or edit NPCs, locations, and more. Try asking:</p>
                                    <button onClick={() => handleSend("Create a goblin merchant")} className="block w-full text-xs bg-slate-800 p-2 rounded hover:bg-slate-700">"Create a goblin merchant"</button>
                                    <button onClick={() => handleSend("I need a spooky forest location")} className="block w-full text-xs bg-slate-800 p-2 rounded hover:bg-slate-700">"I need a spooky forest location"</button>
                                </div>
                            )}
                            {history.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                                        {msg.role === 'model' && onNavigate ? (
                                            <LinkedText text={msg.text} onNavigate={onNavigate} />
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                    {msg.suggestions && msg.suggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {msg.suggestions.map((s, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => handleSend(s)}
                                                    className="text-xs bg-slate-800 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded-full hover:bg-indigo-900/50 transition-colors"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="self-start bg-slate-800 p-3 rounded-lg border border-slate-700 w-16 flex justify-center">
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-slate-800 border-t border-slate-700">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200 placeholder:text-slate-500"
                                    disabled={isLoading}
                                />
                                <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-500">
                                    <Icons.Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Draft Editor Overlay */}
                        {selectedDraft && (
                            <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col animate-fade-in">
                                <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
                                    <h4 className="text-sm font-bold text-slate-200">
                                        {/* @ts-ignore */}
                                        Editing {selectedDraft.type}: {selectedDraft.data.name || selectedDraft.data.title || 'Untitled'}
                                    </h4>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="danger" onClick={() => handleDiscardDraft(selectedDraft.id)}>Discard</Button>
                                        <Button size="sm" onClick={() => handleApprove(selectedDraft.id)} className="bg-green-600 hover:bg-green-500">
                                            <Icons.CheckCircle className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900">
                                    {selectedDraft.type === 'npc' && (
                                        <NpcEditor 
                                            npc={selectedDraft.data as NPC} 
                                            factions={campaign.factions}
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)} 
                                            onDelete={() => {}} 
                                            isMockMode={isMockMode} 
                                        />
                                    )}
                                    {selectedDraft.type === 'location' && (
                                        <LocationEditor 
                                            location={selectedDraft.data as Location} 
                                            allLocations={campaign.locations}
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)} 
                                            onDelete={() => {}} 
                                            isMockMode={isMockMode} 
                                        />
                                    )}
                                    {selectedDraft.type === 'faction' && (
                                        <FactionEditor
                                            faction={selectedDraft.data as Faction}
                                            allNpcs={campaign.npcs}
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)}
                                            onDelete={() => {}}
                                            isMockMode={isMockMode}
                                            // This faction is an unsaved chat draft — even though its id is a
                                            // real uuid (not 'preview'), it isn't in the campaign yet, so
                                            // "Generate member NPC" must stay disabled until Approve commits
                                            // it (finding #71).
                                            isPreview
                                        />
                                    )}
                                    {selectedDraft.type === 'item' && (
                                        <ItemEditor 
                                            item={selectedDraft.data as Item} 
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)} 
                                            onDelete={() => {}} 
                                            isMockMode={isMockMode} 
                                        />
                                    )}
                                    {selectedDraft.type === 'adventure' && (
                                        <AdventureEditor
                                            adventure={selectedDraft.data as Adventure}
                                            campaign={campaign}
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)}
                                            isMockMode={isMockMode}
                                            campaignContext={draftEditorContext}
                                        />
                                    )}
                                    {selectedDraft.type === 'article' && (
                                        <ArticleEditor 
                                            article={selectedDraft.data as Article} 
                                            allArticles={campaign.articles}
                                            onUpdate={(_, data) => handleUpdateDraft(selectedDraft.id, data)} 
                                            onDelete={() => {}}
                                            isMockMode={isMockMode} 
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
    </>
  );
};

const EntityPickerList = ({ title, items, type, onSelect }: { title: string, items: any[], type: string, onSelect: (t: string, id: string) => void }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="mb-3">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">{title}</h5>
            <div className="space-y-1">
                {items.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => onSelect(type, item.id)}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors truncate"
                    >
                        {item.name || item.title}
                    </button>
                ))}
            </div>
        </div>
    )
}
