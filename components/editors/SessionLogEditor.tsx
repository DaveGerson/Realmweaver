
import React, { useState, useEffect } from 'react';
import type { SessionLog, SessionLogEntry } from '../../types/index';
import { Icons, SceneIcon } from '../common/Icons';
import { Button } from '../common/Button';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { campaignService } from '../../services/campaignService';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';
import { twMerge } from 'tailwind-merge';

interface SessionLogEditorProps {
  log: SessionLog;
  onUpdate: (id: string, updatedData: Partial<SessionLog>) => void;
  onDelete: (id: string) => void;
}

export const SessionLogEditor: React.FC<SessionLogEditorProps> = ({ log, onUpdate, onDelete }) => {
  const [formData, setFormData] = useState(log);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'structured' | 'scratchpad'>('structured');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const campaign = campaignService.getState().campaigns.find(c => c.id === campaignService.getState().activeCampaignId)!;

  useEffect(() => {
    setFormData(log);
  }, [log]);

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

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the log "${log.title}"? This action cannot be undone.`)) {
        onDelete(log.id);
    }
  }

  const handleStartSession = () => {
      onUpdate(log.id, { status: 'active', sessionDate: new Date().toISOString() });
  }

  const handleEndSession = () => {
      if(window.confirm("End the session? This will move it to the archive.")) {
          onUpdate(log.id, { status: 'completed' });
      }
  }

  const handleAiGenerateRecap = async () => {
      setIsGenerating(true);
      const structuredText = (formData.structuredNotes || []).map(n => n.content).join('\n');
      const combinedNotes = `${formData.runningNotes}\n\n${structuredText}`;
      
      const prompt = `Based on the following rough notes taken during the session, write a cohesive narrative recap of the events:\n\n${combinedNotes}`;
      try {
          const recap = await generateEnhancedText(prompt, undefined, false);
          setFormData(prev => ({...prev, recap}));
          onUpdate(log.id, { recap });
      } finally {
          setIsGenerating(false);
      }
  }

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

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-6 flex-shrink-0">
        <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Icons.SessionLog className={`w-8 h-8 ${formData.status === 'active' ? 'text-green-400 animate-pulse' : 'text-indigo-400'}`} />
              <div>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="bg-transparent text-3xl font-bold font-serif text-slate-100 outline-none focus:border-b border-indigo-500 placeholder:text-slate-600 w-full"
                  />
                  <div className="flex items-center gap-3 text-xs">
                      <span className={`uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          formData.status === 'active' ? 'bg-green-900 text-green-300' : 
                          formData.status === 'planned' ? 'bg-indigo-900 text-indigo-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                          {formData.status}
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
                        className="bg-transparent text-slate-400 outline-none hover:text-white transition-colors"
                      />
                  </div>
              </div>
            </div>
        </div>
        <div className="flex gap-2">
            {formData.status === 'planned' && (
                <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20">
                    <Icons.Play className="w-4 h-4 mr-2" /> Start Session
                </Button>
            )}
            {formData.status === 'active' && (
                <Button onClick={handleEndSession} className="bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20">
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none mb-4"
                    >
                        <option value="">-- Independent Session --</option>
                        {campaign.adventures.map(adv => (
                            <option key={adv.id} value={adv.id}>{adv.title}</option>
                        ))}
                    </select>

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
                                            className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 mr-3"
                                        />
                                        <SceneIcon type={scene.type} className="text-slate-500" />
                                        <span className={`text-sm ${formData.plannedSceneIds?.includes(scene.id) ? 'text-indigo-300 font-medium' : 'text-slate-400'}`}>
                                            {scene.title}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
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
              <div className={`flex-grow flex flex-col transition-all ${formData.status === 'active' ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900/50 border-slate-800/50'} p-4 rounded-xl border h-[500px]`}>
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex space-x-4">
                          <button 
                            onClick={() => setActiveTab('structured')}
                            className={twMerge("text-sm font-bold pb-1 border-b-2 transition-colors", activeTab === 'structured' ? "border-indigo-500 text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-300")}
                          >
                              Log Entries
                          </button>
                          <button 
                            onClick={() => setActiveTab('scratchpad')}
                            className={twMerge("text-sm font-bold pb-1 border-b-2 transition-colors", activeTab === 'scratchpad' ? "border-indigo-500 text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-300")}
                          >
                              Scratchpad
                          </button>
                      </div>
                      {formData.status === 'active' && <span className="text-xs text-green-400 animate-pulse flex items-center gap-1">● Live Recording</span>}
                  </div>

                  {activeTab === 'scratchpad' ? (
                      <textarea
                        name="runningNotes"
                        value={formData.runningNotes}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="w-full h-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600 font-mono leading-relaxed"
                        placeholder="Freeform text area for quick, unstructured notes..."
                      />
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
                                    className="flex-grow bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                  <Button size="sm" onClick={handleAddNote} disabled={!newNoteContent.trim()}>Add</Button>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                  <span className="text-xs text-slate-500 uppercase font-bold">Tag:</span>
                                  <select 
                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-indigo-500 max-w-[150px]"
                                    onChange={(e) => { if(e.target.value) toggleNoteTag(e.target.value); e.target.value = ""; }}
                                  >
                                      <option value="">Select Entity...</option>
                                      {possibleTags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                                  </select>
                                  {newNoteTags.map(tagId => (
                                      <span key={tagId} className="flex items-center gap-1 bg-indigo-900/50 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30">
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-y placeholder:text-slate-600"
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
          </div>
      </div>
    </div>
  );
};
