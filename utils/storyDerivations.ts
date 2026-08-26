// utils/storyDerivations.ts
//
// Shared, pure story-shape derivations over a Campaign. Nothing here holds
// state, touches the store, or reads the clock — every function is safe to
// call inside a `useMemo`. Time is measured in **session ordinals**, never in
// dates: "last seen 3 sessions ago" is the unit a GM actually thinks in.
//
// Consumed first by `components/views/TonightsTable.tsx` (P1); P2's Callback
// Machine sampler and P6's story-health checks reuse the same functions.

import type { Campaign, SessionLog, Scene, Secret } from '../types/index';

/** A played session, reduced to what a story-age label needs. */
export interface SessionRef {
  id: string;
  title: string;
  sessionDate: string;
  /** 1-based position in the campaign's played-session order (oldest = 1). */
  ordinal: number;
}

/** Where one NPC stands relative to the table's attention. */
export interface NpcLastAppearance {
  npcId: string;
  npcName: string;
  /** The most recent played session this NPC was on stage in; null if never. */
  lastSeen: SessionRef | null;
  /** Played sessions since `lastSeen` (0 = the most recent one); null if never seen. */
  sessionsSinceSeen: number | null;
}

/** How long an open thread has been sitting still. */
export interface PlotThreadAge {
  plotId: string;
  plotTitle: string;
  /** The most recent played session that moved this thread; null if none did. */
  lastAdvanced: SessionRef | null;
  /** Played sessions since `lastAdvanced` (0 = the most recent one); null if never advanced. */
  sessionsSinceAdvanced: number | null;
  /**
   * Sort key for "stalest first". Equals `sessionsSinceAdvanced` when the
   * thread has ever advanced; otherwise the total number of played sessions —
   * a thread that has never moved has been sitting still for all of them.
   */
  sessionsStale: number;
}

/** Why an unrevealed secret is primed right now. */
export type LoadedGunReason = 'planned' | 'recent';

/** An unrevealed secret pointing at something about to be — or just — on stage. */
export interface LoadedGun {
  secretId: string;
  secretTitle: string;
  category: Secret['category'];
  /** The secret's own linked ids that are on stage, in the secret's order. */
  triggeringEntityIds: string[];
  reason: LoadedGunReason;
}

/**
 * Parses a `sessionDate` defensively. A blank or unparseable date sorts as
 * the epoch (earliest) rather than producing NaN and scrambling the order —
 * mirrors `SessionLogDashboard`'s `safeSessionTime`.
 */
function parseSessionDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Sorts sessions oldest-first by `sessionDate`, breaking ties by the
 * session's original position in `sessions` (a stable sort by hand, so
 * behaviour never depends on the engine's sort-stability guarantees).
 */
function sortSessionsByDate(sessions: SessionLog[]): SessionLog[] {
  return sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => {
      const diff = parseSessionDate(a.session.sessionDate) - parseSessionDate(b.session.sessionDate);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ session }) => session);
}

/**
 * Sessions the table has actually sat down for — `completed` and `active` —
 * oldest first by `sessionDate`. An unparseable or empty date sorts as the
 * epoch (earliest) rather than scrambling the order with NaN. Ties keep the
 * campaign array's own order. `planned` sessions are excluded: they have not
 * happened yet.
 */
export function getPlayedSessionsInOrder(campaign: Campaign): SessionLog[] {
  const played = (campaign.sessionLogs ?? []).filter(
    (s) => s.status === 'completed' || s.status === 'active'
  );
  return sortSessionsByDate(played);
}

/**
 * The newest `completed` session, or null. A live (`active`) session is
 * deliberately ignored — its recap has not been written yet.
 */
export function getLastCompletedSession(campaign: Campaign): SessionLog | null {
  const completed = (campaign.sessionLogs ?? []).filter((s) => s.status === 'completed');
  if (completed.length === 0) return null;
  const ordered = sortSessionsByDate(completed);
  return ordered[ordered.length - 1];
}

/** Finds a scene by id across every adventure in the campaign. */
function findSceneById(campaign: Campaign, sceneId: string): Scene | undefined {
  for (const adventure of campaign.adventures ?? []) {
    const scene = adventure.scenes?.find((s) => s.id === sceneId);
    if (scene) return scene;
  }
  return undefined;
}

