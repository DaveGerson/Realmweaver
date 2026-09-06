
import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { inputBaseClasses } from '@/components/common/Textarea';
import { splitCanonNote } from '@/utils/canonCapture';
import type { CanonEntityKind } from '@/utils/canonCapture';

const KIND_OPTIONS: { kind: CanonEntityKind; label: string; icon: typeof Icons.NPCs }[] = [
    { kind: 'npc', label: 'New NPC', icon: Icons.NPCs },
    { kind: 'location', label: 'New Location', icon: Icons.Locations },
    { kind: 'item', label: 'New Item', icon: Icons.Items },
    { kind: 'note', label: 'New Note', icon: Icons.Notes },
];

export interface CanonCapturePickerProps {
    /** The note text this canon entity is captured from — used only to derive the pre-filled name suggestion. */
    content: string;
    /** Called with the chosen kind and the (possibly DM-edited) name when Save is confirmed. */
    onSave: (kind: CanonEntityKind, name: string) => void;
    onCancel: () => void;
    /** Kind selected when the picker first opens. Defaults to 'npc' — the most common improv capture. */
    defaultKind?: CanonEntityKind;
}

/**
 * Monte Cook's "improv canon capture" — the shared inline picker behind
 * "Make this canon" in both `components/views/session/RunningLog.tsx` (live
 * session) and `components/editors/SessionLogEditor.tsx` (post-hoc review),
 * so the kind-selection + name-editing UI lives exactly once.
 *
 * Purely presentational: it never touches `campaignService` itself. `onSave`
 * is the host's cue to actually build a draft (`utils/canonCapture`'s
 * `buildCanonDraft`) and call the matching `campaignService.create*` — each
 * host owns its own follow-up (scene-link / Stage placement / auto-log /
 * toast), since a live session and a past one need different follow-ups.
 *
 * The name field is pre-filled from `splitCanonNote(content)` once, at open
 * time — it does not stay live-synced against `content` while the picker is
 * open, so a DM who edits the suggested name keeps that edit until Save or
 * Cancel closes the picker.
 */
export const CanonCapturePicker: React.FC<CanonCapturePickerProps> = ({
    content,
    onSave,
    onCancel,
    defaultKind = 'npc',
}) => {
    const [kind, setKind] = useState<CanonEntityKind>(defaultKind);
    const [name, setName] = useState(() => splitCanonNote(content).name);

    const trimmedName = name.trim();

    const handleSave = () => {
        if (!trimmedName) return;
        onSave(kind, trimmedName);
    };

    return (
        <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-2.5 space-y-2">
            <div role="radiogroup" aria-label="Canon entity type" className="flex flex-wrap gap-1.5">
                {KIND_OPTIONS.map(({ kind: optionKind, label, icon: Icon }) => {
                    const selected = kind === optionKind;
                    return (
                        <button
                            key={optionKind}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setKind(optionKind)}
                            className={twMerge(
                                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors border",
                                selected
                                    ? "bg-amber-900/40 text-amber-300 border-amber-600/50"
                                    : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400 hover:border-slate-600"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    );
                })}
            </div>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder="Name"
                aria-label="Canon entity name"
                autoFocus
                className={twMerge(inputBaseClasses, "w-full px-2 py-1.5 text-sm")}
            />
            <div className="flex gap-1.5">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={!trimmedName} className="flex-1">
                    <Icons.Check className="w-3.5 h-3.5 mr-1" />
                    Save
                </Button>
                <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
            </div>
        </div>
    );
};
