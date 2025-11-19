
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import type { Campaign, ChatMessage, DraftEntity, ModelTier, NPC, Location, Faction, Item, Adventure, Article } from '../../types/index';
import { chatWithRealmWeaver } from '../../services/geminiService';
import { twMerge } from 'tailwind-merge';

// Editors (Reused)
import { NpcEditor } from '../editors/NpcEditor';
import { LocationEditor } from '../editors/LocationEditor';
import { FactionEditor } from '../editors/FactionEditor';
import { ItemEditor } from '../editors/ItemEditor';
import { AdventureEditor } from '../editors/AdventureEditor';
import { ArticleEditor } from '../editors/ArticleEditor';

interface RealmChatWidgetProps {
  campaign: Campaign;
  onAddToCampaign: (type: string, data: any) => void; // Generic add handler
  isMockMode: boolean;
}

export const RealmChatWidget: React.FC<RealmChatWidgetProps> = ({ campaign, onAddToCampaign, isMockMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tier, setTier] = useState<ModelTier>('medium');
  
  // State for generated content
  const [drafts, setDrafts] = useState<DraftEntity[]>([]);
  const [approvedLog, setApprovedLog] = useState<string[]>([]);
  
  // Modal State for editing/approving
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isOpen]);

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

    const context = `Title: ${campaign.title}\nSetting: ${campaign.setting}`;

    try {
      const response = await chatWithRealmWeaver(
        [...history, newUserMsg],
        drafts,
        approvedLog,
        context,
        tier,
        isMockMode
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
      // We strip the draft ID so the campaign service can generate a fresh one if needed, 
      // or we can pass it if we want to preserve it. 
      // Campaign service usually generates IDs. Let's pass the data.
      
      // We map draft types to the onAddToCampaign function signature expected by App.tsx helpers or direct calls
      // Actually the prop `onAddToCampaign` here is generic. We'll assume it maps to `campaignService.create[Type]`.
      
      // We need to correctly route this in App.tsx or handle it here. 
      // Since we don't have direct access to `campaignService` creators here easily without prop drilling many functions,
      // we rely on the prop.
      
      onAddToCampaign(draft.type, dataWithoutId);
      
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      setApprovedLog(prev => [...prev, `${draft.type}: ${(draft.data as any).name || (draft.data as any).title}`]);
      setSelectedDraftId(null);
  };

  const handleUpdateDraft = (id: string, updates: any) => {
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, data: { ...d.data, ...updates } } : d));
  };
  
  const handleDiscardDraft = (id: string) => {
      setDrafts(prev => prev.filter(d => d.id !== id));
      setSelectedDraftId(null);
  }

  const selectedDraft = drafts.find(d => d.id === selectedDraftId);

  return (
    <>
        {/* FAB */}
        {!isOpen && (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-500 transition-transform hover:scale-105 z-50"
                aria-label="Open RealmChat"
            >
                <Icons.Chat className="w-8 h-8" />
            </button>
        )}

        {/* Main Window */}
        {isOpen && (
            <div className="fixed bottom-6 right-6 w-[450px] h-[650px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 duration-200">
                {/* Header */}
                <header className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Icons.Chat className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-serif font-bold text-slate-100">RealmChat</h3>
                    </div>
                    <div className="flex items-center gap-2">
                         <select 
                            value={tier} 
                            onChange={(e) => setTier(e.target.value as ModelTier)}
                            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500"
                        >
                            <option value="performance">Performance (Lite)</option>
                            <option value="medium">Medium (Flash)</option>
                            <option value="quality">Quality (Pro)</option>
                        </select>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                            <Icons.Minimize className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-32">
                        {history.length === 0 && (
                            <div className="text-center text-slate-500 mt-10">
                                <p>Hello! I'm RealmChat.</p>
                                <p className="text-sm">I can help you create NPCs, locations, and more.</p>
                            </div>
                        )}
                        {history.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                                    {msg.text}
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

                    {/* Drafts Panel (Overlay at top if present) */}
                    {drafts.length > 0 && (
                         <div className="absolute top-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 p-2 flex gap-2 overflow-x-auto custom-scrollbar z-10">
                            {drafts.map(draft => (
                                <button 
                                    key={draft.id} 
                                    onClick={() => setSelectedDraftId(draft.id)}
                                    className="flex items-center gap-2 bg-slate-900 border border-indigo-500/50 rounded-md px-3 py-1.5 text-xs hover:bg-slate-800 flex-shrink-0 transition-colors"
                                >
                                    <span className="text-indigo-400 uppercase font-bold text-[10px]">{draft.type}</span>
                                    <span className="text-slate-200 font-medium truncate max-w-[100px]">{(draft.data as any).name || (draft.data as any).title || 'Untitled'}</span>
                                    {draft.status === 'draft' && <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
                                </button>
                            ))}
                        </div>
                    )}

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
                            <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="sm">
                                <Icons.Combat className="w-4 h-4 rotate-90" /> {/* Send icon proxy */}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Entity Editor Modal (Nested) */}
                {selectedDraft && (
                     <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full h-full flex flex-col shadow-2xl relative">
                             <div className="absolute top-2 right-2 z-10 flex gap-2">
                                <Button size="sm" onClick={() => handleApprove(selectedDraft.id)} className="bg-green-600 hover:bg-green-500">
                                    <Icons.CheckCircle className="w-4 h-4 mr-2" /> Approve
                                </Button>
                                <button onClick={() => setSelectedDraftId(null)} className="p-2 bg-slate-800 rounded-md text-slate-400 hover:text-white">
                                    <Icons.X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 pt-12">
                                {selectedDraft.type === 'npc' && <NpcEditor npc={selectedDraft.data as NPC} factions={campaign.factions} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} onDelete={() => handleDiscardDraft(selectedDraft.id)} isMockMode={isMockMode} />}
                                {selectedDraft.type === 'location' && <LocationEditor location={selectedDraft.data as Location} allLocations={campaign.locations} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} onDelete={() => handleDiscardDraft(selectedDraft.id)} isMockMode={isMockMode} />}
                                {selectedDraft.type === 'faction' && <FactionEditor faction={selectedDraft.data as Faction} allNpcs={campaign.npcs} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} onDelete={() => handleDiscardDraft(selectedDraft.id)} isMockMode={isMockMode} />}
                                {selectedDraft.type === 'item' && <ItemEditor item={selectedDraft.data as Item} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} onDelete={() => handleDiscardDraft(selectedDraft.id)} isMockMode={isMockMode} />}
                                {selectedDraft.type === 'adventure' && <AdventureEditor adventure={selectedDraft.data as Adventure} campaign={campaign} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} />}
                                {selectedDraft.type === 'article' && <ArticleEditor article={selectedDraft.data as Article} allArticles={campaign.articles} onUpdate={(id, data) => handleUpdateDraft(selectedDraft.id, data)} onDelete={() => handleDiscardDraft(selectedDraft.id)} isMockMode={isMockMode} />}
                            </div>
                        </div>
                     </div>
                )}
            </div>
        )}
    </>
  );
};
