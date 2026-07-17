
import React, { useState, useEffect, useRef } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { SessionLog, SessionLogEntry, Campaign } from '../../types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { Icons, SceneIcon } from '../common/Icons';
import { Button } from '../common/Button';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { EntityLink } from '../common/EntityLink';
import { campaignService } from '../../services/campaignService';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText, analyzeSessionNotes } from '../../services/aiService';
import { twMerge } from 'tailwind-merge';
import { startAudioTranscription } from '../../services/ai/audioTranscription';
import type { AudioTranscriptionSession } from '../../services/ai/audioTranscription';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';

interface SessionLogEditorProps {
  log: SessionLog;
  campaign: Campaign;
  onUpdate: (id: string, updatedData: Partial<SessionLog>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  onGoLive?: (sessionLogId: string) => void;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// Audio Context & Processor Types for TypeScript
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export const SessionLogEditor: React.FC<SessionLogEditorProps> = ({ log, campaign, onUpdate, onDelete, isMockMode, onGoLive, onNavigate }) => {
  const [formData, setFormData] = useState(log);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'structured' | 'scratchpad'>('structured');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const { confirm } = useConfirmDialog();
  const { addToast } = useToast();

  // Live API State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Ref for the active audio transcription session returned by the service module.
  const audioSessionRef = useRef<AudioTranscriptionSession | null>(null);

  // Transcript file import state
  const [isImportingTranscript, setIsImportingTranscript] = useState(false);
  const transcriptFileInputRef = useRef<HTMLInputElement | null>(null);

  const activePlots = campaign.plots.filter(p => p.status === 'active');

  // Tracks the last `log` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevLogRef = useRef(log);

  useEffect(() => {
    const prevLog = prevLogRef.current;
    if (prevLog !== log) {
      setFormData(prev => reconcileEntityFormData(prev, prevLog, log));
    }
    prevLogRef.current = log;
  }, [log]);

  // Clean up the audio transcription session on unmount
  useEffect(() => {
    return () => {
      if (audioSessionRef.current) {
        audioSessionRef.current.stop().catch(e => {
          console.error('Error stopping audio session on unmount', e);
        });
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof SessionLog] !== log[e.target.name as keyof SessionLog]) {
        onUpdate(log.id, { [e.target.name]: e.target.value });
    }
  };

  const handleSceneToggle = (sceneId: string) => {
      const current = formData.plannedSceneIds || [];
      const updated = current.includes(sceneId) 
        ? current.filter(id => id !== sceneId)
        : [...current, sceneId];
      setFormData(prev => ({...prev, plannedSceneIds: updated}));
      onUpdate(log.id, { plannedSceneIds: updated });
  }

  const handlePlotToggle = (plotId: string) => {
      const current = formData.relatedPlotIds || [];
      const updated = current.includes(plotId)
        ? current.filter(id => id !== plotId)
        : [...current, plotId];
      setFormData(prev => ({...prev, relatedPlotIds: updated}));
      onUpdate(log.id, { relatedPlotIds: updated });
  }

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Session Log', `Are you sure you want to delete the log "${log.title}"? This action cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(log.id);
    }
  }

  const handleStartSession = () => {
      onUpdate(log.id, { status: 'active', sessionDate: new Date().toISOString() });
  }

  const handleEndSession = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ensure we stop recording if active before closing
      if (isLiveConnected) {
          await handleToggleLive();
      }

      const confirmed = await confirm('End Session', 'Are you sure you want to end the session? This will move it to the archive.', { variant: 'danger', confirmLabel: 'End Session' });
      if (confirmed) {
          onUpdate(log.id, { status: 'completed' });
      }
  }

  const handleAiGenerateRecap = async () => {
      setIsGenerating(true);
      const structuredText = (formData.structuredNotes || []).map(n => n.content).join('\n');
      const combinedNotes = `${formData.runningNotes}\n\n${structuredText}`;
      
      const prompt = `Based on the following rough notes taken during the session, write a cohesive narrative recap of the events:\n\n${combinedNotes}`;
      try {
          const recap = await generateEnhancedText(prompt, undefined, isMockMode);
          setFormData(prev => ({...prev, recap}));
          onUpdate(log.id, { recap });
      } finally {
          setIsGenerating(false);
      }
  }

