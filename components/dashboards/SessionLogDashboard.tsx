import React, { useState } from 'react';
import type { SessionLog } from '../../types';
import { Icons } from '../Icons';
import { Button } from '../common/Button';

interface SessionLogDashboardProps {
  sessionLogs: SessionLog[];
  onSessionLogCreated: (data: Omit<SessionLog, 'id'>) => void;
  onSelectSessionLog: (id: string) => void;
}

const SessionLogCreator: React.FC<{ onSessionLogCreated: (data: Omit<SessionLog, 'id'>) => void; }> = ({ onSessionLogCreated }) => {
    const [title, setTitle] = useState('');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

    const handleCreate = () => {
        if (!title.trim()) return;
        onSessionLogCreated({
            title,
            sessionDate: new Date(sessionDate).toISOString(),
            recap: '',
            notableEvents: '',
            looseEnds: '',
        });
        setTitle('');
        setSessionDate(new Date().toISOString().split('T')[0]);
    };
    
    return (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-3">
                <Icons.Plus className="w-7 h-7 text-indigo-400" />
                <h2 className="text-2xl font-bold font-serif text-slate-100">New Session Log</h2>
            </div>
            <p className="text-sm text-slate-400 flex-grow">
                Create a new log to record the events of a game session.
            </p>
            <div className="space-y-3">
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Session 5: The Heist" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-600" />
                </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
                    <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={!title.trim()} size="lg" className="w-full mt-auto">
                Create Log
            </Button>
        </div>
    )
}


export const SessionLogDashboard: React.FC<SessionLogDashboardProps> = ({ sessionLogs, onSessionLogCreated, onSelectSessionLog }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <SessionLogCreator onSessionLogCreated={onSessionLogCreated} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Past Sessions</h2>
          <div className="space-y-3">
            {sessionLogs.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()).map(log => (
              <button 
                key={log.id} 
                onClick={() => onSelectSessionLog(log.id)}
                className="w-full bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all flex justify-between items-center"
              >
                <div>
                    <h3 className="font-semibold text-indigo-400">{log.title}</h3>
                    <p className="text-sm text-slate-400 line-clamp-1">{log.recap || "No recap yet."}</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                    {new Date(log.sessionDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </button>
            ))}
            {sessionLogs.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.SessionLog className="w-12 h-12 mx-auto mb-2" />
                    <p>No session logs created yet. Use the form to start one!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};