/**
 * Every id an NPC appearance can be read from for one session: the union of
 * `structuredNotes[].taggedEntityIds`, `plannedNpcIds`, and the `npcIds` of
 * the scenes named in `plannedSceneIds` (looked up across every adventure).
 * Missing arrays are treated as empty.
 */
export function getSessionAppearanceIds(campaign: Campaign, session: SessionLog): Set<string> {
  const ids = new Set<string>();
  for (const note of session.structuredNotes ?? []) {
    for (const id of note.taggedEntityIds ?? []) ids.add(id);
  }
  for (const id of session.plannedNpcIds ?? []) ids.add(id);
  for (const sceneId of session.plannedSceneIds ?? []) {
    const scene = findSceneById(campaign, sceneId);
    if (!scene) continue;
    for (const id of scene.npcIds ?? []) ids.add(id);
  }
  return ids;
}

/**
 * Everything a session puts on stage: `getSessionAppearanceIds` plus
 * `plannedLocationIds`, `relatedPlotIds`, and the `locationId` of each planned
 * scene. This is the wider net the loaded-guns derivation casts, because a
 * secret can be linked to a location, a faction, a plot, or an item.
 */
export function getSessionOnStageIds(campaign: Campaign, session: SessionLog): Set<string> {
  const ids = getSessionAppearanceIds(campaign, session);
  for (const id of session.plannedLocationIds ?? []) ids.add(id);
  for (const id of session.relatedPlotIds ?? []) ids.add(id);
  for (const sceneId of session.plannedSceneIds ?? []) {
    const scene = findSceneById(campaign, sceneId);
    if (scene?.locationId) ids.add(scene.locationId);
  }
  return ids;
}

/**
 * One entry per NPC in the campaign, ranked most-offstage first: NPCs that
 * have been seen sort by `sessionsSinceSeen` descending, NPCs that have never
 * been on stage sort after all of them, and equal staleness breaks by name
 * (ascending, locale-insensitive). Never-seen NPCs come last on purpose — a
 * name the table has met and forgotten is a story prompt; a name it has never
 * met is just a name.
 */
export function deriveNpcLastAppearances(campaign: Campaign): NpcLastAppearance[] {
  const playedSessions = getPlayedSessionsInOrder(campaign);
  const total = playedSessions.length;
  const sessionRefs: SessionRef[] = playedSessions.map((s, i) => ({
    id: s.id,
    title: s.title,
    sessionDate: s.sessionDate,
    ordinal: i + 1,
  }));
  const appearanceSets = playedSessions.map((s) => getSessionAppearanceIds(campaign, s));

  const results: NpcLastAppearance[] = (campaign.npcs ?? []).map((npc) => {
    for (let i = total - 1; i >= 0; i--) {
      if (appearanceSets[i].has(npc.id)) {
        return {
          npcId: npc.id,
          npcName: npc.name,
          lastSeen: sessionRefs[i],
          sessionsSinceSeen: total - 1 - i,
        };
      }
    }
    return { npcId: npc.id, npcName: npc.name, lastSeen: null, sessionsSinceSeen: null };
  });

  results.sort((a, b) => {
    if (a.sessionsSinceSeen === null && b.sessionsSinceSeen === null) {
      return a.npcName.localeCompare(b.npcName);
    }
    if (a.sessionsSinceSeen === null) return 1;
    if (b.sessionsSinceSeen === null) return -1;
    if (a.sessionsSinceSeen !== b.sessionsSinceSeen) return b.sessionsSinceSeen - a.sessionsSinceSeen;
    return a.npcName.localeCompare(b.npcName);
  });

  return results;
}

/**
 * One entry per **active** plot, stalest first (`sessionsStale` descending,
 * then title ascending). A session moves a thread only when its
 * `plotProgressions` entry for that plot reads `'advanced'`; `'stalled'` and
 * `'unchanged'` do not count, and neither does `relatedPlotIds` on its own.
 */
