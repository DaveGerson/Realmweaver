import React, { useState, useEffect } from 'react';
import type { SessionLog } from '../types';
import { Icons } from './Icons';
import { Button } from './common/Button';

interface SessionLogEditorProps {
  log: SessionLog;
  onUpdate: (id: string, updatedData: Partial<SessionLog>) => void;
  onDelete: (id: string) => void;
}

export const SessionLogEditor: React.FC<SessionLogEditorProps> = ({ log, onUpdate, onDelete }) => {
  const [formData, setFormData] = useState(log);

  useEffect(() => {
    setFormData(log);
  }, [log]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof SessionLog] !== log[e.target.name as keyof SessionLog]) {
        onUpdate(log.id, { [e.target.name]: e.target.value });
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newDate = new Date(value).toISOString();
    setFormData(prev => ({ ...prev, [name]: newDate }));
    onUpdate(log.id, { [name]: newDate });
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the log "${log.title}"? This action cannot be undone.`)) {
        onDelete(log.id);
    }
  }

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.SessionLog className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Session Log</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Log
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Log Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Session Date</label>
              <input
                type="date"
                name="sessionDate"
                value={new Date(formData.sessionDate).toISOString().split('T')[0]}
                onChange={handleDateChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Session Recap</label>
            <textarea name="recap" value={formData.recap} onChange={handleChange} onBlur={handleBlur} rows={8} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600" placeholder="A summary of what happened during the session." />
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Notable Events</label>
            <textarea name="notableEvents" value={formData.notableEvents} onChange={handleChange} onBlur={handleBlur} rows={5} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600" placeholder="- Player X discovered a secret...&#10;- NPC Y was defeated...&#10;- The party acquired the MacGuffin." />
        </div>

         <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">New Loose Ends & Plot Hooks</label>
            <textarea name="looseEnds" value={formData.looseEnds} onChange={handleChange} onBlur={handleBlur} rows={5} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600" placeholder="- What will the villain do in response?&#10;- Who owns the mysterious key they found?" />
        </div>
      </div>
    </div>
  );
};