
import React, { useState, useCallback } from 'react';
import type { Campaign } from '../../types/index';
import type { WorldEvent } from '../../services/ai/worldSimulation';
import { generateWorldEvents } from '../../services/aiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { campaignService } from '../../services/campaignService';
import { twMerge } from 'tailwind-merge';
import { DialogShell } from '../common/DialogShell';

interface WorldSimulationWizardProps {
  campaign: Campaign;
  isMockMode: boolean;
  onClose: () => void;
  onApplyEvents: (events: WorldEvent[]) => void;
}

type WizardStep = 'setup' | 'loading' | 'review' | 'applied';

const DAYS_LABELS: Array<{ days: number; label: string }> = [
  { days: 1, label: '1 day' },
  { days: 3, label: 'A few days' },
  { days: 7, label: 'A week' },
  { days: 14, label: 'Two weeks' },
  { days: 30, label: 'A month' },
  { days: 60, label: 'Two months' },
  { days: 90, label: 'Three months' },
  { days: 180, label: 'Six months' },
];

const SEVERITY_CONFIG = {
  minor: { label: 'Minor', classes: 'bg-blue-900/40 text-blue-300 border border-blue-700/50' },
  major: { label: 'Major', classes: 'bg-amber-900/40 text-amber-300 border border-amber-700/50' },
  critical: { label: 'Critical', classes: 'bg-red-900/40 text-red-300 border border-red-700/50' },
};

const CATEGORY_CONFIG: Record<string, { label: string; classes: string }> = {
  faction: { label: 'Faction', classes: 'bg-purple-900/40 text-purple-300' },
  npc: { label: 'NPC', classes: 'bg-green-900/40 text-green-300' },
  location: { label: 'Location', classes: 'bg-cyan-900/40 text-cyan-300' },
  plot: { label: 'Plot', classes: 'bg-orange-900/40 text-orange-300' },
  world: { label: 'World', classes: 'bg-slate-700/60 text-slate-300' },
};

// Resolve entity name from campaign data by ID and type
function resolveEntityName(campaign: Campaign, entityId: string, entityType: string): string {
  switch (entityType) {
    case 'npc':
      return campaign.npcs.find(e => e.id === entityId)?.name ?? entityId;
    case 'faction':
      return campaign.factions.find(e => e.id === entityId)?.name ?? entityId;
    case 'location':
      return campaign.locations.find(e => e.id === entityId)?.name ?? entityId;
    case 'plot':
      return campaign.plots?.find(e => e.id === entityId)?.title ?? entityId;
    case 'adventure':
      return campaign.adventures.find(e => e.id === entityId)?.title ?? entityId;
    default:
      return entityId;
  }
}

// Apply a list of approved events to the campaign via campaignService
function applyWorldEventsToCampaign(events: WorldEvent[]): void {
  for (const event of events) {
    for (const update of event.suggestedUpdates) {
      switch (update.entityType) {
        case 'npc':
          campaignService.updateNpc(update.entityId, { [update.field]: update.proposedValue });
          break;
        case 'faction':
          campaignService.updateFaction(update.entityId, { [update.field]: update.proposedValue });
          break;
        case 'location':
          campaignService.updateLocation(update.entityId, { [update.field]: update.proposedValue });
          break;
        case 'plot':
          campaignService.updatePlot(update.entityId, { [update.field]: update.proposedValue });
          break;
        case 'adventure':
          campaignService.updateAdventure(update.entityId, { [update.field]: update.proposedValue });
          break;
        default:
          console.warn(`[WorldSim] Unknown entityType for update: ${update.entityType}`);
      }
    }
  }
}

