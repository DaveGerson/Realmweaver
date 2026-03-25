
import React, { useState, useEffect, useSyncExternalStore } from 'react';
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

  useEffect(() => {
    setFormData(note);
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
    // For tags, compare joined string
    if (e.target.name === 'tags') {
      if (formData.tags.join(',') !== note.tags.join(',')) {
        onUpdate(note.id, { tags: formData.tags });
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
