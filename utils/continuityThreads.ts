/**
 * continuityThreads — pure "loose ends" selector for the Prep-to-Play
 * Continuity Bridge (roadmap L3).
 *
 * Given a Campaign, compute the threads a GM should pick back up next
 * session:
 *
 *   - `session-loose-ends` — the free-text `looseEnds` recorded on the most
 *     recent COMPLETED session (SessionEndWizard writes it).
 *   - `plot`               — every plot whose status is not `resolved`, annotated
 *     with how it fared in the most recent completed session's
 *     `plotProgressions`.
 *   - `scene`              — scenes left `in-progress`.
 *   - `adventure`          — adventures part-way through (≥1 completed scene and
 *     ≥1 scene still to run).
 *   - `secret`             — the "loaded guns": unrevealed secrets linked to
 *     something on stage in the last completed session or a planned/live one
 *     (`storyDerivations.deriveLoadedGuns`, reused verbatim).
 *
 * Threads are ranked by recency: the thread touched by the newest played
 * session comes first; untouched threads sink to the bottom. Ties break by
 * kind (order above), then active-before-dormant for plots, then title.
 *
 * Built on `utils/storyDerivations.ts` (the Tonight's Table derivations) —
 * same played-session order, same last-completed-session rule, same
 * campaign-wide scene lookup and on-stage id net — so this list and
 * Tonight's Table never disagree about what "last session" means. What this
 * module adds is the flattening into one ranked, checkable list that
 * SessionPrepWizard carries into prepNotes and the Session Runner's
 * LooseEndsPanel navigates from.
 *
 * No store access, no React — callers pass the campaign in.
 */
import type { Campaign, SessionLog, PlotSessionStatus } from '../types/index';
import type { QuickCardEntityType } from './entityDetailExtractors';
import {
    getPlayedSessionsInOrder,
    getLastCompletedSession,
    getSessionOnStageIds,
    deriveLoadedGuns,
    resolveSceneById,
} from './storyDerivations';

export type ContinuityThreadKind = 'session-loose-ends' | 'plot' | 'scene' | 'adventure' | 'secret';

export interface ContinuityThread {
    /** Stable unique key: `${kind}:${entityId}`. */
    id: string;
    kind: ContinuityThreadKind;
    /** Id of the underlying entity (session log, plot, scene, adventure, secret). */
    entityId: string;
    title: string;
    /** Most recent played session that touched this thread, if any. */
    lastTouchedSessionId?: string;
    summary: string;
    /** How the most recent completed session left this plot (plot threads only). */
    lastProgression?: PlotSessionStatus;
    /** Where a click should navigate, when the thread maps to a navigable entity. */
    navigateTo?: { type: QuickCardEntityType; id: string };
}

const KIND_ORDER: Record<ContinuityThreadKind, number> = {
    'session-loose-ends': 0,
    plot: 1,
    scene: 2,
    adventure: 3,
    secret: 4,
};

export const CONTINUITY_THREAD_LABELS: Record<ContinuityThreadKind, string> = {
    'session-loose-ends': 'Loose ends',
    plot: 'Plot',
    scene: 'Scene',
    adventure: 'Adventure',
    secret: 'Secret',
};

const SUMMARY_EXCERPT = 160;
const LOOSE_ENDS_EXCERPT = 280;

