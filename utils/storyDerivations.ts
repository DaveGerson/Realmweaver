// utils/storyDerivations.ts
//
// Shared, pure story-shape derivations over a Campaign. Nothing here holds
// state, touches the store, or reads the clock — every function is safe to
// call inside a `useMemo`. Time is measured in **session ordinals**, never in
// dates: "last seen 3 sessions ago" is the unit a GM actually thinks in.
//
// Consumed first by `components/views/TonightsTable.tsx` (P1); P2's Callback
// Machine sampler and P6's story-health checks reuse the same functions.

import type { Campaign, SessionLog, Scene, Secret, Adventure, PlayerCharacter } from '../types/index';
import { getMatchingEngine } from '../services/linking/engineRegistry';
import type { EntityCandidate } from '../services/linking/matchingEngine';

// ---------------------------------------------------------------------------
// Scene lookup — a session may pull scenes from ANY adventure (the scene
// menu, unstructured play), so every consumer that resolves a scene id must
// search the whole campaign, never one adventure.
// ---------------------------------------------------------------------------

/** A scene together with the adventure that owns it. */
export interface ResolvedScene {
  scene: Scene;
  adventure: Adventure;
}

/**
 * Finds a scene by id across every adventure in the campaign, with its owning
 * adventure. Returns null for a blank/unknown id. Pure; safe on an Immer draft
 * (it only `find`s — the objects it returns are the draft's own).
 */
export function resolveSceneById(campaign: Campaign, sceneId: string | null | undefined): ResolvedScene | null {
  if (!sceneId) return null;
  for (const adventure of campaign.adventures ?? []) {
    const scene = adventure.scenes?.find((s) => s.id === sceneId);
    if (scene) return { scene, adventure };
  }
  return null;
}

/** One prepped scene sitting on the shelf, ready to be pulled into tonight. */
export interface ShelfScene {
  scene: Scene;
  adventureId: string;
  adventureTitle: string;
}

/**
 * The scene shelf: every scene in the campaign that is still runnable
 * (`planned` or `in-progress`) and not already in the given session's
 * `plannedSceneIds`. Adventure order, then scene order. This is what the
 * Session Runner's "pull a scene from the shelf" picker lists — a menu of
 * prepped material across ALL adventures, not one adventure's track.
 */
export function deriveSceneShelf(campaign: Campaign, session: Pick<SessionLog, 'plannedSceneIds'> | null | undefined): ShelfScene[] {
  const planned = new Set(session?.plannedSceneIds ?? []);
  const shelf: ShelfScene[] = [];
  for (const adventure of campaign.adventures ?? []) {
    for (const scene of adventure.scenes ?? []) {
      if (scene.status === 'completed') continue;
      if (planned.has(scene.id)) continue;
      shelf.push({ scene, adventureId: adventure.id, adventureTitle: adventure.title });
    }
  }
  return shelf;
}

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
  return resolveSceneById(campaign, sceneId)?.scene;
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

// ---------------------------------------------------------------------------
// PC spotlight — "review the characters" (Shea, step 1) / "be a fan of the
// players" (Cook), as a derivation. Player characters are not @-mention
// candidates today, so a PC's presence in a session is read from the running
// log's TEXT: a note that names the character (full name, or a first name of
// at least three letters, Unicode word boundaries, case-insensitive) or that
// tags the PC's id counts as a spotlight moment. A heuristic, stated as one —
// it under-counts nicknames and never over-counts a name inside a longer word.
// ---------------------------------------------------------------------------

/** Where one player character stands relative to the table's attention. */
export interface PcSpotlight {
  pcId: string;
  pcName: string;
  playerName: string;
  /** The most recent played session whose log named this character; null if none ever did. */
  lastSpotlight: SessionRef | null;
  /** Played sessions since `lastSpotlight` (0 = the most recent one); null if never. */
  sessionsSinceSpotlight: number | null;
}

const MIN_SPOTLIGHT_NAME_LENGTH = 3;

/** The name forms a note is scanned for: the full name, plus a first name long enough to be unambiguous. */
function spotlightNameForms(fullName: string): string[] {
  const trimmed = fullName.trim();
  if (trimmed.length < MIN_SPOTLIGHT_NAME_LENGTH) return [];
  const forms = [trimmed];
  const first = trimmed.split(/\s+/)[0];
  if (first && first !== trimmed && first.length >= MIN_SPOTLIGHT_NAME_LENGTH) forms.push(first);
  return forms;
}

/**
 * One stable candidate array per character name, so the shared matching
 * engine's per-array index cache compiles each name's matchers once instead
 * of on every running-log note. Bounded: cleared wholesale past 256 names.
 */
