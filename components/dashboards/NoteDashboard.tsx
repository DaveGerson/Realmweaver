
import React, { useState } from 'react';
import type { Note } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface NoteDashboardProps {
  notes: Note[];
  onNoteCreated: (data: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) => void;
  onSelectNote: (id: string) => void;
}

const NoteCreator: React.FC<{ onNoteCreated: (data: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) => void; }> = ({ onNoteCreated }) => {
    const [title, setTitle] = useState('');

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
    )
}

export const NoteDashboard: React.FC<NoteDashboardProps> = ({ notes, onNoteCreated, onSelectNote }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <NoteCreator onNoteCreated={onNoteCreated} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Campaign Notes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notes.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()).map(note => (
              <button 
                key={note.id} 
                onClick={() => onSelectNote(note.id)}
                className="bg-yellow-100/5 border-l-4 border-yellow-500/50 p-4 rounded-r-lg hover:bg-yellow-100/10 transition-all text-left flex flex-col h-40 relative group"
              >
                <div className="flex justify-between items-start w-full mb-2">
                     <h3 className="font-semibold text-slate-200 truncate pr-2">{note.title}</h3>
                     <Icons.Notes className="w-4 h-4 text-yellow-500/50 flex-shrink-0" />
                </div>
                <p className="text-sm text-slate-400 line-clamp-3 flex-grow">{note.content || <span className="italic opacity-50">Empty note...</span>}</p>
                <div className="mt-2 flex gap-2 overflow-hidden">
                    {note.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">{tag}</span>
                    ))}
                </div>
                 <div className="absolute bottom-2 right-2 text-[10px] text-slate-600">
                    {new Date(note.lastModified).toLocaleDateString()}
                </div>
              </button>
            ))}
            {notes.length === 0 && (
                <div className="sm:col-span-2 text-center py-10 text-slate-500">
                    <Icons.Notes className="w-12 h-12 mx-auto mb-2" />
                    <p>No notes yet. Start scribbling!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