export function derivePlotThreadAges(campaign: Campaign): PlotThreadAge[] {
  const playedSessions = getPlayedSessionsInOrder(campaign);
  const total = playedSessions.length;
  const sessionRefs: SessionRef[] = playedSessions.map((s, i) => ({
    id: s.id,
    title: s.title,
    sessionDate: s.sessionDate,
    ordinal: i + 1,
  }));

  const activePlots = (campaign.plots ?? []).filter((p) => p.status === 'active');

  const results: PlotThreadAge[] = activePlots.map((plot) => {
    for (let i = total - 1; i >= 0; i--) {
      const progressions = playedSessions[i].plotProgressions ?? {};
      if (progressions[plot.id] === 'advanced') {
        const sessionsSinceAdvanced = total - 1 - i;
        return {
          plotId: plot.id,
          plotTitle: plot.title,
          lastAdvanced: sessionRefs[i],
          sessionsSinceAdvanced,
          sessionsStale: sessionsSinceAdvanced,
        };
      }
    }
    return {
      plotId: plot.id,
      plotTitle: plot.title,
      lastAdvanced: null,
      sessionsSinceAdvanced: null,
      sessionsStale: total,
    };
  });

  results.sort((a, b) => {
    if (a.sessionsStale !== b.sessionsStale) return b.sessionsStale - a.sessionsStale;
    return a.plotTitle.localeCompare(b.plotTitle);
  });

  return results;
}

/** Unions the on-stage ids of every session passed in. */
function unionOnStageIds(campaign: Campaign, sessions: SessionLog[]): Set<string> {
  const ids = new Set<string>();
  for (const session of sessions) {
    for (const id of getSessionOnStageIds(campaign, session)) ids.add(id);
  }
  return ids;
}

/**
 * Unrevealed secrets whose `linkedEntityIds` touch something on stage —
 * either planned in an upcoming (`planned`) or live (`active`) session, or on
 * stage in the most recent completed session. `'planned'` wins over
 * `'recent'` when both apply. Sorted `'planned'` first, then by title.
 */
export function deriveLoadedGuns(campaign: Campaign): LoadedGun[] {
  const unrevealed = (campaign.secrets ?? []).filter((s) => !s.isRevealed);
  if (unrevealed.length === 0) return [];

  const upcomingSessions = (campaign.sessionLogs ?? []).filter(
    (s) => s.status === 'planned' || s.status === 'active'
  );
  const plannedOnStageIds = unionOnStageIds(campaign, upcomingSessions);

  const lastCompleted = getLastCompletedSession(campaign);
  const recentOnStageIds = lastCompleted ? getSessionOnStageIds(campaign, lastCompleted) : new Set<string>();

  const guns: LoadedGun[] = [];
  for (const secret of unrevealed) {
    const linkedIds = secret.linkedEntityIds ?? [];
    if (linkedIds.length === 0) continue;
    const plannedHits = linkedIds.filter((id) => plannedOnStageIds.has(id));
    const recentHits = linkedIds.filter((id) => recentOnStageIds.has(id));
    if (plannedHits.length === 0 && recentHits.length === 0) continue;
    const reason: LoadedGunReason = plannedHits.length > 0 ? 'planned' : 'recent';
    guns.push({
      secretId: secret.id,
      secretTitle: secret.title,
      category: secret.category,
      triggeringEntityIds: reason === 'planned' ? plannedHits : recentHits,
      reason,
    });
  }

  guns.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'planned' ? -1 : 1;
    return a.secretTitle.localeCompare(b.secretTitle);
  });

  return guns;
}

/** Session-ordinal phrasing for an NPC's last appearance. */
export function formatLastSeenLabel(appearance: NpcLastAppearance): string {
  if (appearance.sessionsSinceSeen === null) return "Hasn't stepped on stage yet";
  if (appearance.sessionsSinceSeen === 0) return 'Last seen last session';
  if (appearance.sessionsSinceSeen === 1) return 'Last seen 1 session ago';
  return `Last seen ${appearance.sessionsSinceSeen} sessions ago`;
}

/** Session-ordinal phrasing for how long a thread has sat still. */
export function formatThreadAgeLabel(thread: PlotThreadAge): string {
  if (thread.sessionsSinceAdvanced === null) return "Hasn't moved yet";
  if (thread.sessionsSinceAdvanced === 0) return 'Moved last session';
  if (thread.sessionsSinceAdvanced === 1) return "Hasn't moved in 1 session";
  return `Hasn't moved in ${thread.sessionsSinceAdvanced} sessions`;
}
