
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import type { ChatMessage, DraftEntity, NPC, Location, Faction, Item, Adventure, Article } from '../../types/index';
import { chatWithRealmWeaver } from '../../services/aiService';
import { twMerge } from 'tailwind-merge';

interface EntityChatGeneratorProps {
  entityType: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'scene';
  onEntityCreated: (data: any) => void;
  renderPreview: (data: any, onUpdate: (data: any) => void) => React.ReactNode;
  initialData: any;
  isMockMode: boolean;
  campaignContext?: string;
  promptChips?: string[];
}

export const EntityChatGenerator: React.FC<EntityChatGeneratorProps> = ({
    entityType,
    onEntityCreated,
    renderPreview,
    initialData,
    isMockMode,
    campaignContext,
    promptChips,
}) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draftData, setDraftData] = useState<any>(initialData);
  const [draftId, setDraftId] = useState<string>(crypto.randomUUID()); // Local session ID for the draft
  const [isFinalizing, setIsFinalizing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Initial greeting
  useEffect(() => {
      if (history.length === 0) {
          setHistory([{
              id: 'init',
              role: 'model',
              text: `Hi! I'm ready to help you create a new ${getLabelForType(entityType)}. Tell me what you have in mind, or I can suggest some ideas.`,
              suggestions: [`Random ${getLabelForType(entityType)}`, `Suggest a unique ${getLabelForType(entityType)}`, `I have a specific idea`],
              timestamp: Date.now()
          }]);
      }
  }, []);

  const getLabelForType = (type: string) => {
      switch(type) {
          case 'npc': return 'NPC';
          case 'location': return 'Location';
          case 'faction': return 'Faction';
          case 'item': return 'Item';
          case 'adventure': return 'Adventure';
          case 'article': return 'Article';
          case 'scene': return 'Scene';
          default: return 'Entity';
      }
  }

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

    // Construct current draft object to send to AI so it knows the current state
    const currentDraft: DraftEntity = {
        id: draftId,
        type: entityType,
        status: 'draft',
        data: draftData
    };

    const context = `${campaignContext || ''}\nUser is using the "Create via Chat" tool for a specific ${entityType}.`;

    try {
      const response = await chatWithRealmWeaver(
        [...history, newUserMsg],
        [currentDraft],
        [], // No approved log needed for focused session
        context,
        'medium', // Use Flash for reasonable speed/quality balance
        isMockMode,
        entityType
      );

      // Component may have unmounted (e.g. user navigated away) while this request was in flight.
      if (!isMountedRef.current) return;

      const newAiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: response.message,
        suggestions: response.suggestions,
        timestamp: Date.now()
      };

      setHistory(prev => [...prev, newAiMsg]);

      // Update local draft if the AI returned an update for our ID
      const updatedDraft = response.draftEntities.find(d => d.id === draftId && d.type === entityType);
      if (updatedDraft) {
          setDraftData((prev: any) => ({ ...prev, ...updatedDraft.data }));
      }

    } catch (error) {
      if (!isMountedRef.current) return;
      console.error(error);
      setHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Sorry, I encountered an error talking to the Weave.", timestamp: Date.now() }]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleDraftUpdate = (newData: any) => {
      setDraftData((prev: any) => ({ ...prev, ...newData }));
  };

  const handleFinalize = () => {
      if (isFinalizing) return;
      setIsFinalizing(true);
      onEntityCreated(draftData);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
            {/* Chat Column */}
            <div className="w-1/3 flex flex-col border-r border-slate-800 min-w-[300px] bg-slate-950/30">
                <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
                    <Icons.Chat className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-slate-200">Chat Assistant</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {history.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                             <div className={twMerge(
                                "max-w-[90%] p-3 rounded-lg text-sm whitespace-pre-wrap",
                                msg.role === 'user' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'
                             )}>
                                {msg.text}
                            </div>
                            {msg.suggestions && msg.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {msg.suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(s)}
                                            disabled={isLoading}
                                            className="text-xs bg-slate-800 border border-amber-500/30 text-amber-300 px-2 py-1 rounded-full hover:bg-amber-900/50 transition-colors text-left"
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

                <div className="p-3 border-t border-slate-800 bg-slate-900 space-y-2">
                    {/* Prompt chips */}
                    {promptChips && promptChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {promptChips.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(chip)}
                                    disabled={isLoading}
                                    className="text-xs bg-amber-900/40 border border-amber-700/50 text-amber-300 px-2.5 py-1 rounded-full hover:bg-amber-800/50 hover:border-amber-600/70 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[28px]"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-slate-200 placeholder:text-slate-500"
                            disabled={isLoading}
                        />
                        <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="sm">
                            <Icons.Combat className="w-4 h-4 rotate-90" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Preview Column */}
            <div className="w-2/3 flex flex-col bg-slate-900">
                 <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <Icons.Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-slate-200">Live Preview</span>
                    </div>
                    <Button size="sm" onClick={handleFinalize} disabled={isFinalizing} className="bg-green-600 hover:bg-green-500">
                        <Icons.CheckCircle className="w-4 h-4 mr-2" /> Create Entity
                    </Button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                     {renderPreview(draftData, handleDraftUpdate)}
                </div>
            </div>
        </div>
    </div>
  );
};
