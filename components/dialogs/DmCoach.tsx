
import React, { useState, useRef, useEffect } from 'react';
import type { Campaign, NPC, RollableTable, RollableTableEntry } from '../../types/index';
import { generateNarration, generateImprovisation, generateRollableTable, generateNpcRoleplay } from '../../services/aiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { MentionInput, buildMentionedEntityContext } from '../common/MentionInput';
import { LinkedText } from '../common/LinkedText';
import { twMerge } from 'tailwind-merge';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { buildCampaignContext } from '../../services/contextBuilder';

type CoachTool = 'narrate' | 'improvise' | 'table' | 'roleplay';

interface RoleplayMessage {
    id: string;
    role: 'user' | 'npc';
    text: string;
    moodCue?: string;
}

const TEMPLATE_PROMPTS: Record<Exclude<CoachTool, 'roleplay'>, string[]> = {
    narrate: [
        "Describe the party arriving at [location]",
        "Set the scene for a tense negotiation",
        "Paint a vivid picture of the aftermath",
        "Describe the weather and atmosphere",
        "Narrate a dramatic reveal",
    ],
    improvise: [
        "An unexpected NPC interrupts",
        "A complication arises from a past decision",
        "Something goes wrong with the plan",
        "A new clue surfaces unexpectedly",
        "An ally's loyalty is tested",
    ],
    table: [
        "Random tavern encounters",
        "Wilderness travel events",
        "NPC reactions to the party",
        "Loot for a defeated enemy",
        "Urban rumors and gossip",
    ],
};

/**
 * Extract context tokens from the activeContext string for chip substitution.
 * Looks for "Current Location: <name>." and the first NPC in "NPCs Present: <name> ...".
 */
