
import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { Note } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { RegenerateButton } from '../common/RegenerateButton';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { campaignService } from '@/services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';

// ─── Save Status Indicator ────────────────────────────────────────────────────

const SaveStatusIndicator: React.FC = () => {
  const { saveStatus } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState,
  );
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Icons.Loader className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (saveStatus === 'error') {
    return <span className="text-xs text-red-400">Save error</span>;
  }
  if (showSaved) {
    return <span className="text-xs text-slate-400 transition-opacity duration-500">Saved</span>;
  }
  return null;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface NoteEditorProps {
  note: Note;
  onUpdate: (id: string, updatedData: Partial<Note>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(note);
  const { confirm } = useConfirmDialog();

  // Tracks the last `note` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevNoteRef = useRef(note);

  useEffect(() => {
    const prevNote = prevNoteRef.current;
    if (prevNote !== note) {
      setFormData(prev => reconcileEntityFormData(prev, prevNote, note));
    }
    prevNoteRef.current = note;
  }, [note]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(t => t.trim());
    setFormData(prev => ({ ...prev, tags }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // For tags, clean up on commit (trim, drop empties from a trailing comma,
    // dedupe) so the user can still type a trailing comma while editing —
    // the raw split happens on every keystroke in handleTagsChange, but only
    // the cleaned list is ever persisted.
    if (e.target.name === 'tags') {
      const cleanedTags = Array.from(new Set(formData.tags.map(t => t.trim()).filter(Boolean)));
      // Always reflect the cleaned list locally — even when it matches the
      // already-persisted `note.tags` — so the input stops displaying the
      // raw trailing comma/empty entry the user just typed (finding #108).
      // Only the store write (which triggers a campaign-wide update) is
      // gated on it actually differing from what's already saved.
      setFormData(prev => ({ ...prev, tags: cleanedTags }));
      if (cleanedTags.join(',') !== note.tags.join(',')) {
        onUpdate(note.id, { tags: cleanedTags });
      }
    } else {
      if (formData[e.target.name as keyof Note] !== note[e.target.name as keyof Note]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate(note.id, { [e.target.name]: e.target.value } as any);
      }
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Note', 'Are you sure you want to delete this note?', { variant: 'danger' });
    if (confirmed) {
      onDelete(note.id);
    }
  };

  const handleFieldRegenerate = (field: 'content') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(note.id, { [field]: newValue });
  };

  const noteEntityContext = `Title: ${formData.title}${formData.tags.length > 0 ? `\nTags: ${formData.tags.join(', ')}` : ''}${formData.content ? `\nContent: ${formData.content.substring(0, 300)}` : ''}`;

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-amber-400">
            <Icons.Notes className="w-8 h-8" />
            <h1 className="text-3xl font-bold font-serif text-slate-100">Campaign Note</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Last modified: {new Date(note.lastModified).toLocaleString()}</p>
            <SaveStatusIndicator />
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Icons.Trash className="w-3.5 h-3.5 mr-2" />
          Delete Note
        </Button>
      </header>

      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all font-semibold text-lg placeholder:text-slate-600"
            placeholder="Note Title..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Tags (comma separated)</label>
          <input
            type="text"
            name="tags"
            value={formData.tags.join(', ')}
            onChange={handleTagsChange}
            onBlur={handleBlur}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all text-sm placeholder:text-slate-600"
            placeholder="e.g. Plot, Idea, ToDo"
          />
        </div>

        <AiTextarea
          label="Content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={15}
          placeholder="Write your notes here..."
          regenerateButton={<RegenerateButton fieldName="content" currentValue={formData.content} entityType="Note" entityContext={noteEntityContext} onRegenerate={handleFieldRegenerate('content')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />
      </div>

      {/* Backlinks Panel */}
      <BacklinksPanel entityId={note.id} entityType="note" onNavigate={onNavigate} />
    </div>
  );
};
