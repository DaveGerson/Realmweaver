
import React, { useState, useMemo } from 'react';
import type { Campaign, HistoryEntry, NPC, Location } from '../../types/index';
import { Icons } from './Icons';
import { Button } from './Button';
import { produce } from 'immer';

interface EntityHistoryManagerProps {
    subjectId: string;
    subjectType: 'npc' | 'location' | 'session' | 'article' | 'faction';
    campaign: Campaign;
    onUpdateEntity: (type: 'npc' | 'location', id: string, changes: Partial<NPC | Location>) => void;
}

export const EntityHistoryManager: React.FC<EntityHistoryManagerProps> = ({ subjectId, subjectType, campaign, onUpdateEntity }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Form State
    const [targetId, setTargetId] = useState('');
    const [summary, setSummary] = useState('');

    // Determine Mode
    const isEntitySubject = subjectType === 'npc' || subjectType === 'location';
    
    // Computed properties
    const events = useMemo(() => {
        const allEvents: { 
            id: string; 
            summary: string; 
            date?: string; 
            linkedEntityId: string; 
            linkedEntityName: string; 
            linkedEntityType: string;
            sourceEntityId: string; // The entity holding the history array
            sourceEntityType: 'npc' | 'location';
        }[] = [];

        // If we are viewing an NPC/Location, show its own history
        if (isEntitySubject) {
            const entity = subjectType === 'npc' 
                ? campaign.npcs.find(n => n.id === subjectId)
                : campaign.locations.find(l => l.id === subjectId);
            
            if (entity) {
                entity.history.forEach(h => {
                    let linkedName = 'Manual Entry';
                    let date: string | undefined = undefined;

                    // Resolve the linked entity by referenceId across every possible target
                    // collection rather than trusting referenceType alone: HistoryReferenceType
                    // only distinguishes 'session' | 'article' | 'manual', so references created
                    // against a subject type outside that union (e.g. 'faction') are stored with
                    // a best-effort referenceType but still carry the real target's id.
                    if (h.referenceId) {
                        const session = campaign.sessionLogs.find(s => s.id === h.referenceId);
                        const article = campaign.articles.find(a => a.id === h.referenceId);
                        const faction = campaign.factions.find(f => f.id === h.referenceId);

                        if (session) {
                            linkedName = session.title;
                            date = session.sessionDate;
                        } else if (article) {
                            linkedName = article.title;
                        } else if (faction) {
                            linkedName = faction.name;
                        } else if (h.referenceType === 'session') {
                            linkedName = 'Unknown Session';
                        } else if (h.referenceType === 'article') {
                            linkedName = 'Unknown Article';
                        }
                    }

                    allEvents.push({
                        id: h.id,
                        summary: h.summary,
                        date,
                        linkedEntityId: h.referenceId || '',
                        linkedEntityName: linkedName,
                        linkedEntityType: h.referenceType,
                        sourceEntityId: entity.id,
                        sourceEntityType: subjectType as 'npc' | 'location'
                    });
                });
            }
        } 
        // If we are viewing a Session/Article, show history from ALL entities referencing this
        else {
            const scanEntities = (entities: (NPC | Location)[], type: 'npc' | 'location') => {
                entities.forEach(entity => {
                    entity.history.forEach(h => {
                        if (h.referenceId === subjectId) {
                            allEvents.push({
                                id: h.id,
                                summary: h.summary,
                                linkedEntityId: entity.id,
                                linkedEntityName: entity.name,
                                linkedEntityType: type === 'npc' ? 'NPC' : 'Location', // Display name
                                sourceEntityId: entity.id,
                                sourceEntityType: type
                            });
                        }
                    });
                });
            };
            scanEntities(campaign.npcs, 'npc');
            scanEntities(campaign.locations, 'location');
        }

        return allEvents;
    }, [campaign, subjectId, subjectType, isEntitySubject]);

    const handleSave = () => {
        if (!summary.trim()) return;

        if (isEntitySubject) {
            // Adding to current entity's history (Reference Mode: Pointing OUT)
            // Target ID is a Session or Article ID
            const entity = subjectType === 'npc' 
                ? campaign.npcs.find(n => n.id === subjectId)
                : campaign.locations.find(l => l.id === subjectId);
            
            if (!entity) return;

            let refType: 'session' | 'article' | 'manual' = 'manual';
            if (campaign.sessionLogs.some(s => s.id === targetId)) refType = 'session';
            else if (campaign.articles.some(a => a.id === targetId)) refType = 'article';

            const newEntry: HistoryEntry = {
                id: crypto.randomUUID(),
                summary,
                referenceType: refType,
                referenceId: targetId || undefined
            };

            onUpdateEntity(subjectType as 'npc' | 'location', subjectId, {
                history: [...entity.history, newEntry]
            });

        } else {
            // Adding to ANOTHER entity's history (Reference Mode: Pointing IN)
            // Target ID is an NPC or Location ID
            // We add an entry to THAT entity pointing to THIS subject
            const npc = campaign.npcs.find(n => n.id === targetId);
            const loc = campaign.locations.find(l => l.id === targetId);
            
            const targetEntity = npc || loc;
            const type = npc ? 'npc' : 'location';

            if (!targetEntity) return;

            // HistoryReferenceType only covers 'session' | 'article' | 'manual', so a 'faction'
            // subject (no matching union member) falls back to 'manual' here rather than being
            // mislabeled as 'article' — the reverse lookup above resolves the real name by id.
            const newEntry: HistoryEntry = {
                id: crypto.randomUUID(),
                summary,
                referenceType: subjectType === 'session' ? 'session' : subjectType === 'article' ? 'article' : 'manual',
                referenceId: subjectId
            };

            onUpdateEntity(type, targetId, {
                history: [...targetEntity.history, newEntry]
            });
        }

        setIsAdding(false);
        setSummary('');
        setTargetId('');
    };

    const handleDelete = (eventId: string, sourceEntityId: string, sourceEntityType: 'npc' | 'location') => {
        const entity = sourceEntityType === 'npc' 
            ? campaign.npcs.find(n => n.id === sourceEntityId)
            : campaign.locations.find(l => l.id === sourceEntityId);
        
        if (entity) {
            const newHistory = entity.history.filter(h => h.id !== eventId);
            onUpdateEntity(sourceEntityType, sourceEntityId, { history: newHistory });
        }
    };

    const renderTargetOptions = () => {
        if (isEntitySubject) {
            return (
                <>
                    <optgroup label="Sessions">
                        {campaign.sessionLogs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </optgroup>
                    <optgroup label="Lorebook">
                        {campaign.articles.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </optgroup>
                </>
            );
        } else {
            return (
                <>
                    <optgroup label="NPCs">
                        {campaign.npcs.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </optgroup>
                    <optgroup label="Locations">
                        {campaign.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                </>
            );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                    {isEntitySubject ? 'History & References' : 'Linked Entity Events'}
                </h3>
                <Button size="sm" variant="secondary" onClick={() => setIsAdding(true)}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Event
                </Button>
            </div>

            {isAdding && (
                <div className="bg-slate-900 p-3 rounded-md border border-slate-700 animate-in fade-in">
                    <div className="flex gap-2 mb-2">
                        <select 
                            value={targetId} 
                            onChange={(e) => setTargetId(e.target.value)}
                            className="w-1/3 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                        >
                            <option value="">{isEntitySubject ? '-- Select Context (Optional) --' : '-- Select Entity --'}</option>
                            {renderTargetOptions()}
                        </select>
                        <input 
                            type="text" 
                            value={summary} 
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="What happened?"
                            className="flex-grow bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={!summary.trim() || (!isEntitySubject && !targetId)}>Save</Button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {events.map(event => (
                    <div key={event.id} className="group flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                        <div className="mt-0.5 text-slate-500">
                            <Icons.Link className="w-4 h-4" />
                        </div>
                        <div className="flex-grow text-sm">
                            <div className="flex justify-between items-start">
                                <span className="font-semibold text-amber-300">
                                    {isEntitySubject ? event.linkedEntityName : event.linkedEntityName}
                                </span>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleDelete(event.id, event.sourceEntityId, event.sourceEntityType)} className="text-slate-500 hover:text-red-400 transition-colors">
                                        <Icons.Trash className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-slate-300 mt-0.5">{event.summary}</p>
                            {event.date && <p className="text-xs text-slate-600 mt-1">{new Date(event.date).toLocaleDateString()}</p>}
                        </div>
                    </div>
                ))}
                {events.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-sm italic bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                        No linked events found.
                    </div>
                )}
            </div>
        </div>
    );
};
