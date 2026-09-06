// utils/dormantMaterial.ts
//
// The Callback Machine's sampler (Wave 1, lane P2).
//
// "Dormant material" is the campaign's own established-but-idle inventory:
// a face the table has met and not seen for a while, a secret still unfired,
// a thread that has stopped moving, a scene that was prepped and never run.
// The Callback Machine spends it — reincorporation is the improv principle
// that the best twist is the thing you already established.
//
// Everything here is pure: no store access, no clock, no mutation of the
// campaign argument, and randomness only ever arrives through an injectable
// `random` source so a test can pin the draw. All story-age reasoning is
// delegated to `utils/storyDerivations.ts` (P1) — this module ranks, filters,
// and picks; it never re-derives what lives there.

import type { Campaign } from '../types/index';
import {
  getPlayedSessionsInOrder,
  deriveNpcLastAppearances,
  derivePlotThreadAges,
  deriveLoadedGuns,
  formatLastSeenLabel,
  formatThreadAgeLabel,
} from './storyDerivations';

/** The four kinds of dormant material the Callback Machine can spend. */
export type DormantKind = 'npc' | 'secret' | 'plot' | 'scene';

/**
 * One piece of dormant material, flattened to what a prompt and a card both
 * need: what kind of thing it is, which entity it is, what to call it, and
 * one plain sentence saying why it counts as dormant.
 */
export interface DormantPiece {
  kind: DormantKind;
  /** The underlying entity's id (npc / secret / plot / scene). */
  id: string;
  /** Display name — `name` for NPCs, `title` for everything else. */
  label: string;
  /** Session-ordinal phrasing for why this is dormant. Never empty. */
  reason: string;
}

/** The ranked candidate pool for each kind, best-first. */
export type DormantCandidatePools = Record<DormantKind, DormantPiece[]>;

export interface DormantMaterialOptions {
  campaign: Campaign;
  /** The scene currently on stage, if any. Its cast is not dormant. */
  activeSceneId?: string | null;
  /**
   * NPCs the DM has put on the Stage right now (unstructured play) — present
   * in the room, so not offstage, even with no prepped scene active.
   */
  presentNpcIds?: readonly string[];
  /** How many pieces to sample. Clamped to 2–3; defaults to 3. */
  count?: number;
  /** Injectable [0,1) source. Defaults to `Math.random`. */
  random?: () => number;
}

/** Fixed kind order — sampling and output both read in this order. */
export const DORMANT_KIND_ORDER: readonly DormantKind[] = ['npc', 'secret', 'plot', 'scene'];

/** A pick only ever reaches this far into a pool, so the stalest material wins. */
export const DORMANT_POOL_DEPTH = 5;

export const MIN_DORMANT_SAMPLE = 2;
export const MAX_DORMANT_SAMPLE = 3;

/** Finds the scene with the given id across every adventure, plus its parent adventure. */
function findSceneWithAdventure(
  campaign: Campaign,
  sceneId: string
): { scene: { id: string; title: string; status: string; npcIds?: string[] }; adventureTitle: string } | undefined {
  for (const adventure of campaign.adventures ?? []) {
    const scene = adventure.scenes?.find((s) => s.id === sceneId);
    if (scene) return { scene, adventureTitle: adventure.title };
  }
  return undefined;
}

/** Every scene id a played session ever put on stage, across the whole campaign. */
function collectPlayedSceneIds(campaign: Campaign): Set<string> {
  const ids = new Set<string>();
  for (const session of getPlayedSessionsInOrder(campaign)) {
    for (const id of session.plannedSceneIds ?? []) ids.add(id);
  }
  return ids;
}

/** The npcIds of the currently-live scene, if any — that cast is not offstage. */
function collectLiveSceneNpcIds(campaign: Campaign, activeSceneId?: string | null): Set<string> {
  if (!activeSceneId) return new Set();
  const found = findSceneWithAdventure(campaign, activeSceneId);
  return new Set(found?.scene.npcIds ?? []);
}

/** The offstage-NPC bucket: seen at least once, not last session, not in the live scene. */
function collectOffstageNpcs(campaign: Campaign, liveSceneNpcIds: Set<string>): DormantPiece[] {
  return deriveNpcLastAppearances(campaign)
    .filter((a) => a.sessionsSinceSeen !== null && a.sessionsSinceSeen > 0)
    .filter((a) => !liveSceneNpcIds.has(a.npcId))
    .map((a) => ({
      kind: 'npc' as const,
      id: a.npcId,
      label: a.npcName,
      reason: formatLastSeenLabel(a),
    }));
}

/** Copy for why an unrevealed secret is dormant — distinct for each `deriveLoadedGuns` reason. */
function formatLoadedGunReason(reason: 'planned' | 'recent'): string {
  return reason === 'planned'
    ? 'Unrevealed — primed for an upcoming scene'
    : 'Unrevealed since last session';
}

