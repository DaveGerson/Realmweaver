
import React, { useState, useMemo, Suspense } from 'react';
import type { Campaign, SessionLog } from '../../types/index';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultSession } from '../../utils/entityUtils';
// Lazy-loaded — only bundled when the prep wizard is opened
const SessionPrepWizard = React.lazy(() => import('../dialogs/SessionPrepWizard').then(m => ({ default: m.SessionPrepWizard })));
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

/** Parses a sessionDate defensively — a corrupted/empty stored value must not produce NaN and scramble sort order. */
function safeSessionTime(sessionDate: string): number {
  const t = new Date(sessionDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Returns a Tailwind color class for a completeness dot given a percentage 0-100. */
function completenessColor(pct: number): string {
  if (pct >= 67) return 'bg-green-500';
  if (pct >= 33) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Key fields for SessionLog completeness: title, prepNotes, recap, beats (>0). */
function sessionCompleteness(s: { title?: string; prepNotes?: string; recap?: string; beats?: any[] }): number {
  const checks = [!!(s.title?.trim()), !!(s.prepNotes?.trim()), !!(s.recap?.trim()), (s.beats?.length ?? 0) > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

interface SessionLogDashboardProps {
  campaign: Campaign;
  sessionLogs: SessionLog[];
  onSessionLogCreated: (data: Omit<SessionLog, 'id'>) => void;
  onSelectSessionLog: (id: string) => void;
  onGoLive: (sessionLogId: string) => void;
  isMockMode: boolean;
}

export const SessionLogDashboard: React.FC<SessionLogDashboardProps> = ({
  campaign,
  sessionLogs,
  onSessionLogCreated,
  onSelectSessionLog,
  onGoLive,
  isMockMode,
}) => {
  const [isPrepWizardOpen, setIsPrepWizardOpen] = useState(false);
  const { getRovingProps: getPlannedRovingProps } = useRovingTabIndex({ direction: 'vertical', columns: 1 });
  const { getRovingProps: getPastRovingProps } = useRovingTabIndex({ direction: 'vertical', columns: 1 });

  // SessionLog uses `title` not `name`. Normalize for useEntitySearch.
  const normalizedLogs = useMemo(
    () => sessionLogs.map(s => ({ ...s, name: s.title })),
    [sessionLogs],
  );

  const { filteredEntities: filteredNormalized, searchTerm, setSearchTerm } = useEntitySearch(
    normalizedLogs,
    ['name', 'prepNotes', 'recap'],
  );

  const filteredSessionLogs = useMemo(() => {
    const ids = new Set(filteredNormalized.map(s => s.id));
    return sessionLogs.filter(s => ids.has(s.id));
  }, [filteredNormalized, sessionLogs]);

  // The live-session guard must reflect reality regardless of the search term —
  // only the rendered planned/past lists should use the filtered array.
  const activeSession = sessionLogs.find(s => s.status === 'active');
  const plannedSessions = filteredSessionLogs.filter(s => s.status === 'planned').sort((a, b) => safeSessionTime(a.sessionDate) - safeSessionTime(b.sessionDate));
  const pastSessions = filteredSessionLogs.filter(s => s.status === 'completed').sort((a, b) => safeSessionTime(b.sessionDate) - safeSessionTime(a.sessionDate));

  const handleCreate = () => {
      const def = createDefaultSession();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...data } = def;
      onSessionLogCreated(data);
  };

  const handleWizardComplete = (sessionLogId: string) => {
      setIsPrepWizardOpen(false);
      onGoLive(sessionLogId);
  };

  return (
    <>
      <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
        <header className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold font-serif text-slate-100">Session Manager</h1>
              <p className="text-slate-400">Plan future games, run your current session, and archive the past.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search sessions..."
                    className="bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 w-48"
                  />
                </div>
                <Button
                    onClick={() => setIsPrepWizardOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/20"
                    disabled={!!activeSession}
                    title={activeSession ? 'A session is already live' : 'Open the Session Prep Wizard'}
                >
                    <Icons.Play className="w-4 h-4 mr-2" /> Prepare Session
                </Button>
                <Button onClick={handleCreate} variant="secondary">
                    <Icons.Plus className="w-4 h-4 mr-2" /> Quick Plan
                </Button>
            </div>
        </header>

        {/* 1. Active Session (Hero Card) */}
        {activeSession && (
            <div className="bg-amber-900/20 border border-amber-500/50 rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 animate-pulse"></div>
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live Now</span>
                            <h2 className="text-2xl font-bold text-white">{activeSession.title}</h2>
                        </div>
                        <p className="text-amber-200 mb-4 line-clamp-2">{activeSession.prepNotes || "No prep notes yet..."}</p>
                        <div className="flex gap-4 text-sm text-amber-300/70">
                            <span className="flex items-center gap-1"><Icons.Calendar className="w-3 h-3" /> {new Date(activeSession.sessionDate).toLocaleDateString()}</span>
                            {activeSession.plannedSceneIds.length > 0 && <span className="flex items-center gap-1"><Icons.Scenes className="w-3 h-3" /> {activeSession.plannedSceneIds.length} Scenes Planned</span>}
                        </div>
                    </div>
                    <Button size="lg" onClick={() => onSelectSessionLog(activeSession.id)} className="shadow-lg shadow-amber-500/20">
                        <Icons.Play className="w-5 h-5 mr-2" /> Continue Session
                    </Button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 2. Upcoming Sessions */}
            <div>
                <h3 className="text-lg font-bold font-serif text-slate-200 mb-4 flex items-center gap-2">
                    <Icons.Calendar className="w-5 h-5 text-amber-400" /> Upcoming & Planned
                </h3>
                <div className="space-y-3">
                    {plannedSessions.map((session, index) => {
                        const linkedAdventure = session.adventureId
                            ? campaign.adventures?.find(a => a.id === session.adventureId)
                            : undefined;
                        const beatCount = session.beats?.length ?? 0;
                        const pct = sessionCompleteness(session);
                        return (
                            <button
                                key={session.id}
                                onClick={() => onSelectSessionLog(session.id)}
                                className="card-parchment relative w-full text-left border border-slate-800 border-l-4 border-l-rose-500 hover:border-slate-700 hover:border-l-rose-400 p-4 rounded-lg transition-all group space-y-2"
                                {...getPlannedRovingProps(index)}
                            >
                                <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${completenessColor(pct)}`} title={`${pct}% complete`} />
                                <div className="flex justify-between items-start gap-2 pr-4">
                                    <span className="font-semibold text-slate-200 group-hover:text-amber-300 transition-colors leading-tight">{session.title}</span>
                                    <span className="flex-shrink-0 text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">{new Date(session.sessionDate).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">{session.prepNotes || 'No prep notes.'}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] bg-rose-900/30 text-rose-300 border border-rose-500/30 rounded-full px-2 py-0.5">Planned</span>
                                    {linkedAdventure && (
                                        <span className="text-[10px] bg-orange-900/30 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5 truncate max-w-[140px]">
                                            {linkedAdventure.title}
                                        </span>
                                    )}
                                    {beatCount > 0 && (
                                        <span className="text-[10px] text-slate-500">{beatCount} beats</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                    {plannedSessions.length === 0 && (
                        <div className="text-center py-8 bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                            {searchTerm ? (
                                <p className="text-slate-500 text-sm">No planned sessions match "{searchTerm}".</p>
                            ) : (
                                <>
                                    <p className="text-slate-500 text-sm">No future sessions planned.</p>
                                    <button
                                        onClick={() => setIsPrepWizardOpen(true)}
                                        className="mt-2 text-xs text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
                                    >
                                        Use the Prep Wizard to plan one
                                    </button>
                                </>
                            )}
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
                    {pastSessions.map((session, index) => {
                        const linkedAdventure = session.adventureId
                            ? campaign.adventures?.find(a => a.id === session.adventureId)
                            : undefined;
                        const pct = sessionCompleteness(session);
                        return (
                            <button
                                key={session.id}
                                onClick={() => onSelectSessionLog(session.id)}
                                className="relative w-full text-left bg-slate-900/30 border border-slate-800 border-l-4 border-l-rose-500/50 hover:border-slate-600 hover:border-l-rose-400 hover:bg-slate-800 p-4 rounded-lg transition-all opacity-80 hover:opacity-100 space-y-2"
                                {...getPastRovingProps(index)}
                            >
                                <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${completenessColor(pct)}`} title={`${pct}% complete`} />
                                <div className="flex justify-between items-start gap-2 pr-4">
                                    <span className="font-semibold text-slate-300 leading-tight">{session.title}</span>
                                    <span className="flex-shrink-0 text-xs text-slate-600">{new Date(session.sessionDate).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 italic">"{session.recap || 'No recap recorded.'}"</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] bg-slate-700/40 text-slate-400 border border-slate-600/30 rounded-full px-2 py-0.5">Completed</span>
                                    {linkedAdventure && (
                                        <span className="text-[10px] bg-orange-900/30 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5 truncate max-w-[140px]">
                                            {linkedAdventure.title}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                    {pastSessions.length === 0 && (
                        <div className="text-center py-8 bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                            <p className="text-slate-500 text-sm">
                                {searchTerm ? `No completed sessions match "${searchTerm}".` : 'No history recorded yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Session Prep Wizard */}
      {isPrepWizardOpen && (
          <Suspense fallback={null}>
              <SessionPrepWizard
                  campaign={campaign}
                  onComplete={handleWizardComplete}
                  onClose={() => setIsPrepWizardOpen(false)}
              />
          </Suspense>
      )}
    </>
  );
};