  // --- Live API Integration ---
  const handleToggleLive = async () => {
    if (isLiveConnected) {
      // Stop the session — the service module owns teardown of mic + audio context.
      if (audioSessionRef.current) {
        await audioSessionRef.current.stop();
        audioSessionRef.current = null;
      }
      setIsLiveConnected(false);

      // Flush accumulated transcript into running notes.
      if (liveTranscript) {
        const newNotes = (formData.runningNotes ? formData.runningNotes + '\n\n' : '') + `[AI Scribe]: ${liveTranscript}`;
        setFormData(prev => ({ ...prev, runningNotes: newNotes }));
        onUpdate(log.id, { runningNotes: newNotes });
        setLiveTranscript('');
      }
      return;
    }

    // Start a new session via the service module.
    try {
      const session = await startAudioTranscription({
        gcpApiKey: campaign.gcpApiKey!,
        onTranscript: (text) => setLiveTranscript(prev => prev + text),
        onConnected: () => setIsLiveConnected(true),
        onDisconnected: () => setIsLiveConnected(false),
        onError: (err) => console.error('Gemini Live Error', err),
      });
      audioSessionRef.current = session;
    } catch (err) {
      console.error('Failed to start Live session', err);
      setIsLiveConnected(false);
      addToast('Could not connect to AI service. Please check your GCP API key in Campaign Settings and try again.', 'error');
    }
  };