/** The unrevealed-secret bucket: P1's loaded guns, verbatim order. */
function collectLoadedGunSecrets(campaign: Campaign): DormantPiece[] {
  return deriveLoadedGuns(campaign).map((gun) => ({
    kind: 'secret' as const,
    id: gun.secretId,
    label: gun.secretTitle,
    reason: formatLoadedGunReason(gun.reason),
  }));
}

/** The stalled/dormant-plot bucket: stale active threads, then DM-marked-dormant ones. */
function collectStalledPlots(campaign: Campaign): DormantPiece[] {
  const stale = derivePlotThreadAges(campaign)
    .filter((t) => t.sessionsStale >= 1)
    .map((t) => ({
      kind: 'plot' as const,
      id: t.plotId,
      label: t.plotTitle,
      reason: formatThreadAgeLabel(t),
    }));

  const dormant = (campaign.plots ?? [])
    .filter((p) => p.status === 'dormant')
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => ({
      kind: 'plot' as const,
      id: p.id,
      label: p.title,
      reason: 'Marked dormant by the DM',
    }));

  return [...stale, ...dormant];
}

/** The unused-planned-scene bucket: prepped, never run, not the scene live right now. */
function collectUnusedScenes(campaign: Campaign, activeSceneId?: string | null): DormantPiece[] {
  const playedSceneIds = collectPlayedSceneIds(campaign);
  const pieces: DormantPiece[] = [];
  for (const adventure of campaign.adventures ?? []) {
    for (const scene of adventure.scenes ?? []) {
      if (scene.status !== 'planned') continue;
      if (playedSceneIds.has(scene.id)) continue;
      if (activeSceneId && scene.id === activeSceneId) continue;
      pieces.push({
        kind: 'scene',
        id: scene.id,
        label: scene.title,
        reason: `Prepped for "${adventure.title}", never run`,
      });
    }
  }
  return pieces;
}

/**
 * Every piece of dormant material in the campaign, bucketed by kind and
 * ranked best-first within each bucket. Pure; safe inside a `useMemo`.
 */
export function collectDormantCandidates(
  campaign: Campaign,
  activeSceneId?: string | null,
  presentNpcIds?: readonly string[]
): DormantCandidatePools {
  const liveSceneNpcIds = collectLiveSceneNpcIds(campaign, activeSceneId);
  for (const id of presentNpcIds ?? []) liveSceneNpcIds.add(id);
  return {
    npc: collectOffstageNpcs(campaign, liveSceneNpcIds),
    secret: collectLoadedGunSecrets(campaign),
    plot: collectStalledPlots(campaign),
    scene: collectUnusedScenes(campaign, activeSceneId),
  };
}

/**
 * Normalizes a possibly-misbehaving random draw into `[0, 1)`. `NaN` and
 * other non-finite values fall back to 0 (the top of whatever it indexes);
 * anything else is folded into range with `% 1`, guarding against a source
 * that returns exactly 1 or a negative number.
 */
function normalizeDraw(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  let x = value % 1;
  if (x < 0) x += 1;
  return x;
}

/** Picks an index into a bucket, never reaching past the top `DORMANT_POOL_DEPTH` entries. */
function pickIndex(random: () => number, bucketLength: number): number {
  const depth = Math.min(bucketLength, DORMANT_POOL_DEPTH);
  const draw = normalizeDraw(random);
  const index = Math.floor(draw * depth);
  return Math.min(Math.max(index, 0), depth - 1);
}

/**
 * Picks 2–3 pieces of dormant material, at most one per kind, using the
 * injected random source. Returns fewer than `count` only when fewer kinds
 * have anything to offer, and `[]` when the campaign has nothing dormant.
 */
export function sampleDormantMaterial(options: DormantMaterialOptions): DormantPiece[] {
  const { campaign, activeSceneId, presentNpcIds, count, random = Math.random } = options;
  const pools = collectDormantCandidates(campaign, activeSceneId, presentNpcIds);

  const available = DORMANT_KIND_ORDER.filter((kind) => pools[kind].length > 0);
  if (available.length === 0) return [];

  const desired = Math.min(MAX_DORMANT_SAMPLE, Math.max(MIN_DORMANT_SAMPLE, count ?? MAX_DORMANT_SAMPLE));
  const want = Math.min(desired, available.length);

  // Draw 1: rotate the starting point into the available-kind list.
  const startIndex = Math.floor(normalizeDraw(random) * available.length) % available.length;
  const chosen = new Set<DormantKind>();
  for (let i = 0; i < want; i++) {
    chosen.add(available[(startIndex + i) % available.length]);
  }

  // One draw per chosen kind, spent in fixed kind order.
  const result: DormantPiece[] = [];
  for (const kind of DORMANT_KIND_ORDER) {
    if (!chosen.has(kind)) continue;
    const bucket = pools[kind];
    const index = pickIndex(random, bucket.length);
    result.push(bucket[index]);
  }

  return result;
}