const spotlightCandidateCache = new Map<string, EntityCandidate[]>();

function spotlightCandidates(characterName: string): EntityCandidate[] {
  let cached = spotlightCandidateCache.get(characterName);
  if (!cached) {
    const [full, ...aliases] = spotlightNameForms(characterName);
    cached = full ? [{ id: 'pc', name: full, type: 'player-character', aliases }] : [];
    if (spotlightCandidateCache.size >= 256) spotlightCandidateCache.clear();
    spotlightCandidateCache.set(characterName, cached);
  }
  return cached;
}

/**
 * True when `text` names the character, on Unicode word boundaries, ignoring
 * case. Routed through the shared linking engine (`services/linking`) so the
 * spotlight heuristic can never disagree with LinkedText / link suggestions
 * about what counts as a name occurrence (roadmap L7).
 */
export function textNamesCharacter(text: string, characterName: string): boolean {
  if (!text) return false;
  const candidates = spotlightCandidates(characterName);
  if (candidates.length === 0) return false;
  return getMatchingEngine().findMatches(text, candidates).length > 0;
}

function pcDisplayName(pc: PlayerCharacter): string {
  return pc.characterSocial?.characterName?.trim() || '';
}

/**
 * How many running-log entries in `session` put each player character in the
 * spotlight (named in the text, or tagged by id). Every PC gets a key, so a
 * zero reads as "hasn't had a moment tonight" rather than as absence.
 */
export function countPcSpotlightInSession(campaign: Campaign, session: SessionLog): Map<string, number> {
  const counts = new Map<string, number>();
  const pcs = campaign.playerCharacters ?? [];
  for (const pc of pcs) counts.set(pc.id, 0);
  for (const note of session.structuredNotes ?? []) {
    const tagged = new Set(note.taggedEntityIds ?? []);
    for (const pc of pcs) {
      const name = pcDisplayName(pc);
      if (tagged.has(pc.id) || (name && textNamesCharacter(note.content ?? '', name))) {
        counts.set(pc.id, (counts.get(pc.id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * One entry per player character, quietest first: characters never named in
 * any played session's log come first (they are the ones being missed), then
 * by `sessionsSinceSpotlight` descending, ties by character name. A campaign
 * with no PCs yields an empty list.
 */
export function derivePcSpotlight(campaign: Campaign): PcSpotlight[] {
  const playedSessions = getPlayedSessionsInOrder(campaign);
  const total = playedSessions.length;
  const sessionRefs: SessionRef[] = playedSessions.map((s, i) => ({
    id: s.id,
    title: s.title,
    sessionDate: s.sessionDate,
    ordinal: i + 1,
  }));
  const spotlightSets = playedSessions.map((s) => {
    const counts = countPcSpotlightInSession(campaign, s);
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 0).map(([id]) => id));
  });

  const results: PcSpotlight[] = (campaign.playerCharacters ?? []).map((pc) => {
    const pcName = pcDisplayName(pc) || 'Unnamed character';
    const playerName = pc.playerName ?? '';
    for (let i = total - 1; i >= 0; i--) {
      if (spotlightSets[i].has(pc.id)) {
        return { pcId: pc.id, pcName, playerName, lastSpotlight: sessionRefs[i], sessionsSinceSpotlight: total - 1 - i };
      }
    }
    return { pcId: pc.id, pcName, playerName, lastSpotlight: null, sessionsSinceSpotlight: null };
  });

  results.sort((a, b) => {
    if (a.sessionsSinceSpotlight === null && b.sessionsSinceSpotlight === null) {
      return a.pcName.localeCompare(b.pcName);
    }
    if (a.sessionsSinceSpotlight === null) return -1;
    if (b.sessionsSinceSpotlight === null) return 1;
    if (a.sessionsSinceSpotlight !== b.sessionsSinceSpotlight) return b.sessionsSinceSpotlight - a.sessionsSinceSpotlight;
    return a.pcName.localeCompare(b.pcName);
  });

  return results;
}

/** Session-ordinal phrasing for a character's last spotlight. */
export function formatSpotlightLabel(spotlight: PcSpotlight): string {
  if (spotlight.sessionsSinceSpotlight === null) return "Hasn't had a moment yet";
  if (spotlight.sessionsSinceSpotlight === 0) return 'In the spotlight last session';
  if (spotlight.sessionsSinceSpotlight === 1) return 'Quiet for 1 session';
  return `Quiet for ${spotlight.sessionsSinceSpotlight} sessions`;
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
