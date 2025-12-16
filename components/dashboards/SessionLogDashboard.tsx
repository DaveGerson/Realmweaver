
import React, { useState } from 'react';
import type { SessionLog } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultSession } from '../../utils/entityUtils';

interface SessionLogDashboardProps {
  sessionLogs: SessionLog[];
  onSessionLogCreated: (data: Omit<SessionLog, 'id'>) => void;
  onSelectSessionLog: (id: string) => void;
}

export const SessionLogDashboard: React.FC<SessionLogDashboardProps> = ({ sessionLogs, onSessionLogCreated, onSelectSessionLog }) => {
  const activeSession = sessionLogs.find(s => s.status === 'active');
  const plannedSessions = sessionLogs.filter(s => s.status === 'planned').sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
  const pastSessions = sessionLogs.filter(s => s.status === 'completed').sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

  const handleCreate = () => {
      const def = createDefaultSession();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...data } = def;
      onSessionLogCreated(data);
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-serif text-slate-100">Session Manager</h1>
            <p className="text-slate-400">Plan future games, run your current session, and archive the past.</p>
          </div>
          <Button onClick={handleCreate}>
              <Icons.Plus className="w-4 h-4 mr-2" /> Plan New Session
          </Button>
      </header>

      {/* 1. Active Session (Hero Card) */}
      {activeSession && (
          <div className="bg-indigo-900/20 border border-indigo-500/50 rounded-xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 animate-pulse"></div>
              <div className="flex justify-between items-start relative z-10">
                  <div>
                      <div className="flex items-center gap-2 mb-2">
                          <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live Now</span>
                          <h2 className="text-2xl font-bold text-white">{activeSession.title}</h2>
                      </div>
                      <p className="text-indigo-200 mb-4 line-clamp-2">{activeSession.prepNotes || "No prep notes yet..."}</p>
                      <div className="flex gap-4 text-sm text-indigo-300/70">
                          <span className="flex items-center gap-1"><Icons.Calendar className="w-3 h-3" /> {new Date(activeSession.sessionDate).toLocaleDateString()}</span>
                          {activeSession.plannedSceneIds.length > 0 && <span className="flex items-center gap-1"><Icons.Scenes className="w-3 h-3" /> {activeSession.plannedSceneIds.length} Scenes Planned</span>}
                      </div>
                  </div>
                  <Button size="lg" onClick={() => onSelectSessionLog(activeSession.id)} className="shadow-lg shadow-indigo-500/20">
                      <Icons.Play className="w-5 h-5 mr-2" /> Continue Session
                  </Button>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 2. Upcoming Sessions */}
          <div>
              <h3 className="text-lg font-bold font-serif text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.Calendar className="w-5 h-5 text-indigo-400" /> Upcoming & Planned
              </h3>
              <div className="space-y-3">
                  {plannedSessions.map(session => (
                      <button 
                          key={session.id}
                          onClick={() => onSelectSessionLog(session.id)}
                          className="w-full text-left bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 p-4 rounded-lg transition-all group"
                      >
                          <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{session.title}</span>
                              <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">{new Date(session.sessionDate).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-1">{session.prepNotes || "No prep notes."}</p>
                      </button>
                  ))}
                  {plannedSessions.length === 0 && (
                      <div className="text-center py-8 bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                          <p className="text-slate-500 text-sm">No future sessions planned.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* 3. Past Sessions */}
          <div>
              <h3 className="text-lg font-bold font-serif text-slate-200 mb-4 flex items-center gap-2">
                  <Icons.BookCopy className="w-5 h-5 text-slate-500" /> Session Chronicle
              </h3>
              <div className="space-y-3">
                  {pastSessions.map(session => (
                      <button 
                          key={session.id}
                          onClick={() => onSelectSessionLog(session.id)}
                          className="w-full text-left bg-slate-900/30 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 p-4 rounded-lg transition-all opacity-80 hover:opacity-100"
                      >
                          <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-300">{session.title}</span>
                              <span className="text-xs text-slate-600">{new Date(session.sessionDate).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 italic">"{session.recap || "No recap recorded."}"</p>
                      </button>
                  ))}
                   {pastSessions.length === 0 && (
                      <div className="text-center py-8 bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                          <p className="text-slate-500 text-sm">No history recorded yet.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