function extractContextTokens(activeContext?: string): { locationName?: string; npcName?: string } {
    if (!activeContext) return {};
    const locationMatch = activeContext.match(/Current Location:\s*([^.\n]+)/);
    const npcMatch = activeContext.match(/NPCs Present:\s*([^(\n,;]+)/);
    return {
        locationName: locationMatch ? locationMatch[1].trim() : undefined,
        npcName: npcMatch ? npcMatch[1].trim() : undefined,
    };
}

function resolveChipLabel(label: string, tokens: { locationName?: string; npcName?: string }): string {
    let resolved = label;
    if (tokens.locationName) {
        resolved = resolved.replace('[location]', tokens.locationName);
    }
    if (tokens.npcName) {
        resolved = resolved.replace('[NPC]', tokens.npcName);
    }
    return resolved;
}

interface DmCoachProps {
  campaign: Campaign;
  activeContext?: string;
  onClose: () => void;
  onSendToNotes?: (content: string) => void;
  isMockMode: boolean;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const DmCoach: React.FC<DmCoachProps> = ({ campaign, activeContext, onClose, onSendToNotes, isMockMode, onNavigate }) => {
    const [activeTool, setActiveTool] = useState<CoachTool>('narrate');
    const [prompt, setPrompt] = useState('');
    const [mentionedEntityIds, setMentionedEntityIds] = useState<string[]>([]);
    const [result, setResult] = useState<string | RollableTable | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useLiteModel, setUseLiteModel] = useState(false);

    // Roleplay state
    const [selectedNpcId, setSelectedNpcId] = useState<string>('');
    const [roleplayMessages, setRoleplayMessages] = useState<RoleplayMessage[]>([]);
    const [roleplayInput, setRoleplayInput] = useState('');
    const [roleplayLoading, setRoleplayLoading] = useState(false);
    const [roleplayError, setRoleplayError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTool === 'roleplay' && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [roleplayMessages, activeTool]);

    const contextTokens = extractContextTokens(activeContext);
    const chips = activeTool !== 'roleplay'
        ? TEMPLATE_PROMPTS[activeTool].map(label => resolveChipLabel(label, contextTokens))
        : [];

    const toolConfig = {
        narrate: {
            title: "Narrator",
            description: "Describe a situation, and the AI will generate evocative text to read aloud.",
            placeholder: "e.g., Describe the tavern as the players enter for the first time.",
            action: generateNarration,
            icon: Icons.Scenes,
        },
        improvise: {
            title: "Improviser",
            description: "Explain what the players did, and the AI will suggest consequences.",
            placeholder: "e.g., The players decided to threaten the mayor instead of helping him. What happens?",
            action: generateImprovisation,
            icon: Icons.Sparkles,
        },
        table: {
            title: "Rollable Table",
            description: "Describe a scenario, and the AI will generate a custom rollable table.",
            placeholder: "e.g., A d6 table for random encounters in a spooky forest.",
            action: generateRollableTable,
            icon: Icons.Dice,
        }
    }

    const currentTool = activeTool !== 'roleplay' ? toolConfig[activeTool] : null;

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        const entityContext = buildMentionedEntityContext(mentionedEntityIds);
        // Build tiered campaign context then append live session context and @mention details.
        const baseContext = buildCampaignContext({
          variant: 'coach',
          campaign,
          activeSceneId: campaign.activeSceneId,
          activeSessionId: campaign.activeSessionId,
          // Leave some budget for activeContext and entityContext (~800 tokens)
          maxTokenEstimate: 3200,
        });
        const campaignContext = `${baseContext}\n\n${activeContext || ''}${entityContext}`;

        try {
            const resultData = await currentTool!.action(prompt, campaignContext, useLiteModel, isMockMode);
            setResult(resultData);
        } catch (err) {
            setError('Failed to get a response from the AI. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchTool = (tool: CoachTool) => {
        setActiveTool(tool);
        setPrompt('');
        setMentionedEntityIds([]);
        setResult(null);
        setError(null);
    }

    // --- Roleplay handlers ---

    const selectedNpc: NPC | undefined = campaign.npcs.find(n => n.id === selectedNpcId);

    const buildNpcContext = (npc: NPC): string => {
        const faction = npc.factionId
            ? campaign.factions.find(f => f.id === npc.factionId)
            : undefined;
        return [
            `Name: ${npc.name}`,
            npc.description ? `Description: ${npc.description}` : '',
            npc.traits ? `Traits: ${npc.traits}` : '',
            npc.motivations ? `Motivations: ${npc.motivations}` : '',
            npc.secrets ? `Secrets (known to the NPC, not easily revealed): ${npc.secrets}` : '',
            npc.exampleQuote ? `Example Quote: "${npc.exampleQuote}"` : '',
            faction ? `Faction: ${faction.name}` : '',
            npc.backstory ? `Backstory: ${npc.backstory}` : '',
        ].filter(Boolean).join('\n');
    };

    const handleRoleplaySend = async () => {
        if (!roleplayInput.trim() || !selectedNpc) return;

        const userMessage = roleplayInput.trim();
        setRoleplayInput('');
        setRoleplayLoading(true);
        setRoleplayError(null);

        const newUserMsg: RoleplayMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: userMessage,
        };
        setRoleplayMessages(prev => [...prev, newUserMsg]);

        const historyForAi = roleplayMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'npc',
            text: m.text,
        }));

        const npcContext = buildNpcContext(selectedNpc);
        const campaignContext = buildCampaignContext({
          variant: 'coach',
          campaign,
          activeSceneId: campaign.activeSceneId,
          activeSessionId: campaign.activeSessionId,
          maxTokenEstimate: 2000,
        });

        try {
            const response = await generateNpcRoleplay(
                npcContext,
                historyForAi,
                userMessage,
                isMockMode,
                campaignContext
            );

            const npcMsg: RoleplayMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'npc',
                text: response.dialogue,
                moodCue: response.moodCue,
            };
            setRoleplayMessages(prev => [...prev, npcMsg]);
        } catch (err) {
            setRoleplayError('Failed to get a response. Please try again.');
            console.error(err);
            // Remove the user message we optimistically added
            setRoleplayMessages(prev => prev.filter(m => m.id !== newUserMsg.id));
        } finally {
            setRoleplayLoading(false);
        }
    };

    const handleRoleplayKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !roleplayLoading) {
            e.preventDefault();
            handleRoleplaySend();
        }
    };

    const handleClearConversation = () => {
        setRoleplayMessages([]);
        setRoleplayError(null);
    };

    const handleSendConversationToNotes = () => {
        if (!onSendToNotes || roleplayMessages.length === 0 || !selectedNpc) return;
        const lines = roleplayMessages.map(m => {
            if (m.role === 'user') return `Player: ${m.text}`;
            const mood = m.moodCue ? `[${m.moodCue}]\n` : '';
            return `${selectedNpc.name}: ${mood}${m.text}`;
        });
        onSendToNotes(`[Roleplay — ${selectedNpc.name}]\n${lines.join('\n\n')}`);
    };

    return (
        <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-900/80 backdrop-blur-md border-l border-slate-800 z-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Icons.Coach className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-lg font-bold font-serif">Session Weaver</h2>
                </div>
                 <div className="flex items-center gap-3">
                    {activeTool !== 'roleplay' && (
                        <>
                            <span className={`text-xs font-medium ${useLiteModel ? 'text-green-400' : 'text-slate-500'}`}>
                                Low-Latency
                            </span>
                            <button
                                onClick={() => setUseLiteModel(p => !p)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                    useLiteModel ? 'bg-green-600' : 'bg-slate-700'
                                }`}
                                role="switch"
                                aria-checked={useLiteModel}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        useLiteModel ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <Icons.X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="p-4 flex-shrink-0">
                 <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <ToolButton
                        label="Narrate"
                        icon={Icons.Scenes}
                        isActive={activeTool === 'narrate'}
                        onClick={() => handleSwitchTool('narrate')}
                    />
                    <ToolButton
                        label="Improvise"
                        icon={Icons.Sparkles}
                        isActive={activeTool === 'improvise'}
                        onClick={() => handleSwitchTool('improvise')}
                    />
                     <ToolButton
                        label="Table"
                        icon={Icons.Dice}
                        isActive={activeTool === 'table'}
                        onClick={() => handleSwitchTool('table')}
                    />
                    <ToolButton
                        label="Roleplay"
                        icon={Icons.Roleplay}
                        isActive={activeTool === 'roleplay'}
                        onClick={() => handleSwitchTool('roleplay')}
                    />
                </div>
            </div>

            {activeTool === 'roleplay' ? (
                <RoleplayPanel
                    campaign={campaign}
                    selectedNpcId={selectedNpcId}
                    onSelectNpc={(id) => {
                        setSelectedNpcId(id);
                        setRoleplayMessages([]);
                        setRoleplayError(null);
                    }}
                    selectedNpc={selectedNpc}
                    messages={roleplayMessages}
                    input={roleplayInput}
                    onInputChange={setRoleplayInput}
                    onSend={handleRoleplaySend}
                    onKeyDown={handleRoleplayKeyDown}
                    isLoading={roleplayLoading}
                    error={roleplayError}
                    onClear={handleClearConversation}
                    onSendToNotes={onSendToNotes ? handleSendConversationToNotes : undefined}
                    messagesEndRef={messagesEndRef}
                />
            ) : currentTool && (
                <div className="flex-1 flex flex-col p-4 pt-0 overflow-y-auto custom-scrollbar">
                    {/* Active Context Hint */}
                    {activeContext && (
                         <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs text-indigo-300">
                            <span className="font-bold uppercase tracking-wider block mb-1">Active Context:</span>
                            <span className="line-clamp-3">{activeContext.split('\n').filter(line => !line.startsWith('Campaign:') && !line.startsWith('Setting:')).join(' ')}</span>
                         </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-md font-semibold font-serif text-slate-200">{currentTool.title}</h3>
                            <p className="text-sm text-slate-400">{currentTool.description}</p>
                        </div>
                        <MentionInput
                            value={prompt}
                            onChange={setPrompt}
                            onMentionedIdsChange={setMentionedEntityIds}
                            placeholder={currentTool.placeholder}
                            rows={5}
                            disabled={isLoading}
                            aria-label="DM Coach prompt"
                            textareaClassName="bg-slate-950 border-slate-700 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-slate-600"
                        />
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" aria-label="Prompt suggestions">
                            {chips.map((chip) => (
                                <button
                                    key={chip}
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => setPrompt(chip)}
                                    className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                        {error && <p className="text-xs text-red-400">{error}</p>}
                        <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                            {isLoading ? (
                                <><Icons.Coach className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                            ) : (
                                <ActiveToolIcon tool={currentTool} />
                            )}
                        </Button>
                    </div>

                    {result && (
                        <div className="mt-6">
                            {typeof result === 'string' ? (
                                <TextResultDisplay text={result} onSendToNotes={onSendToNotes} toolLabel={currentTool.title} onNavigate={onNavigate} />
                            ) : (
                                <RollableTableDisplay table={result} onSendToNotes={onSendToNotes} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
};

// --- Roleplay Panel ---

interface RoleplayPanelProps {
    campaign: Campaign;
    selectedNpcId: string;
    onSelectNpc: (id: string) => void;
    selectedNpc: NPC | undefined;
    messages: RoleplayMessage[];
    input: string;
    onInputChange: (v: string) => void;
    onSend: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    error: string | null;
    onClear: () => void;
    onSendToNotes?: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

const RoleplayPanel: React.FC<RoleplayPanelProps> = ({
    campaign,
    selectedNpcId,
    onSelectNpc,
    selectedNpc,
    messages,
    input,
    onInputChange,
    onSend,
    onKeyDown,
    isLoading,
    error,
    onClear,
    onSendToNotes,
    messagesEndRef,
}) => {
    const faction = selectedNpc?.factionId
        ? campaign.factions.find(f => f.id === selectedNpc.factionId)
        : undefined;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* NPC Selector */}
            <div className="px-4 pb-3 flex-shrink-0 space-y-3">
                <div>
                    <label htmlFor="npc-selector" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Select NPC to Roleplay
                    </label>
                    <select
                        id="npc-selector"
                        value={selectedNpcId}
                        onChange={e => onSelectNpc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">— Choose an NPC —</option>
                        {campaign.npcs.map(npc => (
                            <option key={npc.id} value={npc.id}>{npc.name}</option>
                        ))}
                    </select>
                </div>

                {selectedNpc && (
                    <div className="p-3 bg-slate-950 border border-amber-900/40 rounded-md space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-amber-400">{selectedNpc.name}</span>
                            {faction && (
                                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                    {faction.name}
                                </span>
                            )}
                        </div>
                        {selectedNpc.traits && (
                            <p className="text-xs text-slate-400 line-clamp-2">
                                <span className="text-slate-500">Traits: </span>{selectedNpc.traits}
                            </p>
                        )}
                        {selectedNpc.motivations && (
                            <p className="text-xs text-slate-400 line-clamp-1">
                                <span className="text-slate-500">Wants: </span>{selectedNpc.motivations}
                            </p>
                        )}
                        {selectedNpc.exampleQuote && (
                            <p className="text-xs text-slate-500 italic line-clamp-1">
                                "{selectedNpc.exampleQuote}"
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Conversation area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-2 space-y-3 min-h-0">
                {!selectedNpc && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-8 gap-3">
                        <Icons.Roleplay className="w-10 h-10 text-slate-700" />
                        <p className="text-sm">Select an NPC above to begin a roleplay session.<br />The AI will speak in their voice.</p>
                    </div>
                )}

                {selectedNpc && messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-8 gap-2">
                        <p className="text-sm">Start the conversation below.<br /><span className="text-amber-600 font-medium">{selectedNpc.name}</span> is ready.</p>
                    </div>
                )}

                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={twMerge(
                            'flex flex-col max-w-[85%]',
                            msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                        )}
                    >
                        {msg.role === 'npc' && msg.moodCue && (
                            <p className="text-xs text-slate-500 italic mb-1 px-1">
                                {msg.moodCue}
                            </p>
                        )}
                        <div
                            className={twMerge(
                                'px-3 py-2 rounded-lg text-sm leading-relaxed',
                                msg.role === 'user'
                                    ? 'bg-slate-700 text-slate-200 rounded-br-sm'
                                    : 'bg-amber-950/60 border border-amber-800/40 text-amber-100 rounded-bl-sm'
                            )}
                        >
                            {msg.text}
                        </div>
                        {msg.role === 'npc' && selectedNpc && (
                            <span className="text-xs text-slate-600 mt-1 px-1">{selectedNpc.name}</span>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-start gap-2 mr-auto">
                        <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/30 text-amber-400">
                            <Icons.Loader className="w-4 h-4 animate-spin" />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-xs text-red-400 text-center py-1">{error}</p>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-4 pt-2 pb-4 flex-shrink-0 border-t border-slate-800 space-y-2">
                {messages.length > 0 && (
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={onClear}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            title="Clear conversation"
                        >
                            Clear
                        </button>
                        {onSendToNotes && (
                            <button
                                onClick={onSendToNotes}
                                className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
                                title="Send conversation to session notes"
                            >
                                <Icons.FileText className="w-3 h-3" />
                                Send to Notes
                            </button>
                        )}
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={selectedNpc ? `Say something to ${selectedNpc.name}...` : 'Select an NPC first'}
                        disabled={!selectedNpc || isLoading}
                        className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Roleplay message input"
                    />
                    <button
                        onClick={onSend}
                        disabled={!selectedNpc || isLoading || !input.trim()}
                        className="flex-shrink-0 p-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Send message"
                        title="Send (Enter)"
                    >
                        <Icons.Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components for DMCoach ---

const TextResultDisplay = ({ text, onSendToNotes, toolLabel, onNavigate }: { text: string; onSendToNotes?: (content: string) => void; toolLabel?: string; onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void }) => {
    const [hasCopied, setHasCopied] = useState(false);
    const [hasSent, setHasSent] = useState(false);

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(text);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    const handleSendToNotes = () => {
        if (!onSendToNotes) return;
        const prefix = toolLabel ? `[${toolLabel}] ` : '[Coach] ';
        onSendToNotes(prefix + text);
        setHasSent(true);
        setTimeout(() => setHasSent(false), 2000);
    };

    return (
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 relative">
            <div className="absolute top-2 right-2 flex gap-1">
                {onSendToNotes && (
                    <button
                        onClick={handleSendToNotes}
                        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        aria-label="Send to session notes"
                        title="Send to session notes"
                    >
                        {hasSent ? <Icons.Check className="w-4 h-4 text-green-400" /> : <Icons.FileText className="w-4 h-4" />}
                    </button>
                )}
                <button
                    onClick={handleCopyToClipboard}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    aria-label="Copy to clipboard"
                >
                    {hasCopied ? <Icons.Check className="w-4 h-4 text-green-400" /> : <Icons.Clipboard className="w-4 h-4" />}
                </button>
            </div>
            {onNavigate ? (
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    <LinkedText text={text} onNavigate={onNavigate} />
                </p>
            ) : (
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
            )}
        </div>
    );
};

const RollableTableDisplay = ({ table, onSendToNotes }: { table: RollableTable; onSendToNotes?: (content: string) => void }) => {
    const [rollResult, setRollResult] = useState<{ roll: number; result: string } | null>(null);
    const [hasSent, setHasSent] = useState(false);

    const handleRoll = () => {
        const die = table.dieType.toLowerCase();
        if (!die.startsWith('d')) return;

        const maxRoll = parseInt(die.slice(1), 10);
        if (isNaN(maxRoll)) return;

        const roll = Math.floor(Math.random() * maxRoll) + 1;

        const findResult = (r: number, entries: RollableTableEntry[]): string => {
            for (const entry of entries) {
                const parts = entry.range.split('-').map(p => parseInt(p.trim(), 10));
                if (parts.length === 1 && r === parts[0]) return entry.result;
                if (parts.length === 2 && r >= parts[0] && r <= parts[1]) return entry.result;
            }
            return "No result found for this roll.";
        }

        setRollResult({ roll, result: findResult(roll, table.entries) });
    };

    return (
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
            <h4 className="text-md font-semibold text-slate-200 font-serif">{table.title}</h4>
            <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-700">
                    <tr>
                        <th className="p-2 w-24 text-slate-400 font-medium">Roll ({table.dieType})</th>
                        <th className="p-2 text-slate-400 font-medium">Result</th>
                    </tr>
                </thead>
                <tbody>
                    {table.entries.map((entry, index) => (
                        <tr key={index} className="border-b border-slate-800">
                            <td className="p-2 align-top font-mono text-center">{entry.range}</td>
                            <td className="p-2 align-top text-slate-300">{entry.result}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="pt-2 flex gap-2">
                <Button onClick={handleRoll} className="flex-1">
                    <Icons.Dice className="w-4 h-4 mr-2" />
                    Roll on Table
                </Button>
                {onSendToNotes && (
                    <Button
                        variant="secondary"
                        onClick={() => {
                            const tableText = `[Table] ${table.title} (${table.dieType}): ${table.entries.map(e => `${e.range}. ${e.result}`).join('; ')}`;
                            onSendToNotes(tableText);
                            setHasSent(true);
                            setTimeout(() => setHasSent(false), 2000);
                        }}
                        title="Send to session notes"
                    >
                        {hasSent ? <Icons.Check className="w-4 h-4" /> : <Icons.FileText className="w-4 h-4" />}
                    </Button>
                )}
            </div>
            {rollResult && (
                <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-center animate-fade-in">
                    <p className="text-sm text-slate-400">You rolled a <span className="font-bold text-2xl text-white mx-1">{rollResult.roll}</span></p>
                    <p className="mt-2 text-md text-indigo-200">{rollResult.result}</p>
                </div>
            )}
        </div>
    );
};


const ActiveToolIcon = ({ tool }: { tool: { icon: React.ElementType } }) => {
    const Icon = tool.icon;
    return <><Icon className="w-4 h-4 mr-2" /> Generate</>;
};

const ToolButton = ({ label, icon: Icon, isActive, onClick }: { label: string; icon: React.ElementType, isActive: boolean; onClick: () => void; }) => (
    <button
        onClick={onClick}
        className={twMerge(
            'flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md transition-colors',
            isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
        )}
    >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
    </button>
)
