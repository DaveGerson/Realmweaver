
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { SessionLog } from '@/types';
import { Icons } from '@/components/common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { MentionInput } from '@/components/common/MentionInput';

// Browser speech recognition API types
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

const NOTE_TAG_OPTIONS = ['Combat', 'NPC', 'Decision', 'Loot', 'Discovery'] as const;

const ENTRY_TYPE_STYLES: Record<string, { text: string; border: string; icon: React.ReactNode }> = {
    'scene-transition': {
        text: 'text-blue-300',
        border: 'border-l-2 border-l-blue-500 pl-2',
        icon: <Icons.Scenes className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
    },
    'combat': {
        text: 'text-red-300',
        border: 'border-l-2 border-l-red-500 pl-2',
        icon: <Icons.Combat className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
    },
    'npc-created': {
        text: 'text-green-300',
        border: 'border-l-2 border-l-green-500 pl-2',
        icon: <Icons.NPCs className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />,
    },
    'dice-roll': {
        text: 'text-amber-300',
        border: 'border-l-2 border-l-amber-500 pl-2',
        icon: <Icons.Dice className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    },
    'coach-used': {
        text: 'text-amber-300',
        border: 'border-l-2 border-l-amber-500 pl-2',
        icon: <Icons.Coach className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    },
};

interface RunningLogProps {
    sessionLog: SessionLog;
    mobileTab: 'scenes' | 'active' | 'tools';
}

export const RunningLog: React.FC<RunningLogProps> = ({ sessionLog, mobileTab }) => {
    const [noteInput, setNoteInput] = useState('');
    const [noteTags, setNoteTags] = useState<string[]>([]);
    const [noteMentionedEntityIds, setNoteMentionedEntityIds] = useState<string[]>([]);
    const [showImportantOnly, setShowImportantOnly] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const noteInputWrapperRef = useRef<HTMLDivElement>(null);

    const hasSpeechRecognition = typeof window !== 'undefined' &&
        (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

    // Stop speech recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
                recognitionRef.current = null;
            }
        };
    }, []);

    // "/" shortcut: focus the note input (suppressed when already in an input)
    useEffect(() => {
        const handleSlash = (e: KeyboardEvent) => {
            if (e.key !== '/') return;
            const target = e.target as HTMLElement;
            const tag = target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
            e.preventDefault();
            const inputEl = noteInputWrapperRef.current?.querySelector<HTMLElement>('input, textarea');
            inputEl?.focus();
        };
        document.addEventListener('keydown', handleSlash);
        return () => document.removeEventListener('keydown', handleSlash);
    }, []);

    const filteredNotes = useMemo(() => {
        const notes = sessionLog.structuredNotes || [];
        if (!showImportantOnly) return notes;
        return notes.filter(n => n.isImportant);
    }, [sessionLog.structuredNotes, showImportantOnly]);

    const handleAddNote = () => {
        if (!noteInput.trim()) return;
        campaignService.addSessionRunnerNote(noteInput.trim(), noteMentionedEntityIds, 'manual', noteTags);
        setNoteInput('');
        setNoteTags([]);
        setNoteMentionedEntityIds([]);
    };

    const toggleTag = (tag: string) => {
        setNoteTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const handleToggleMic = useCallback(() => {
        if (!hasSpeechRecognition) return;

        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
            return;
        }

        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    setNoteInput(prev => (prev ? prev + ' ' : '') + transcript.trim());
                }
            }
        };

        recognition.onerror = () => {
            setIsRecording(false);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            setIsRecording(false);
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    }, [isRecording, hasSpeechRecognition]);

    return (
        <div className={twMerge(
            "flex-shrink-0 bg-slate-900 border-t border-slate-700 flex flex-col",
            "h-48 md:h-64 lg:h-72",
            mobileTab === 'tools' || mobileTab === 'scenes' ? "hidden md:flex" : "flex"
        )}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Running Log</h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowImportantOnly(prev => !prev)}
                        className={twMerge(
                            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
                            showImportantOnly
                                ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                                : "text-slate-500 hover:text-slate-400"
                        )}
                    >
                        <Icons.Star className="w-3 h-3" />
                        {showImportantOnly ? 'Important Only' : 'Show All'}
                    </button>
                    <span className="text-xs text-slate-600">{sessionLog.structuredNotes?.length || 0} entries</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                {filteredNotes.map(note => {
                    const typeStyle = note.type && note.type !== 'manual' ? ENTRY_TYPE_STYLES[note.type] : null;
                    return (
                        <div
                            key={note.id}
                            className={twMerge(
                                "flex items-start gap-2 text-sm py-0.5 group",
                                typeStyle?.border
                            )}
                        >
                            <span className="text-slate-600 text-xs font-mono flex-shrink-0 mt-0.5">
                                {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {typeStyle?.icon}
                            <span className={twMerge("flex-1", typeStyle?.text || "text-slate-300")}>
                                {note.content}
                            </span>
                            {note.tags && note.tags.length > 0 && (
                                <div className="flex gap-1 flex-shrink-0">
                                    {note.tags.map(tag => (
                                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{tag}</span>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => campaignService.toggleNoteImportance(note.id)}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={note.isImportant ? 'Unmark important' : 'Mark important'}
                            >
                                <Icons.Star
                                    className={twMerge(
                                        "w-3.5 h-3.5 transition-colors",
                                        note.isImportant
                                            ? "text-amber-400 fill-amber-400"
                                            : "text-slate-600 hover:text-slate-400"
                                    )}
                                />
                            </button>
                        </div>
                    );
                })}
                {filteredNotes.length === 0 && (
                    <p className="text-xs text-slate-600 italic">
                        {showImportantOnly ? 'No important notes. Star a note to mark it important.' : 'No notes yet. Add notes below.'}
                    </p>
                )}
            </div>
            <div className="px-4 py-2 border-t border-slate-800 space-y-2">
                <div className="flex gap-1">
                    {NOTE_TAG_OPTIONS.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={twMerge(
                                "text-xs px-2 py-0.5 rounded-md transition-colors border",
                                noteTags.includes(tag)
                                    ? "bg-amber-900/40 text-amber-300 border-amber-600/50"
                                    : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400 hover:border-slate-600"
                            )}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <div ref={noteInputWrapperRef} className="flex-1 min-w-0">
                    <MentionInput
                        value={noteInput}
                        onChange={setNoteInput}
                        onMentionedIdsChange={setNoteMentionedEntityIds}
                        onEnterSubmit={handleAddNote}
                        placeholder="Add a quick note... (/ to focus, @ to mention)"
                        singleLine
                        className="w-full"
                        textareaClassName="bg-slate-800 border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:ring-amber-500/30 py-1.5"
                        aria-label="Session note input"
                    />
                    </div>
                    {hasSpeechRecognition && (
                        <button
                            onClick={handleToggleMic}
                            title={isRecording ? 'Stop recording' : 'Start voice capture'}
                            className={twMerge(
                                "flex-shrink-0 flex items-center justify-center w-9 rounded-lg transition-colors",
                                isRecording
                                    ? "bg-red-600 hover:bg-red-500 text-white"
                                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                            )}
                        >
                            {isRecording
                                ? <span className="relative flex items-center justify-center w-full h-full">
                                    <Icons.MicOff className="w-4 h-4" />
                                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                  </span>
                                : <Icons.Mic className="w-4 h-4" />
                            }
                        </button>
                    )}
                    <button
                        onClick={handleAddNote}
                        disabled={!noteInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors flex-shrink-0"
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
};
