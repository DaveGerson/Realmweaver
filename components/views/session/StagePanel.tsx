// components/views/session/StagePanel.tsx
//
// The Stage (docs/design/unstructured-play.md) — where the party is, who is
// with them, and what is happening RIGHT NOW, independent of any prepped
// Scene. It is the centre of a freeform session and a live overlay on a
// scene-driven one: the scene's own cast renders as fixed chips, everyone the
// DM adds on the fly renders as removable chips, and the place can be a linked
// Location or three words typed at the table.
//
// Copy rules (docs/design/schema-presentation-guide.md): second person, plain
// verbs, no data words, no exclamation marks. Nothing here is a required
// field and nothing nags — an empty Stage is an invitation, not a gap.

import React, { useEffect, useMemo, useState } from 'react';
import type { Campaign, Location, NPC, SessionStage } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { EntityLink } from '@/components/common/EntityLink';
import { twMerge } from 'tailwind-merge';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

/** How many matches a picker lists before asking for a narrower search. */
const PICKER_LIMIT = 8;

export interface StagePanelProps {
    campaign: Campaign;
    stage: SessionStage;
    /** The active scene's own cast — on stage because the scene says so; not removable here. */
    sceneCast: NPC[];
    /** NPCs the DM put on the Stage — removable. */
    stageCast: NPC[];
    /** The place in effect: the Stage's linked location, else the scene's. */
    presentLocation: Location | null;
    hasActiveScene: boolean;
    onSetLocation: (locationId: string | null, place?: string) => void;
    onAddNpc: (npcId: string) => void;
    onRemoveNpc: (npcId: string) => void;
    onSetFocus: (focus: string) => void;
    /** Promotes a freeform place to a real Location (improv becomes canon). */
    onSaveFreeformPlace?: () => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const pickerInputClasses =
    'w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500';

export const StagePanel: React.FC<StagePanelProps> = ({
    campaign,
    stage,
    sceneCast,
    stageCast,
    presentLocation,
    hasActiveScene,
    onSetLocation,
    onAddNpc,
    onRemoveNpc,
    onSetFocus,
    onSaveFreeformPlace,
    onNavigate,
}) => {
    const [placePickerOpen, setPlacePickerOpen] = useState(false);
    const [placeQuery, setPlaceQuery] = useState('');
    const [freeformPlace, setFreeformPlace] = useState('');
    const [castPickerOpen, setCastPickerOpen] = useState(false);
    const [castQuery, setCastQuery] = useState('');
    const [focusDraft, setFocusDraft] = useState(stage.focus ?? '');

    // The focus box mirrors the store but is edited locally, so a store update
    // from elsewhere (a beat played from the scene list, a Stage reset on
    // entering a scene) lands in the box without clobbering a half-typed line
    // only when the box is not the thing that changed.
    useEffect(() => {
        setFocusDraft(stage.focus ?? '');
    }, [stage.focus]);

    const presentIds = useMemo(
        () => new Set([...sceneCast.map(n => n.id), ...stageCast.map(n => n.id)]),
        [sceneCast, stageCast]
    );

    const placeMatches = useMemo(() => {
        const q = placeQuery.trim().toLowerCase();
        const pool = campaign.locations.filter(l => l.id !== presentLocation?.id);
        const matched = q ? pool.filter(l => l.name.toLowerCase().includes(q)) : pool;
        return matched.slice(0, PICKER_LIMIT);
    }, [campaign.locations, placeQuery, presentLocation?.id]);

    const castMatches = useMemo(() => {
        const q = castQuery.trim().toLowerCase();
        const pool = campaign.npcs.filter(n => !presentIds.has(n.id));
        const matched = q ? pool.filter(n => n.name.toLowerCase().includes(q)) : pool;
        return matched.slice(0, PICKER_LIMIT);
    }, [campaign.npcs, castQuery, presentIds]);

    const isFreeformPlace = !presentLocation && !!stage.place?.trim();
    const isEmpty =
        !hasActiveScene &&
        !presentLocation &&
        !stage.place?.trim() &&
        sceneCast.length === 0 &&
        stageCast.length === 0 &&
        !stage.focus?.trim();

    const commitFocus = () => {
        if (focusDraft.trim() === (stage.focus ?? '').trim()) return;
        onSetFocus(focusDraft);
    };

    const choosePlace = (locationId: string) => {
        onSetLocation(locationId);
        setPlacePickerOpen(false);
        setPlaceQuery('');
        setFreeformPlace('');
    };

    const chooseFreeformPlace = () => {
        const text = freeformPlace.trim();
        if (!text) return;
        onSetLocation(null, text);
        setPlacePickerOpen(false);
        setPlaceQuery('');
        setFreeformPlace('');
    };

    const addNpc = (npcId: string) => {
        onAddNpc(npcId);
        setCastQuery('');
    };

    return (
        <section
            aria-label="On stage"
            className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 space-y-3"
        >
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icons.Roleplay className="w-3.5 h-3.5" />
                    On stage
                </h3>
                {hasActiveScene && (
                    <span className="text-[10px] text-slate-500">Anything you add here joins the scene</span>
                )}
            </div>

            {isEmpty && (
                <p className="text-sm text-slate-400 italic">
                    Set the stage: where is the party, and who is with them? Or pick a scene from the list — either way works.
                </p>
            )}

            {/* Place */}
            <div className="flex flex-wrap items-center gap-2">
                <Icons.MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                {presentLocation ? (
                    <span className="text-sm text-white font-semibold">
                        {onNavigate
                            ? <EntityLink entityType="location" entityId={presentLocation.id} label={presentLocation.name} onNavigate={onNavigate} />
                            : presentLocation.name}
                    </span>
                ) : isFreeformPlace ? (
                    <span className="text-sm text-slate-200 italic">{stage.place}</span>
                ) : (
                    <span className="text-sm text-slate-500 italic">Nowhere in particular yet</span>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlacePickerOpen(o => !o)}
                    aria-expanded={placePickerOpen}
                    className="text-xs text-slate-400 hover:text-amber-300"
                >
                    {presentLocation || isFreeformPlace ? 'Change place' : 'Set the place'}
                </Button>
                {isFreeformPlace && onSaveFreeformPlace && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSaveFreeformPlace}
                        className="text-xs text-emerald-400/80 hover:text-emerald-300"
                        title="Turn this place into a location you can come back to"
                    >
                        <Icons.Plus className="w-3 h-3 mr-1" />
                        Save as a location
                    </Button>
                )}
            </div>

            {placePickerOpen && (
                <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                    <input
                        type="text"
                        value={placeQuery}
                        onChange={e => setPlaceQuery(e.target.value)}
                        placeholder="Search your places…"
                        aria-label="Search places"
                        className={pickerInputClasses}
                        autoFocus
                    />
                    {placeMatches.length > 0 ? (
                        <ul className="space-y-0.5">
                            {placeMatches.map(loc => (
                                <li key={loc.id}>
                                    <button
                                        type="button"
                                        onClick={() => choosePlace(loc.id)}
                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                                    >
                                        {loc.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-slate-500 italic px-1">
                            {campaign.locations.length === 0 ? 'No places written yet — name one below.' : 'Nothing matches — name the place below instead.'}
                        </p>
                    )}
                    <div className="flex gap-1.5 pt-1 border-t border-slate-800">
                        <input
                            type="text"
                            value={freeformPlace}
                            onChange={e => setFreeformPlace(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') chooseFreeformPlace(); }}
                            placeholder="Or just name it: a nameless roadside shrine"
                            aria-label="Name a place"
                            className={pickerInputClasses}
                        />
                        <Button variant="secondary" size="sm" onClick={chooseFreeformPlace} disabled={!freeformPlace.trim()} className="flex-shrink-0">
                            Use it
                        </Button>
                    </div>
                    {(presentLocation || isFreeformPlace) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { onSetLocation(null); setPlacePickerOpen(false); }}
                            className="text-xs text-slate-500 hover:text-slate-300"
                        >
                            Clear the place
                        </Button>
                    )}
                </div>
            )}

            {/* Cast */}
            <div className="flex flex-wrap items-center gap-1.5">
                <Icons.NPCs className="w-4 h-4 text-amber-400 flex-shrink-0" />
                {sceneCast.length === 0 && stageCast.length === 0 && (
                    <span className="text-sm text-slate-500 italic">No one here yet</span>
                )}
                {sceneCast.map(npc => (
                    <span
                        key={`scene-${npc.id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/60 text-xs text-slate-200 border border-slate-600/60"
                        title="Here because the scene says so"
                    >
                        {onNavigate
                            ? <EntityLink entityType="npc" entityId={npc.id} label={npc.name} onNavigate={onNavigate} className="text-xs no-underline" />
                            : npc.name}
                    </span>
                ))}
                {stageCast.map(npc => (
                    <span
                        key={`stage-${npc.id}`}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-amber-900/30 text-xs text-amber-100 border border-amber-700/50"
                    >
                        {onNavigate
                            ? <EntityLink entityType="npc" entityId={npc.id} label={npc.name} onNavigate={onNavigate} className="text-xs no-underline" />
                            : npc.name}
                        <button
                            type="button"
                            onClick={() => onRemoveNpc(npc.id)}
                            aria-label={`Take ${npc.name} off stage`}
                            title="They leave"
                            className="rounded-full p-0.5 text-amber-400/70 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                        >
                            <Icons.X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCastPickerOpen(o => !o)}
                    aria-expanded={castPickerOpen}
                    className="text-xs text-slate-400 hover:text-amber-300"
                >
                    <Icons.UserPlus className="w-3.5 h-3.5 mr-1" />
                    Add someone
                </Button>
            </div>

            {castPickerOpen && (
                <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 space-y-2">
                    <input
                        type="text"
                        value={castQuery}
                        onChange={e => setCastQuery(e.target.value)}
                        placeholder="Who walks in?"
                        aria-label="Search NPCs"
                        className={pickerInputClasses}
                        autoFocus
                    />
                    {castMatches.length > 0 ? (
                        <ul className="space-y-0.5">
                            {castMatches.map(npc => (
                                <li key={npc.id}>
                                    <button
                                        type="button"
                                        onClick={() => addNpc(npc.id)}
                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2"
                                    >
                                        <Icons.Plus className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                        <span className="truncate">{npc.name}</span>
                                        {npc.traits && <span className="text-slate-500 truncate">— {npc.traits}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-slate-500 italic px-1">
                            {campaign.npcs.length === 0 ? 'No one lives here yet.' : 'Nothing matches.'}
                        </p>
                    )}
                    <p className="text-[11px] text-slate-500 px-1">Someone brand new? Quick NPC in the tools column makes them and puts them on stage.</p>
                </div>
            )}

            {/* Focus */}
            <div className="flex items-center gap-2">
                <Icons.Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <input
                    type="text"
                    value={focusDraft}
                    onChange={e => setFocusDraft(e.target.value)}
                    onBlur={commitFocus}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            commitFocus();
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    placeholder="What's happening right now…"
                    aria-label="What's happening right now"
                    className={twMerge(pickerInputClasses, 'text-sm')}
                />
            </div>
        </section>
    );
};
