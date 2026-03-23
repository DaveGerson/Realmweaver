
import React, { useState, useEffect } from 'react';
import type { Note } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';

interface NoteEditorProps {
  note: Note;
  onUpdate: (id: string, updatedData: Partial<Note>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(note);
  const [isGenerating, setIsGenerating] = useState(false);

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
  }

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

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this note?`)) {
        onDelete(note.id);
    }
  }
  
  const handleAiGenerate = async () => {
    setIsGenerating(true);
    const context = `Note Title: ${formData.title}\nExisting Content: ${formData.content}`;
    const prompt = `Expand on the following note content. Be creative and detailed, but keep the style consistent with a campaign note:\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      setFormData(prev => ({ ...prev, content: prev.content + "\n\n" + result }));
      onUpdate(note.id, { content: formData.content + "\n\n" + result });
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.Notes className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Campaign Note</h1>
            </div>
            <p className="text-xs text-slate-500">Last modified: {new Date(note.lastModified).toLocaleString()}</p>
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
                placeholder="e.g., Plot, Idea, ToDo"
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
          onAiGenerate={handleAiGenerate}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
};
