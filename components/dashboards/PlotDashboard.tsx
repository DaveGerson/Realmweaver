
import React, { useState } from 'react';
import type { Plot } from '../../types/index';
import type { SessionLog } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { PlotTimeline } from '../visualizers/PlotTimeline';

interface PlotDashboardProps {
  plots: Plot[];
  sessionLogs: SessionLog[];
  onPlotCreated: (data: Omit<Plot, 'id'>) => void;
  onSelectPlot: (id: string) => void;
  onSelectSession?: (sessionId: string) => void;
}

const PlotCreator: React.FC<{ onPlotCreated: (data: Omit<Plot, 'id'>) => void; }> = ({ onPlotCreated }) => {
    const [title, setTitle] = useState('');

    const handleCreate = () => {
        if (!title.trim()) return;
        onPlotCreated({
            title,
            description: '',
            status: 'active',
            relatedEntityIds: []
        });
        setTitle('');
    };
    
    return (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-3">
                <Icons.Plus className="w-7 h-7 text-amber-400" />
                <h2 className="text-2xl font-bold font-serif text-slate-100">New Plot Arc</h2>
            </div>
            <p className="text-sm text-slate-400 flex-grow">
                Define a major storyline, mystery, or long-term goal for your campaign.
            </p>
            <div className="space-y-3">
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="e.g., The Return of the Lich King" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-600" />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={!title.trim()} size="lg" className="w-full mt-auto">
                Create Plot
            </Button>
        </div>
    )
}

export const PlotDashboard: React.FC<PlotDashboardProps> = ({ plots, sessionLogs, onPlotCreated, onSelectPlot, onSelectSession }) => {
  const activePlots = plots.filter(p => p.status === 'active');
  const resolvedPlots = plots.filter(p => p.status === 'resolved');
  const dormantPlots = plots.filter(p => p.status === 'dormant');
  const [timelineOpen, setTimelineOpen] = useState(true);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">

      {/* Plot Timeline — collapsible bird's-eye view */}
      <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-800/60 transition-colors"
          onClick={() => setTimelineOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <Icons.Plot className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-stone-200">Plot Timeline</span>
            <span className="text-xs text-stone-500 ml-1">
              {plots.length} {plots.length === 1 ? 'arc' : 'arcs'} &middot; {sessionLogs.length} {sessionLogs.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          {timelineOpen
            ? <Icons.ChevronUp className="w-4 h-4 text-stone-400" />
            : <Icons.ChevronDown className="w-4 h-4 text-stone-400" />
          }
        </button>
        {timelineOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-stone-800">
            <PlotTimeline
              plots={plots}
              sessionLogs={sessionLogs}
              onSelectPlot={onSelectPlot}
              onSelectSession={onSelectSession}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <PlotCreator onPlotCreated={onPlotCreated} />
        </div>
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Plots */}
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-200 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Active Arcs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePlots.map(plot => <PlotCard key={plot.id} plot={plot} onClick={() => onSelectPlot(plot.id)} />)}
                {activePlots.length === 0 && <p className="text-sm text-slate-500 italic col-span-2">No active plots running.</p>}
            </div>
          </div>

          {/* Dormant & Resolved (Smaller) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-bold font-serif text-slate-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-600"></span> Dormant / Backburner
                </h2>
                <div className="space-y-2">
                    {dormantPlots.map(plot => <PlotCard key={plot.id} plot={plot} onClick={() => onSelectPlot(plot.id)} compact />)}
                    {dormantPlots.length === 0 && <p className="text-xs text-slate-600 italic">No dormant plots.</p>}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold font-serif text-slate-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-900"></span> Resolved History
                </h2>
                <div className="space-y-2">
                    {resolvedPlots.map(plot => <PlotCard key={plot.id} plot={plot} onClick={() => onSelectPlot(plot.id)} compact />)}
                    {resolvedPlots.length === 0 && <p className="text-xs text-slate-600 italic">No resolved plots yet.</p>}
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

interface PlotCardProps {
    plot: Plot;
    onClick: () => void;
    compact?: boolean;
}

const PlotCard: React.FC<PlotCardProps> = ({ plot, onClick, compact }) => (
    <button 
        onClick={onClick}
        className={`w-full bg-slate-900/50 border border-slate-800 border-l-4 border-l-yellow-500 p-4 rounded-lg hover:bg-slate-800 hover:border-slate-700 hover:border-l-yellow-400 transition-all text-left flex flex-col group relative ${compact ? 'py-3' : 'h-32'}`}
    >
        <div className="flex justify-between items-start w-full mb-1">
                <h3 className={`font-semibold text-slate-200 truncate pr-2 ${compact ? 'text-sm' : 'text-lg'}`}>{plot.title}</h3>
                {!compact && <Icons.Target className="w-5 h-5 text-yellow-500/50 flex-shrink-0" />}
        </div>
        {!compact && (
            <p className="text-sm text-slate-400 line-clamp-2 flex-grow">{plot.description || <span className="italic opacity-50">No description...</span>}</p>
        )}
        <div className="mt-2 flex gap-2 overflow-hidden">
            {(plot.relatedEntityIds || []).length > 0 && (
                <span className="text-[10px] bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {plot.relatedEntityIds.length} Linked Entities
                </span>
            )}
        </div>
    </button>
)
