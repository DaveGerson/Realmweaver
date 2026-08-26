// components/views/TonightsTable.tsx
//
// Tonight's Table (design: docs/design/storyteller-first-design.md, P1) — the
// story-first campaign home. It answers "what matters tonight?" instead of
// "what data exists?", with zero clicks and zero upkeep: four derived panels
// over shipped campaign data, and one button into the Session Prep Wizard.
//
// Copy rules (docs/design/schema-presentation-guide.md): second person,
// present tense, plain verbs, no data-modeling words, no exclamation marks, no
// emoji. Empty states are invitations that point at what the GM could write
// next — never a report of missing rows. Entity accents come from
// ENTITY_TYPE_CONFIG only; secrets have no accent and must not be given one.

import React, { Suspense, useMemo, useState } from 'react';
import type { Campaign } from '../../types/index';
import { Button } from '../common/Button';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';
import {
  getLastCompletedSession,
  deriveNpcLastAppearances,
  derivePlotThreadAges,
  deriveLoadedGuns,
  formatLastSeenLabel,
  formatThreadAgeLabel,
} from '../../utils/storyDerivations';

// Lazy-loaded — same mechanism SessionLogDashboard uses to open the wizard;
// only bundled once the GM actually asks for it.
const SessionPrepWizard = React.lazy(() =>
  import('@/components/dialogs/SessionPrepWizard').then((m) => ({ default: m.SessionPrepWizard }))
);

/** The offstage panel caps at six rows so it stays readable at a glance. */
const OFFSTAGE_LIMIT = 6;

export interface TonightsTableProps {
  campaign: Campaign;
  /** Entity-link navigation, same signature as every editor's `onNavigate`. */
  onNavigate: (entityType: string, entityId: string) => void;
  /** Handed the new session log id when the Session Prep Wizard finishes. */
  onGoLive: (sessionLogId: string) => void;
}

/**
 * Resolves a secret's linked id to a display name, wherever it lives — a
 * secret can point at an NPC, a location, a faction, an item, or a plot.
 */
function resolveLinkedEntityName(campaign: Campaign, id: string): string | null {
  return (
    campaign.npcs.find((n) => n.id === id)?.name ??
    campaign.locations.find((l) => l.id === id)?.name ??
    campaign.factions.find((f) => f.id === id)?.name ??
    campaign.items.find((i) => i.id === id)?.name ??
    (campaign.plots ?? []).find((p) => p.id === id)?.title ??
    null
  );
}

export const TonightsTable: React.FC<TonightsTableProps> = ({ campaign, onNavigate, onGoLive }) => {
  const [isPrepOpen, setIsPrepOpen] = useState(false);

  const lastCompleted = useMemo(() => getLastCompletedSession(campaign), [campaign]);
  const openThreads = useMemo(() => derivePlotThreadAges(campaign), [campaign]);
  const offstage = useMemo(
    () => deriveNpcLastAppearances(campaign).slice(0, OFFSTAGE_LIMIT),
    [campaign]
  );
  const loadedGuns = useMemo(() => deriveLoadedGuns(campaign), [campaign]);

  // Same live-session check the Session Manager's "Prepare Session" button
  // uses: prefer the explicit activeSessionId, fall back to status==='active'.
  const liveSession = campaign.activeSessionId
    ? campaign.sessionLogs?.find((s) => s.id === campaign.activeSessionId)
    : campaign.sessionLogs?.find((s) => s.status === 'active');
  const isSessionLive = !!liveSession;

  const plotAccent = ENTITY_TYPE_CONFIG.plot.color;
  const npcAccent = ENTITY_TYPE_CONFIG.npc.color;

  const handleWizardComplete = (sessionLogId: string) => {
    setIsPrepOpen(false);
    onGoLive(sessionLogId);
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl font-bold font-serif text-slate-100">Tonight's Table</h1>
        <p className="text-slate-400">Everything the table is waiting on, gathered in one place.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Previously on */}
        <section
          role="region"
          aria-labelledby="tt-previously-on"
          className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3"
        >
          <h2 id="tt-previously-on" className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Previously on
          </h2>
          {!lastCompleted ? (
            <p className="text-sm text-slate-400 italic">
              Your table hasn't sat down yet. Prep tonight's session and the story starts here.
            </p>
          ) : !(lastCompleted.recap ?? '').trim() && !(lastCompleted.looseEnds ?? '').trim() ? (
            <p className="text-sm text-slate-400 italic">
              Last session ended without a word written down. Jot the recap in the session log and it will greet you here next time.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wide">{lastCompleted.title}</p>
              {(lastCompleted.recap ?? '').trim() && (
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{lastCompleted.recap}</p>
              )}
              {(lastCompleted.looseEnds ?? '').trim() && (
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{lastCompleted.looseEnds}</p>
              )}
            </div>
          )}
        </section>

        {/* Open threads */}
        <section
          role="region"
          aria-labelledby="tt-open-threads"
          className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3"
        >
          <h2 id="tt-open-threads" className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Open threads
          </h2>
          {openThreads.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              Nothing is pulling at the party yet. Open a thread when a question starts to itch.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {openThreads.map((thread) => (
                <li key={thread.plotId}>
                  <button
                    onClick={() => onNavigate('plot', thread.plotId)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 transition-colors"
                  >
                    <span className={`block font-medium text-${plotAccent}-400`}>{thread.plotTitle}</span>
                    <span className="block text-xs text-slate-500">{formatThreadAgeLabel(thread)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Who's been offstage */}
        <section
          role="region"
          aria-labelledby="tt-offstage"
          className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3"
        >
          <h2 id="tt-offstage" className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Who's been offstage
          </h2>
          {offstage.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No one lives here yet. Who does the party meet first?</p>
          ) : (
            <ul className="space-y-1.5">
              {offstage.map((appearance) => (
                <li key={appearance.npcId}>
                  <button
                    onClick={() => onNavigate('npc', appearance.npcId)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 transition-colors"
                  >
                    <span className={`block font-medium text-${npcAccent}-400`}>{appearance.npcName}</span>
                    <span className="block text-xs text-slate-500">{formatLastSeenLabel(appearance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Loaded guns */}
        <section
          role="region"
          aria-labelledby="tt-loaded-guns"
          className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3"
        >
          <h2 id="tt-loaded-guns" className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Loaded guns
          </h2>
          {loadedGuns.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              Nothing is primed yet. Plant a secret near someone the party is about to meet.
            </p>
          ) : (
            <ul className="space-y-2">
              {loadedGuns.map((gun) => {
                const names = gun.triggeringEntityIds
                  .map((id) => resolveLinkedEntityName(campaign, id))
                  .filter((n): n is string => !!n);
                return (
                  <li key={gun.secretId} className="px-3 py-2 rounded-lg bg-slate-900/40">
                    <p className="font-medium text-slate-200">{gun.secretTitle}</p>
                    {names.length > 0 && <p className="text-xs text-slate-500">Points at {names.join(', ')}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div>
        <Button
          onClick={() => setIsPrepOpen(true)}
          disabled={isSessionLive}
          title={isSessionLive ? 'A session is already live' : undefined}
          size="lg"
        >
          Prep tonight's session
        </Button>
      </div>

      {isPrepOpen && (
        <Suspense fallback={null}>
          <SessionPrepWizard campaign={campaign} onComplete={handleWizardComplete} onClose={() => setIsPrepOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};