export const WorldSimulationWizard: React.FC<WorldSimulationWizardProps> = ({
  campaign,
  isMockMode,
  onClose,
  onApplyEvents,
}) => {
  const [step, setStep] = useState<WizardStep>('setup');
  const [daysPassed, setDaysPassed] = useState(7);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  // Tracks which (eventId, updateIndex) pairs have been expanded beyond 3 lines
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  // Cancellation ref — set to true when the user cancels mid-generation
  const cancelledRef = React.useRef(false);

  const selectedLabel =
    DAYS_LABELS.reduce((best, opt) => {
      if (Math.abs(opt.days - daysPassed) < Math.abs(best.days - daysPassed)) return opt;
      return best;
    }, DAYS_LABELS[0]).label;

  const handleSimulate = useCallback(async () => {
    cancelledRef.current = false;
    setStep('loading');
    setError(null);
    try {
      const result = await generateWorldEvents(campaign, daysPassed, isMockMode);
      // If the user cancelled while the promise was in-flight, discard the result
      if (cancelledRef.current) return;
      setEvents(result);
      // Default: all events approved
      setApprovedIds(new Set(result.map(e => e.id)));
      setStep('review');
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setStep('setup');
    }
  }, [campaign, daysPassed, isMockMode]);

  const handleCancelGeneration = useCallback(() => {
    cancelledRef.current = true;
    setStep('setup');
  }, []);

  const toggleApproval = (id: string) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleUpdateExpanded = (key: string) => {
    setExpandedUpdates(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleApply = () => {
    const approved = events.filter(e => approvedIds.has(e.id));
    applyWorldEventsToCampaign(approved);
    setAppliedCount(approved.length);
    onApplyEvents(approved);
    setStep('applied');
  };

  const approvedCount = events.filter(e => approvedIds.has(e.id)).length;

  return (
    <DialogShell isOpen={true} onClose={onClose} ariaLabel="World Simulation Wizard" className="w-full max-w-2xl mx-2 sm:mx-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icons.WorldSim className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">World Simulation</h2>
            {step !== 'setup' && (
              <span className="text-sm text-slate-400">
                {step === 'loading' ? 'Generating...' : step === 'review' ? `${events.length} event${events.length !== 1 ? 's' : ''}` : 'Applied'}
              </span>
            )}
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100"
            aria-label="Close"
          >
            <Icons.X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

          {/* Step: Setup */}
          {step === 'setup' && (
            <div className="space-y-6">
              <div>
                <p className="text-slate-300 text-sm leading-relaxed mb-1">
                  Let the world move while your players were away. Set how much time has passed and the AI will generate plausible off-screen events based on your factions, NPCs, and unresolved plots.
                </p>
                {campaign.factions.length === 0 && campaign.npcs.length === 0 && (
                  <p className="mt-2 text-amber-400 text-xs bg-amber-900/20 border border-amber-700/40 rounded p-2">
                    Your campaign has no factions or NPCs yet. Events will be more generic. Add some entities first for richer results.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-200 font-semibold mb-3 text-sm">
                  Time elapsed since last session
                </label>

                {/* Preset quick-pick buttons — replaces the misleading linear slider */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {DAYS_LABELS.map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => setDaysPassed(opt.days)}
                      className={twMerge(
                        'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                        daysPassed === opt.days
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-600 hover:text-amber-300'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <span className="inline-block bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-amber-300 font-semibold text-sm">
                    {selectedLabel} ({daysPassed} {daysPassed === 1 ? 'day' : 'days'})
                  </span>
                </div>
              </div>

              {error && (
                <div className="text-red-400 bg-red-900/20 border border-red-700/40 rounded p-3 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <Icons.WorldSim className="w-12 h-12 text-amber-400/30" />
                <Icons.Loader className="w-6 h-6 text-amber-400 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-slate-300 text-sm font-medium">Simulating what happened in your world...</p>
              <p className="text-slate-500 text-xs text-center max-w-xs">
                Analyzing faction goals, NPC motivations, and unresolved threads to generate plausible off-screen events.
              </p>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Review the events that occurred while your players were away. Approve the ones you want to apply to your campaign, and reject the ones that don't fit.
              </p>

              {events.length === 0 && (
                <p className="text-slate-500 text-sm italic text-center py-8">
                  The AI returned no events. Try adding more factions and NPCs with goals, then simulate again.
                </p>
              )}

              <div className="space-y-3">
                {events.map(event => {
                  const isApproved = approvedIds.has(event.id);
                  const severityCfg = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.minor;
                  const categoryCfg = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.world;

                  return (
                    <div
                      key={event.id}
                      className={twMerge(
                        'border rounded-lg p-4 transition-all',
                        isApproved
                          ? 'border-slate-600 bg-slate-800/50'
                          : 'border-slate-700/50 bg-slate-800/20 opacity-60'
                      )}
                    >
                      {/* Event header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={twMerge('px-2 py-0.5 rounded-full text-xs font-semibold', severityCfg.classes)}>
                              {severityCfg.label}
                            </span>
                            <span className={twMerge('px-2 py-0.5 rounded-full text-xs', categoryCfg.classes)}>
                              {categoryCfg.label}
                            </span>
                          </div>
                          <h3 className="text-slate-100 font-semibold text-sm leading-snug">{event.title}</h3>
                        </div>

                        {/* Approve / Reject toggle */}
                        <button
                          onClick={() => toggleApproval(event.id)}
                          className={twMerge(
                            'flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium border transition-colors',
                            isApproved
                              ? 'bg-green-900/40 border-green-700/60 text-green-300 hover:bg-red-900/40 hover:border-red-700/60 hover:text-red-300'
                              : 'bg-red-900/30 border-red-700/50 text-red-400 hover:bg-green-900/40 hover:border-green-700/60 hover:text-green-300'
                          )}
                          aria-pressed={isApproved}
                        >
                          {isApproved ? 'Approved' : 'Rejected'}
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-slate-300 text-sm leading-relaxed mb-3">{event.description}</p>

                      {/* Affected entities */}
                      {event.affectedEntityIds.length > 0 && (
                        <div className="mb-3">
                          <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Affects: </span>
                          {event.affectedEntityIds.map((id, idx) => (
                            <span key={id} className="text-slate-300 text-xs">
                              {resolveEntityName(campaign, id, event.affectedEntityTypes[idx] ?? '')}
                              {idx < event.affectedEntityIds.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Proposed changes */}
                      {event.suggestedUpdates.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-slate-500 text-xs uppercase tracking-wide font-medium">Proposed Changes</p>
                          {event.suggestedUpdates.map((upd, idx) => {
                            const entityName = resolveEntityName(campaign, upd.entityId, upd.entityType);
                            const updateKey = `${event.id}-${idx}`;
                            const isExpanded = expandedUpdates.has(updateKey);
                            return (
                              <div key={idx} className="bg-slate-900/60 border border-slate-700/50 rounded p-2.5 text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="font-semibold text-slate-300">{entityName}</span>
                                  <span>—</span>
                                  <span className="italic capitalize">{upd.field}</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1 bg-red-950/30 border border-red-800/30 rounded p-2">
                                    <p className="text-red-400 text-[10px] font-semibold mb-0.5 uppercase tracking-wide">Before</p>
                                    <p className={twMerge('text-slate-400 leading-relaxed', !isExpanded && 'line-clamp-3')}>
                                      {upd.currentValue || '(empty)'}
                                    </p>
                                  </div>
                                  <div className="flex items-center flex-shrink-0 text-slate-500">
                                    <Icons.ChevronRight className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 bg-green-950/30 border border-green-800/30 rounded p-2">
                                    <p className="text-green-400 text-[10px] font-semibold mb-0.5 uppercase tracking-wide">After</p>
                                    <p className={twMerge('text-slate-300 leading-relaxed', !isExpanded && 'line-clamp-3')}>
                                      {upd.proposedValue}
                                    </p>
                                  </div>
                                </div>
                                {/* Show more / Show less toggle */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleUpdateExpanded(updateKey)}
                                  className="text-[10px] text-slate-500 hover:text-amber-400 mt-0.5 px-0 py-0"
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step: Applied */}
          {step === 'applied' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="w-12 h-12 bg-green-900/40 border border-green-700/50 rounded-full flex items-center justify-center">
                <Icons.CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-slate-100 font-semibold text-lg">World Updated</p>
                <p className="text-slate-400 text-sm mt-1">
                  {appliedCount === 0
                    ? 'No events were applied.'
                    : `${appliedCount} event${appliedCount !== 1 ? 's' : ''} applied to your campaign.`}
                </p>
              </div>
              <p className="text-slate-500 text-xs max-w-xs">
                The affected entities have been updated to reflect the time that has passed. Your players will discover these changes through play.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-700 flex-shrink-0">
          {step === 'setup' && (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSimulate} disabled={false}>
                <Icons.WorldSim className="w-4 h-4 mr-1.5" />
                Simulate World
              </Button>
            </>
          )}

          {step === 'loading' && (
            <>
              <div className="flex-1 text-center text-slate-500 text-sm">Please wait...</div>
              <Button variant="ghost" onClick={handleCancelGeneration}>
                Cancel
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={() => setStep('setup')}>
                <Icons.ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs hidden sm:inline">
                  {approvedCount} of {events.length} approved
                </span>
                <Button
                  variant="primary"
                  onClick={handleApply}
                  disabled={approvedCount === 0}
                >
                  <Icons.Check className="w-4 h-4 mr-1.5" />
                  Apply {approvedCount > 0 ? `${approvedCount} ` : ''}Event{approvedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}

          {step === 'applied' && (
            <div className="flex-1 flex justify-end">
              <Button variant="primary" onClick={onClose}>Done</Button>
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
};