  // --- Transcript File Import ---
  const parseVtt = (content: string): string => {
    const lines = content.split('\n');
    const textLines: string[] = [];
    // VTT lines that are timestamps look like "00:00:01.000 --> 00:00:04.000"
    const timestampRe = /^\d{2}:\d{2}[\d:.]+\s+-->\s+\d{2}:\d{2}/;
    let skipNext = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'WEBVTT' || trimmed === '') {
        continue;
      }
      // Skip cue identifier lines (pure numeric or alphanumeric id before a timestamp block)
      if (timestampRe.test(trimmed)) {
        skipNext = false; // The next line(s) are cue text
        continue;
      }
      // Skip NOTE / STYLE / REGION blocks
      if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) {
        skipNext = true;
        continue;
      }
      if (skipNext) continue;
      textLines.push(trimmed);
    }
    return textLines.join(' ').trim();
  };

  const handleTranscriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-imported if needed.
    e.target.value = '';

    setIsImportingTranscript(true);
    try {
      let text = '';

      if (file.name.endsWith('.docx')) {
        setIsImportingTranscript(false);
        addToast('DOCX files are not yet supported. Please export as .txt or .md and try again.', 'error');
        return;
      } else if (file.name.endsWith('.vtt')) {
        const raw = await file.text();
        text = parseVtt(raw);
      } else {
        // .txt
        text = await file.text();
      }

      if (!text.trim()) return;

      const prefix = formData.runningNotes ? formData.runningNotes + '\n\n' : '';
      const newNotes = prefix + `[Imported transcript — ${file.name}]:\n${text}`;
      setFormData(prev => ({ ...prev, runningNotes: newNotes }));
      onUpdate(log.id, { runningNotes: newNotes });
      // Switch to scratchpad so the user sees the imported content immediately.
      setActiveTab('scratchpad');
    } catch (err) {
      console.error('Transcript import failed', err);
      addToast('Failed to read the transcript file. See console for details.', 'error');
    } finally {
      setIsImportingTranscript(false);
    }
  };


  // --- Structured Note Handlers ---
  const handleAddNote = () => {
      if (!newNoteContent.trim()) return;
      const newEntry: SessionLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          content: newNoteContent,
          taggedEntityIds: newNoteTags
      };
      const updatedNotes = [...(formData.structuredNotes || []), newEntry];
      setFormData(prev => ({...prev, structuredNotes: updatedNotes}));
      onUpdate(log.id, { structuredNotes: updatedNotes });
      setNewNoteContent('');
      setNewNoteTags([]);
  };

  const toggleNoteTag = (entityId: string) => {
      setNewNoteTags(prev => prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]);
  }

  const removeNote = (noteId: string) => {
      const updatedNotes = (formData.structuredNotes || []).filter(n => n.id !== noteId);
      setFormData(prev => ({...prev, structuredNotes: updatedNotes}));
      onUpdate(log.id, { structuredNotes: updatedNotes });
  }

  // --- Derived Data ---
  const activeAdventure = campaign.adventures.find(a => a.id === formData.adventureId);
  const possibleTags = [
      ...campaign.npcs.map(n => ({ id: n.id, name: n.name, type: 'NPC' })),
      ...campaign.locations.map(l => ({ id: l.id, name: l.name, type: 'Location' })),
      ...campaign.factions.map(f => ({ id: f.id, name: f.name, type: 'Faction' })),
      ...campaign.items.map(i => ({ id: i.id, name: i.name, type: 'Item' }))
  ];

  const getEntityName = (id: string) => possibleTags.find(t => t.id === id)?.name || 'Unknown Entity';

  const handleAnalyzeNotes = async () => {
    if (!formData.runningNotes.trim()) return;
    setIsGenerating(true);
    try {
        const knownNames = possibleTags.map(t => t.name);
        const context = `Campaign: ${campaign.title}\nSetting: ${campaign.setting}`;
        
        const result = await analyzeSessionNotes(formData.runningNotes, knownNames, context, isMockMode);
        
        const newEntries: SessionLogEntry[] = result.entries.map(entry => {
             const matchedIds = entry.relatedEntityNames.map(name => {
                const tag = possibleTags.find(t => t.name.toLowerCase() === name.toLowerCase());
                return tag ? tag.id : null;
             }).filter((id): id is string => id !== null);
             
             const uniqueIds = Array.from(new Set(matchedIds));

             return {
                 id: crypto.randomUUID(),
                 timestamp: new Date().toISOString(),
                 content: entry.content,
                 taggedEntityIds: uniqueIds
             };
        });
        
        if (newEntries.length > 0) {
            const updatedNotes = [...(formData.structuredNotes || []), ...newEntries];
            setFormData(prev => ({...prev, structuredNotes: updatedNotes}));
            onUpdate(log.id, { structuredNotes: updatedNotes });
            setActiveTab('structured');
        }
    } catch (e) {
        console.error("Analysis failed", e);
        addToast("Failed to analyze notes. See console.", 'error');
    } finally {
        setIsGenerating(false);
    }
}

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-hidden animate-fade-in">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-6 flex-shrink-0">
        <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Icons.SessionLog className={`w-8 h-8 ${formData.status === 'active' ? 'text-green-400' : 'text-amber-400'}`} />
              <div>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="bg-transparent text-3xl font-bold font-serif text-slate-100 outline-none focus:border-b border-amber-500 placeholder:text-slate-600 w-full"
                  />
                  <div className="flex items-center gap-3 text-xs">
                      <span className={`uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          formData.status === 'active' ? 'bg-green-900 text-green-300' : 
                          formData.status === 'planned' ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                          {formData.status === 'active' ? 'Session Active' : formData.status}
                      </span>
                      <input
                        type="date"
                        name="sessionDate"
                        value={new Date(formData.sessionDate).toISOString().split('T')[0]}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({...prev, sessionDate: val}));
                            onUpdate(log.id, { sessionDate: val });
                        }}
                        className="bg-transparent text-slate-400 outline-none hover:text-white focus:text-white transition-colors"
                      />
                  </div>
              </div>
            </div>
        </div>
        <div className="flex gap-2 items-center">
            {formData.status === 'active' && (
                <div className="mr-4 flex items-center gap-2">
                    {/* AI Scribe button — only shown when a GCP API key is configured */}
                    {campaign.gcpApiKey ? (
                        <Button
                            onClick={handleToggleLive}
                            size="sm"
                            className={isLiveConnected ? "bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500/30" : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"}
                        >
                            {isLiveConnected ? (
                                <><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" /> Stop Scribe</>
                            ) : (
                                <><Icons.Mic className="w-4 h-4 mr-2" /> Enable AI Scribe</>
                            )}
                        </Button>
                    ) : (
                        <span className="text-xs text-slate-500 italic" title="Add a GCP API key in Campaign Settings to enable real-time transcription">
                            AI Scribe (key required)
                        </span>
                    )}

                    {/* Transcript file import */}
                    <input
                        ref={transcriptFileInputRef}
                        type="file"
                        accept=".txt,.vtt"
                        className="hidden"
                        onChange={handleTranscriptFileChange}
                    />
                    <Button
                        size="sm"
                        onClick={() => transcriptFileInputRef.current?.click()}
                        disabled={isImportingTranscript}
                        className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                        title="Import transcript (.txt, .vtt, .docx)"
                    >
                        {isImportingTranscript ? (
                            <Icons.Loader className="w-4 h-4 animate-spin" />
                        ) : (
                            <Icons.FileUp className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            )}

            {formData.status === 'planned' && (
                <>
                    {/* Pre-flight Checklist */}
                    <div className="flex items-center gap-3 mr-4">
                        <div className="flex items-center gap-1.5 text-xs">
                            {formData.adventureId ? (
                                <Icons.CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                                <Icons.Help className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span className={formData.adventureId ? 'text-green-400' : 'text-amber-400'}>Adventure</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            {(formData.plannedSceneIds?.length || 0) > 0 ? (
                                <Icons.CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                                <Icons.Help className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span className={(formData.plannedSceneIds?.length || 0) > 0 ? 'text-green-400' : 'text-amber-400'}>
                                Scenes ({formData.plannedSceneIds?.length || 0})
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            {(formData.relatedPlotIds?.length || 0) > 0 ? (
                                <Icons.CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                                <Icons.Help className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span className={(formData.relatedPlotIds?.length || 0) > 0 ? 'text-green-400' : 'text-slate-500'}>
                                Plots
                            </span>
                        </div>
                    </div>

                    <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20">
                        <Icons.Play className="w-4 h-4 mr-2" /> Start Session
                    </Button>
                    {onGoLive && (
                        <div className="flex flex-col items-center">
                            <Button onClick={() => onGoLive(log.id)} className="bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/40 ring-2 ring-amber-500/20">
                                <Icons.Live className="w-4 h-4 mr-2" /> Go Live
                            </Button>
                            {!formData.adventureId && (
                                <span className="text-xs text-amber-400/70 mt-1">(No adventure linked)</span>
                            )}
                        </div>
                    )}
                </>
            )}
            {formData.status === 'active' && onGoLive && (
                <Button onClick={() => onGoLive(log.id)} className="bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20">
                    <Icons.Live className="w-4 h-4 mr-2" /> Session Runner
                </Button>
            )}
            {formData.status === 'active' && (
                <Button 
                    type="button" 
                    onClick={handleEndSession} 
                    className="bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 cursor-pointer z-10 relative"
                >
                    <Icons.CheckCircle className="w-4 h-4 mr-2" /> End Session
                </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-slate-500 hover:text-red-400">
                <Icons.Trash className="w-4 h-4" />
            </Button>
        </div>
      </header>
      
      <div className="flex-1 flex gap-6 overflow-hidden">
          
          {/* LEFT COLUMN: Planning & Prep */}
          <div className="w-1/3 flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-2">
                
                {/* Adventure & Scene Selection */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Target Adventure</label>
                    <select
                        name="adventureId"
                        value={formData.adventureId || ''}
                        onChange={(e) => {
                            setFormData(prev => ({...prev, adventureId: e.target.value}));
                            onUpdate(log.id, { adventureId: e.target.value });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none mb-2"
                    >
                        <option value="">-- Independent Session --</option>
                        {campaign.adventures.map(adv => (
                            <option key={adv.id} value={adv.id}>{adv.title}</option>
                        ))}
                    </select>
                    {formData.adventureId && onNavigate && (
                        <div className="mb-4 mt-1">
                            <EntityLink
                                entityType="adventure"
                                entityId={formData.adventureId}
                                label={campaign.adventures.find(a => a.id === formData.adventureId)?.title}
                                onNavigate={onNavigate}
                            />
                        </div>
                    )}

                    {activeAdventure && (
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Planned Scenes</label>
                            <div className="space-y-1 bg-slate-950 border border-slate-800 rounded-md p-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {activeAdventure.scenes.map(scene => (
                                    <label key={scene.id} className="flex items-center p-2 rounded hover:bg-slate-900 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.plannedSceneIds?.includes(scene.id)} 
                                            onChange={() => handleSceneToggle(scene.id)}
                                            className="rounded border-slate-600 bg-slate-800 text-amber-600 focus:ring-amber-500 mr-3"
                                        />
                                        <SceneIcon type={scene.type} className="text-slate-500" />
                                        <span className={`text-sm ${formData.plannedSceneIds?.includes(scene.id) ? 'text-amber-300 font-medium' : 'text-slate-400'}`}>
                                            {scene.title}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Plot Arc Integration */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Active Plot Arcs</label>
                    {/* EntityLink chips for checked plots */}
                    {(formData.relatedPlotIds || []).length > 0 && onNavigate && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(formData.relatedPlotIds || []).map(plotId => {
                                const p = campaign.plots.find(pl => pl.id === plotId);
                                return p ? (
                                    <EntityLink
                                        key={plotId}
                                        entityType="plot"
                                        entityId={plotId}
                                        label={p.title}
                                        onNavigate={onNavigate!}
                                    />
                                ) : null;
                            })}
                        </div>
                    )}
                    <div className="space-y-1 bg-slate-950 border border-slate-800 rounded-md p-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {activePlots.length > 0 ? activePlots.map(plot => (
                            <label key={plot.id} className="flex items-center p-2 rounded hover:bg-slate-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.relatedPlotIds?.includes(plot.id)}
                                    onChange={() => handlePlotToggle(plot.id)}
                                    className="rounded border-slate-600 bg-slate-800 text-amber-600 focus:ring-amber-500 mr-3"
                                />
                                <Icons.Plot className="w-4 h-4 text-amber-400 mr-2" />
                                <span className={`text-sm ${formData.relatedPlotIds?.includes(plot.id) ? 'text-amber-300 font-medium' : 'text-slate-400'}`}>
                                    {plot.title}
                                </span>
                            </label>
                        )) : <p className="text-xs text-slate-500 italic p-2">No active plots found.</p>}
                    </div>
                </div>

                {/* Prep Notes */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 flex-grow flex flex-col">
                    <AiTextarea
                        label="Prep Notes (DM Eyes Only)"
                        name="prepNotes"
                        value={formData.prepNotes}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="flex-grow min-h-[200px]"
                        placeholder="Key plot points, NPC motivations, monster tactics, secrets to reveal..."
                        onAiGenerate={() => { /* Prep generation logic */ }}
                    />
                </div>
          </div>

          {/* RIGHT COLUMN: Execution & History */}
          <div className="w-2/3 flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-2">
              
              {/* Notes Tabs */}
              <div className={`flex-grow flex flex-col transition-all ${formData.status === 'active' ? 'bg-amber-900/10 border-amber-500/30' : 'bg-slate-900/50 border-slate-800/50'} p-4 rounded-xl border h-[500px]`}>
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex space-x-4">
                          <button 
                            onClick={() => setActiveTab('structured')}
                            className={twMerge("text-sm font-bold pb-1 border-b-2 transition-colors", activeTab === 'structured' ? "border-amber-500 text-amber-300" : "border-transparent text-slate-500 hover:text-slate-300")}
                          >
                              Log Entries
                          </button>
                          <button 
                            onClick={() => setActiveTab('scratchpad')}
                            className={twMerge("text-sm font-bold pb-1 border-b-2 transition-colors", activeTab === 'scratchpad' ? "border-amber-500 text-amber-300" : "border-transparent text-slate-500 hover:text-slate-300")}
                          >
                              Scratchpad
                          </button>
                      </div>
                      {isLiveConnected && <span className="text-xs text-red-400 animate-pulse flex items-center gap-1">● AI Listening...</span>}
                  </div>

                  {activeTab === 'scratchpad' ? (
                      <div className="relative h-full flex flex-col">
                        <textarea
                            name="runningNotes"
                            value={formData.runningNotes + (liveTranscript ? `\n\n[Live Transcription]: ${liveTranscript}` : "")}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className="w-full h-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-none placeholder:text-slate-600 font-mono leading-relaxed pb-12"
                            placeholder="Freeform text area for quick, unstructured notes..."
                        />
                        {isLiveConnected && (
                            <div className="absolute bottom-16 right-2 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                                Transcribing...
                            </div>
                        )}
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            <Button onClick={handleAnalyzeNotes} disabled={isGenerating || !formData.runningNotes.trim()} className="bg-amber-600/90 hover:bg-amber-500 shadow-lg">
                                {isGenerating ? <Icons.Sparkles className="w-4 h-4 mr-2 animate-spin" /> : <Icons.Sparkles className="w-4 h-4 mr-2" />}
                                Process into Log
                            </Button>
                        </div>
                      </div>
                  ) : (
                      <div className="flex flex-col h-full">
                          {/* Input Area */}
                          <div className="mb-4 bg-slate-950 p-3 rounded-lg border border-slate-700">
                              <div className="flex gap-2 mb-2">
                                  <input 
                                    type="text" 
                                    value={newNoteContent}
                                    onChange={e => setNewNoteContent(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                    placeholder="Log an event..."
                                    className="flex-grow bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                                  />
                                  <Button size="sm" onClick={handleAddNote} disabled={!newNoteContent.trim()}>Add</Button>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                  <span className="text-xs text-slate-500 uppercase font-bold">Tag:</span>
                                  <select 
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-amber-500 max-w-[150px]"
                                    onChange={(e) => { if(e.target.value) toggleNoteTag(e.target.value); e.target.value = ""; }}
                                  >
                                      <option value="">Select Entity...</option>
                                      {possibleTags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                                  </select>
                                  {newNoteTags.map(tagId => (
                                      <span key={tagId} className="flex items-center gap-1 bg-amber-900/50 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
                                          {getEntityName(tagId)}
                                          <button onClick={() => toggleNoteTag(tagId)} className="hover:text-white"><Icons.X className="w-3 h-3" /></button>
                                      </span>
                                  ))}
                              </div>
                          </div>

                          {/* List Area */}
                          <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                              {(formData.structuredNotes || []).slice().reverse().map(note => (
                                  <div key={note.id} className="bg-slate-800/30 p-3 rounded-lg border border-slate-800 hover:border-slate-600 transition-colors group">
                                      <div className="flex justify-between items-start">
                                          <span className="text-xs text-slate-500 font-mono mb-1 block">{new Date(note.timestamp).toLocaleTimeString()}</span>
                                          <button onClick={() => removeNote(note.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash className="w-3 h-3" /></button>
                                      </div>
                                      <p className="text-sm text-slate-200">{note.content}</p>
                                      {note.taggedEntityIds && note.taggedEntityIds.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                              {note.taggedEntityIds.map(tagId => (
                                                  <span key={tagId} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                                      {getEntityName(tagId)}
                                                  </span>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              ))}
                              {(formData.structuredNotes || []).length === 0 && (
                                  <div className="text-center text-slate-600 py-10 italic text-sm">No log entries yet.</div>
                              )}
                          </div>
                      </div>
                  )}
              </div>

              {/* Post-Game Wrap Up */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 space-y-4">
                  <AiTextarea
                    label="Session Recap (Public)"
                    name="recap"
                    value={formData.recap}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={4}
                    placeholder="Summary of events for the players..."
                    onAiGenerate={handleAiGenerateRecap}
                    isGenerating={isGenerating}
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Loose Ends</label>
                    <textarea 
                        name="looseEnds" 
                        value={formData.looseEnds} 
                        onChange={handleChange} 
                        onBlur={handleBlur} 
                        rows={3} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y placeholder:text-slate-600"
                        placeholder="What needs to be resolved next time?"
                    />
                  </div>
              </div>

              <EntityHistoryManager
                subjectId={log.id}
                subjectType="session"
                campaign={campaign}
                onUpdateEntity={(type, id, changes) => {
                    if (type === 'npc') campaignService.updateNpc(id, changes);
                    if (type === 'location') campaignService.updateLocation(id, changes);
                }}
            />

              {/* Backlinks Panel */}
              <BacklinksPanel entityId={log.id} entityType="session-log" onNavigate={onNavigate} />
          </div>
      </div>
    </div>
  );
};
