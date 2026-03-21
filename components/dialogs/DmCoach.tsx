
import React, { useState } from 'react';
import { X, Clipboard, Check } from 'lucide-react';
import type { Campaign, RollableTable, RollableTableEntry } from '../../types/index';
import { generateNarration, generateImprovisation, generateRollableTable } from '../../services/geminiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { MentionInput, buildMentionedEntityContext } from '../common/MentionInput';
import { twMerge } from 'tailwind-merge';

type CoachTool = 'narrate' | 'improvise' | 'table';

interface DmCoachProps {
  campaign: Campaign;
  activeContext?: string;
  onClose: () => void;
  onSendToNotes?: (content: string) => void;
  isMockMode: boolean;
}

export const DmCoach: React.FC<DmCoachProps> = ({ campaign, activeContext, onClose, onSendToNotes, isMockMode }) => {
    const [activeTool, setActiveTool] = useState<CoachTool>('narrate');
    const [prompt, setPrompt] = useState('');
    const [mentionedEntityIds, setMentionedEntityIds] = useState<string[]>([]);
    const [result, setResult] = useState<string | RollableTable | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useLiteModel, setUseLiteModel] = useState(false);

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

    const currentTool = toolConfig[activeTool];

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        const entityContext = buildMentionedEntityContext(mentionedEntityIds);
        const campaignContext = `Campaign Title: ${campaign.title}\nSetting: ${campaign.setting}\n\n${activeContext || ''}${entityContext}`;

        try {
            const resultData = await currentTool.action(prompt, campaignContext, useLiteModel, isMockMode);
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

    return (
        <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-slate-900/80 backdrop-blur-md border-l border-slate-800 z-10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Icons.Coach className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-lg font-bold font-serif">Session Weaver</h2>
                </div>
                 <div className="flex items-center gap-3">
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
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="p-4 flex-shrink-0">
                 <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
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
                </div>
            </div>

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
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <><Icons.Coach className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                        ) : (
                            <><currentTool.icon className="w-4 h-4 mr-2" /> Generate</>
                        )}
                    </Button>
                </div>
                
                {result && (
                    <div className="mt-6">
                        {typeof result === 'string' ? (
                            <TextResultDisplay text={result} onSendToNotes={onSendToNotes} toolLabel={currentTool.title} />
                        ) : (
                            <RollableTableDisplay table={result} onSendToNotes={onSendToNotes} />
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
};

// --- Sub-components for DMCoach ---

const TextResultDisplay = ({ text, onSendToNotes, toolLabel }: { text: string; onSendToNotes?: (content: string) => void; toolLabel?: string }) => {
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
                        {hasSent ? <Check className="w-4 h-4 text-green-400" /> : <Icons.FileText className="w-4 h-4" />}
                    </button>
                )}
                <button
                    onClick={handleCopyToClipboard}
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    aria-label="Copy to clipboard"
                >
                    {hasCopied ? <Check className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                </button>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
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
                        {hasSent ? <Check className="w-4 h-4" /> : <Icons.FileText className="w-4 h-4" />}
                    </Button>
                )}
            </div>
            {rollResult && (
                <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-center animate-in fade-in duration-300">
                    <p className="text-sm text-slate-400">You rolled a <span className="font-bold text-2xl text-white mx-1">{rollResult.roll}</span></p>
                    <p className="mt-2 text-md text-indigo-200">{rollResult.result}</p>
                </div>
            )}
        </div>
    );
};


const ToolButton = ({ label, icon: Icon, isActive, onClick }: { label: string; icon: React.ElementType, isActive: boolean; onClick: () => void; }) => (
    <button 
        onClick={onClick}
        className={twMerge(
            'flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
        )}
    >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
    </button>
)
