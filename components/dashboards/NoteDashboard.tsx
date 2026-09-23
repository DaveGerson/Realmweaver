
import React, { useMemo } from 'react';
import type { Note } from '../../types/index';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';
import { useIncrementalList } from '@/hooks/useIncrementalList';
import { IncrementalListFooter } from '@/components/common/IncrementalListFooter';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface NoteDashboardProps {
  notes: Note[];
  onNoteCreated: (data: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) => void;
  onSelectNote: (id: string) => void;
  isMockMode?: boolean;
  campaignContext?: string;
}

const NoteCreator: React.FC<{ onNoteCreated: (data: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) => void; }> = ({ onNoteCreated }) => {
    const [title, setTitle] = React.useState('');

    const handleCreate = () => {
        if (!title.trim()) return;
        onNoteCreated({
            title,
            content: '',
            tags: [],
        });
        setTitle('');
    };

    return (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-3">
                <Icons.Plus className="w-7 h-7 text-amber-400" />
                <h2 className="text-2xl font-bold font-serif text-slate-100">New Note</h2>
            </div>
            <p className="text-sm text-slate-400 flex-grow">
                Quickly jot down a new idea, plot point, or to-do item.
            </p>
            <div className="space-y-3">
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="e.g., The villain's secret plan..." className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600" />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={!title.trim()} size="lg" className="w-full mt-auto">
                Create Note
            </Button>
        </div>
    );
};

/** Returns a color class for the completeness dot based on percentage 0-100. */
function completenessColor(pct: number): string {
  if (pct >= 67) return 'bg-green-500';
  if (pct >= 33) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Completeness for a Note: title + content are the two key fields. */
function noteCompleteness(note: Note): number {
  const fields = [note.title, note.content];
  const filled = fields.filter(f => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

export const NoteDashboard: React.FC<NoteDashboardProps> = ({ notes, onNoteCreated, onSelectNote }) => {
  // Sort by most-recently modified, then normalize title->name for the hook
  const normalizedNotes = useMemo(
    () => [...notes]
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .map(n => ({ ...n, name: n.title })),
    [notes],
  );

  const { filteredEntities: filteredNormalized, searchTerm, setSearchTerm } = useEntitySearch(
    normalizedNotes,
    ['name', 'content'],
  );

  // Re-associate back to originals to preserve type safety
  const filteredNotes = useMemo(() => {
    const ids = new Set(filteredNormalized.map(n => n.id));
    return normalizedNotes.filter(n => ids.has(n.id));
  }, [filteredNormalized, normalizedNotes]);
  const incremental = useIncrementalList(filteredNotes, { resetKey: searchTerm });
  const { getRovingProps } = useRovingTabIndex({
    direction: 'both', columns: { base: 1, sm: 2 },
    // N4: above ~100 cards the grid renders a growing prefix; let arrow /
    // End navigation reach past it (the window grows, then focus lands).
    itemCount: filteredNotes.length,
    onRequestIndex: incremental.ensureIndexVisible,
  });

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <NoteCreator onNoteCreated={onNoteCreated} />
        </div>
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold font-serif text-slate-200">Campaign Notes</h2>
            <div className="relative max-w-xs w-full sm:w-auto">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search notes..."
                className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {incremental.visibleItems.map((note, index) => {
              const pct = noteCompleteness(note);
              return (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  {...getRovingProps(index)}
                  className="bg-slate-800/60 border-l-4 border-slate-600 p-4 rounded-r-lg hover:bg-slate-800 transition-all text-left flex flex-col h-40 relative group"
                >
                  {/* Completeness dot */}
                  <span
                    className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${completenessColor(pct)}`}
                    title={`${pct}% complete`}
                  />
                  <div className="flex justify-between items-start w-full mb-2 pr-4">
                    <h3 className="font-semibold text-slate-200 truncate pr-2">{note.title}</h3>
                    <Icons.Notes className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3 flex-grow">{note.content || <span className="italic opacity-50">Empty note...</span>}</p>
                  <div className="mt-2 flex gap-2 overflow-hidden">
                      {/* Dedupe + drop empty entries at render time: notes persisted
                          before the NoteEditor commit-time cleanup (or created via
                          import/AI, which doesn't clean tags) can still carry
                          duplicate/empty tags, which would otherwise produce a
                          duplicate React key and an empty pill (finding #108). */}
                      {Array.from(new Set(note.tags.filter(Boolean))).map((tag, i) => (
                          <span key={`${tag}-${i}`} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">{tag}</span>
                      ))}
                  </div>
                  <div className="absolute bottom-2 right-2 text-[10px] text-slate-600">
                    {new Date(note.lastModified).toLocaleDateString()}
                  </div>
                </button>
              );
            })}
            {filteredNotes.length === 0 && notes.length > 0 && (
                <div className="sm:col-span-2 text-center py-8">
                    <Icons.Search className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                    <p className="text-slate-400">No notes match "{searchTerm}"</p>
                </div>
            )}
            {notes.length === 0 && (
                <div className="sm:col-span-2 text-center py-10 text-slate-500">
                    <Icons.Notes className="w-12 h-12 mx-auto mb-2" />
                    <p>No notes yet. Start scribbling!</p>
                </div>
            )}
          </div>
          <IncrementalListFooter
            hasMore={incremental.hasMore}
            remaining={incremental.remaining}
            visibleCount={incremental.visibleCount}
            totalCount={incremental.totalCount}
            showMore={incremental.showMore}
            sentinelRef={incremental.sentinelRef}
            noun="notes"
          />
        </div>
      </div>
    </div>
  );
};
