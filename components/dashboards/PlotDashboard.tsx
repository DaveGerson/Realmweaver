
import React, { useState, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const filteredPlots = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return plots;
    return plots.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [plots, searchTerm]);

  const activePlots = filteredPlots.filter(p => p.status === 'active');
  const resolvedPlots = filteredPlots.filter(p => p.status === 'resolved');
  const dormantPlots = filteredPlots.filter(p => p.status === 'dormant');
  const [timelineOpen, setTimelineOpen] = useState(true);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">

      {/* Plot Timeline — collapsible bird's-eye view */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/60 transition-colors"
          onClick={() => setTimelineOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <Icons.Plot className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-200">Plot Timeline</span>
            <span className="text-xs text-slate-500 ml-1">
              {plots.length} {plots.length === 1 ? 'arc' : 'arcs'} &middot; {sessionLogs.length} {sessionLogs.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          {timelineOpen
            ? <Icons.ChevronUp className="w-4 h-4 text-slate-400" />
            : <Icons.ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>
        {timelineOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-800">
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

          {/* Search */}
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search plots..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {searchTerm && filteredPlots.length === 0 && (
            <div className="text-center py-6">
              <Icons.Search className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              <p className="text-slate-400">No plots match "{searchTerm}"</p>
            </div>
          )}

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
                    <span className="w-2 h-2 rounded-full bg-amber-900"></span> Resolved History
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

const PLOT_STATUS_STYLES: Record<string, string> = {
    active: 'bg-green-900/40 text-green-300 border-green-500/30',
    dormant: 'bg-slate-700/60 text-slate-400 border-slate-600/30',
    resolved: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
};

const PlotCard: React.FC<PlotCardProps> = ({ plot, onClick, compact }) => {
    const statusStyle = PLOT_STATUS_STYLES[plot.status] ?? PLOT_STATUS_STYLES['active'];
    const descSnippet = plot.description ? plot.description.slice(0, 100) + (plot.description.length > 100 ? '…' : '') : '';
    return (
        <button
            onClick={onClick}
            className={`card-parchment w-full border border-slate-800 border-l-4 border-l-yellow-500 p-4 rounded-lg hover:border-slate-700 hover:border-l-yellow-400 transition-all text-left flex flex-col group relative space-y-2 ${compact ? 'py-3' : ''}`}
        >
            <div className="flex justify-between items-start w-full gap-2">
                <h3 className={`font-semibold text-slate-200 truncate pr-1 ${compact ? 'text-sm' : 'text-base'}`}>{plot.title}</h3>
                <span className={`flex-shrink-0 text-[10px] border rounded-full px-2 py-0.5 capitalize ${statusStyle}`}>
                    {plot.status}
                </span>
            </div>
            {!compact && descSnippet && (
                <p className="text-xs text-slate-400 line-clamp-2">{descSnippet}</p>
            )}
            {!compact && !descSnippet && (
                <p className="text-xs text-slate-600 italic">No description...</p>
            )}
            <div className="flex gap-2 overflow-hidden">
                {(plot.relatedEntityIds || []).length > 0 && (
                    <span className="text-[10px] bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {plot.relatedEntityIds.length} Linked {plot.relatedEntityIds.length === 1 ? 'Entity' : 'Entities'}
                    </span>
                )}
            </div>
        </button>
    );
}