const excerpt = (text: string | undefined, max: number): string => {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Resolve an arbitrary entity id (type unknown) to a navigable type + display name. */
export const resolveContinuityEntity = (
    campaign: Campaign,
    id: string,
): { type: QuickCardEntityType; name: string } | null => {
    const byName = <T extends { id: string; name: string }>(list: T[] | undefined, type: QuickCardEntityType) => {
        const e = list?.find(x => x.id === id);
        return e ? { type, name: e.name } : null;
    };
    const byTitle = <T extends { id: string; title: string }>(list: T[] | undefined, type: QuickCardEntityType) => {
        const e = list?.find(x => x.id === id);
        return e ? { type, name: e.title } : null;
    };
    const direct =
        byName(campaign.npcs, 'npc') ??
        byName(campaign.locations, 'location') ??
        byName(campaign.factions, 'faction') ??
        byName(campaign.items, 'item') ??
        byTitle(campaign.adventures, 'adventure') ??
        byTitle(campaign.articles, 'article') ??
        byTitle(campaign.plots, 'plot');
    if (direct) return direct;
    const pc = campaign.playerCharacters?.find(p => p.id === id);
    if (pc) return { type: 'player-character', name: pc.characterSocial?.characterName || pc.playerName };
    const scene = resolveSceneById(campaign, id);
    return scene ? { type: 'scene', name: scene.scene.title } : null;
};

const sessionTouchesPlot = (s: SessionLog, plotId: string): boolean =>
    (s.relatedPlotIds ?? []).includes(plotId) ||
    Object.prototype.hasOwnProperty.call(s.plotProgressions ?? {}, plotId);

/**
 * Compute the ranked list of continuity threads ("loose ends") for the next
 * session. Pure: same campaign in, same list out.
 */
export const computeContinuityThreads = (campaign: Campaign): ContinuityThread[] => {
    // Newest first — storyDerivations orders oldest first.
    const played = getPlayedSessionsInOrder(campaign).slice().reverse();
    const recency = new Map(played.map((s, i) => [s.id, i]));
    const previous = getLastCompletedSession(campaign);
    const threads: ContinuityThread[] = [];
    const dormantPlotIds = new Set<string>();

    // ── Previous session's free-text loose ends ────────────────────────────
    if (previous && previous.looseEnds?.trim()) {
        threads.push({
            id: `session-loose-ends:${previous.id}`,
            kind: 'session-loose-ends',
            entityId: previous.id,
            title: `Loose ends from "${previous.title}"`,
            lastTouchedSessionId: previous.id,
            summary: excerpt(previous.looseEnds, LOOSE_ENDS_EXCERPT),
            navigateTo: { type: 'session-log', id: previous.id },
        });
    }

    // ── Unresolved plots ───────────────────────────────────────────────────
    for (const plot of campaign.plots ?? []) {
        if (plot.status === 'resolved') continue;
        if (plot.status === 'dormant') dormantPlotIds.add(plot.id);
        const touched = played.find(s => sessionTouchesPlot(s, plot.id));
        const lastProgression = previous?.plotProgressions?.[plot.id];
        const parts: string[] = [];
        if (plot.status === 'dormant') parts.push('Dormant.');
        if (lastProgression) parts.push(`Last session: ${lastProgression}.`);
        else if (touched) parts.push(`Last touched in "${touched.title}".`);
        else parts.push('Not yet touched in play.');
        const desc = excerpt(plot.description, SUMMARY_EXCERPT);
        if (desc) parts.push(desc);
        threads.push({
            id: `plot:${plot.id}`,
            kind: 'plot',
            entityId: plot.id,
            title: plot.title,
            lastTouchedSessionId: touched?.id,
            summary: parts.join(' '),
            ...(lastProgression ? { lastProgression } : {}),
            navigateTo: { type: 'plot', id: plot.id },
        });
    }

    // ── Scenes left in progress / adventures part-way through ──────────────
    for (const adv of campaign.adventures ?? []) {
        const scenes = adv.scenes ?? [];
        for (const scene of scenes) {
            if (scene.status !== 'in-progress') continue;
            const touched = played.find(s => (s.plannedSceneIds ?? []).includes(scene.id));
            const notes = excerpt(scene.gmNotes, SUMMARY_EXCERPT);
            threads.push({
                id: `scene:${scene.id}`,
                kind: 'scene',
                entityId: scene.id,
                title: scene.title,
                lastTouchedSessionId: touched?.id,
                summary: [`Left in progress in "${adv.title}".`, notes].filter(Boolean).join(' '),
                navigateTo: { type: 'scene', id: scene.id },
            });
        }
        const done = scenes.filter(s => s.status === 'completed').length;
        if (done > 0 && done < scenes.length) {
            const touched = played.find(s => s.adventureId === adv.id);
            threads.push({
                id: `adventure:${adv.id}`,
                kind: 'adventure',
                entityId: adv.id,
                title: adv.title,
                lastTouchedSessionId: touched?.id,
                summary: `${done} of ${scenes.length} scenes completed.`,
                navigateTo: { type: 'adventure', id: adv.id },
            });
        }
    }

    // ── Loaded guns: unrevealed secrets tied to what's on stage ────────────
    const guns = deriveLoadedGuns(campaign);
    if (guns.length > 0) {
        const secretsById = new Map((campaign.secrets ?? []).map(sec => [sec.id, sec]));
        const onStage = played.map(s => ({ session: s, ids: getSessionOnStageIds(campaign, s) }));
        for (const gun of guns) {
            const linked = secretsById.get(gun.secretId)?.linkedEntityIds ?? gun.triggeringEntityIds;
            const touched = onStage.find(({ ids }) => linked.some(id => ids.has(id)));
            const names = linked
                .map(id => resolveContinuityEntity(campaign, id)?.name)
                .filter((n): n is string => Boolean(n));
            const target = gun.triggeringEntityIds
                .map(id => ({ id, r: resolveContinuityEntity(campaign, id) }))
                .find(x => x.r !== null);
            const lead = gun.reason === 'planned' ? 'On stage tonight' : 'Primed from last session';
            threads.push({
                id: `secret:${gun.secretId}`,
                kind: 'secret',
                entityId: gun.secretId,
                title: gun.secretTitle,
                lastTouchedSessionId: touched?.session.id,
                summary: names.length > 0
                    ? `${lead}: unrevealed ${gun.category} tied to ${names.join(', ')}.`
                    : `${lead}: unrevealed ${gun.category}.`,
                ...(target?.r ? { navigateTo: { type: target.r.type, id: target.id } } : {}),
            });
        }
    }

    const rank = (t: ContinuityThread) =>
        t.lastTouchedSessionId !== undefined ? (recency.get(t.lastTouchedSessionId) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;

    return threads.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra < rb ? -1 : 1;
        const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
        if (k !== 0) return k;
        const da = dormantPlotIds.has(a.entityId) ? 1 : 0;
        const db = dormantPlotIds.has(b.entityId) ? 1 : 0;
        if (da !== db) return da - db;
        return a.title.localeCompare(b.title);
    });
};

/**
 * Render a set of threads as plain text suitable for appending to a
 * session's prep notes (and therefore to any AI context built from them).
 * Returns '' for an empty list.
 */
export const formatThreadsForPrep = (threads: ContinuityThread[]): string => {
    if (threads.length === 0) return '';
    const lines = threads.map(t => {
        const summary = t.summary ? ` — ${t.summary}` : '';
        return `- [${CONTINUITY_THREAD_LABELS[t.kind]}] ${t.title}${summary}`;
    });
    return ['Carried forward from previous sessions:', ...lines].join('\n');
};
