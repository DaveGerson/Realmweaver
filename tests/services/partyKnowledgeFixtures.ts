/**
 * tests/services/partyKnowledgeFixtures.ts
 *
 * Shared fixtures for the reveal-state sections of the campaign context. NOT a
 * suite — the filename deliberately has no `.test.` segment so Vitest does not
 * collect it (see tests/CLAUDE.md, `wp-i1-ai-proxy.harness.ts` follows the same
 * rule).
 */

import type { Campaign } from '../../types/Campaign';
import type { NPC } from '../../types/NPC';
import type { Location } from '../../types/Location';
import type { Scene } from '../../types/Scene';
import type { Adventure } from '../../types/Adventure';
import type { SessionLog } from '../../types/SessionLog';
import type { Secret } from '../../types/Secret';
import type { Plot } from '../../types/Plot';

// ---------------------------------------------------------------------------
// Exact section strings the builder emits
// ---------------------------------------------------------------------------

export const UNREVEALED_HEADER =
  'Unrevealed Secrets (the party has not discovered these yet; keep them out of anything players will hear or read):';
export const PARTY_KNOWLEDGE_HEADER = 'Established Party Knowledge (revealed secrets):';

/** `  - [category] Title: content` — the one entry format both sections use. */
export const secretLine = (s: Pick<Secret, 'category' | 'title' | 'content'>): string =>
  s.content ? `  - [${s.category}] ${s.title}: ${s.content}` : `  - [${s.category}] ${s.title}`;

/** The DM's bookkeeping on a secret — not campaign content, so never sent to the model. */
export const SECRET_NOTES = 'Bookkeeping: move this to session six.';

/** The GM's own prose on the loaded campaign, which the model sees in every variant. */
export const GM_PROSE = {
  npcTraits: 'Never raises his voice.',
  npcMotivations: 'Wants the Duke deposed.',
  sceneGmNotes: 'Vayne offers a bargain he cannot keep.',
  sessionPrepNotes: 'Open on the ash falling indoors.',
  plotTitle: 'The Quiet Debt',
} as const;

// ---------------------------------------------------------------------------
// Entity factories
// ---------------------------------------------------------------------------

export function makeNpc(overrides: Partial<NPC> & Pick<NPC, 'id' | 'name'>): NPC {
  return {
    description: 'A person of note.',
    traits: '',
    backstory: '',
    motivations: '',
    secrets: '',
    stats: '',
    exampleQuote: '',
    knowsPlayerHistory: [],
    relationships: [],
    history: [],
    ...overrides,
  };
}

export function makeLocation(
  overrides: Partial<Location> & Pick<Location, 'id' | 'name'>
): Location {
  return {
    description: 'A place of note.',
    secrets: '',
    subLocationIds: [],
    history: [],
    ...overrides,
  };
}

export function makeScene(overrides: Partial<Scene> & Pick<Scene, 'id' | 'title'>): Scene {
  return {
    type: 'social',
    status: 'in-progress',
    readAloudText: 'The doors swing open.',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
    ...overrides,
  };
}

export function makeAdventure(
  overrides: Partial<Adventure> & Pick<Adventure, 'id' | 'title'>
): Adventure {
  return {
    level: 3,
    hook: '',
    theme: '',
    scenes: [],
    ...overrides,
  };
}

export function makeSessionLog(
  overrides: Partial<SessionLog> & Pick<SessionLog, 'id' | 'title'>
): SessionLog {
  return {
    status: 'active',
    sessionDate: '2026-08-26',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...overrides,
  };
}

export function makeSecret(overrides: Partial<Secret> & Pick<Secret, 'id' | 'title'>): Secret {
  return {
    content: 'Something is hidden here.',
    category: 'secret',
    isRevealed: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makePlot(overrides: Partial<Plot> & Pick<Plot, 'id' | 'title'>): Plot {
  return {
    description: '',
    status: 'active',
    relatedEntityIds: [],
    ...overrides,
  };
}

export function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c1',
    title: 'The Ashen Compact',
    settingType: 'custom',
    setting: 'A grim fantasy world where magic is dying.',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The canonical "loaded" campaign: one revealed secret + two unrevealed secrets
// (one linked to the active scene, one linked to an off-scene entity).
// ---------------------------------------------------------------------------

export const SCENE_ID = 'scene-1';
export const SCENE_NPC_ID = 'npc-scene';
export const OFFSCENE_NPC_ID = 'npc-offscene';
export const SCENE_LOCATION_ID = 'loc-scene';
export const SESSION_ID = 'sess-1';

export const REVEALED_SECRET: Secret = makeSecret({
  id: 'sec-revealed',
  title: 'The Broken Seal',
  content: 'The seal on the crypt was broken from the inside.',
  category: 'revelation',
  isRevealed: true,
  revealedInSessionId: SESSION_ID,
  linkedEntityIds: [SCENE_LOCATION_ID],
  notes: SECRET_NOTES,
});

export const SCENE_UNREVEALED_SECRET: Secret = makeSecret({
  id: 'sec-unrevealed-scene',
  title: 'The Chancellor Forged The Writ',
  content: 'His own seal is on the forgery.',
  category: 'clue',
  isRevealed: false,
  linkedEntityIds: [SCENE_NPC_ID],
  notes: SECRET_NOTES,
});

export const OFFSCENE_UNREVEALED_SECRET: Secret = makeSecret({
  id: 'sec-unrevealed-offscene',
  title: 'The Duke Sold The Water Rights',
  content: 'Nothing in this scene touches it.',
  category: 'secret',
  isRevealed: false,
  linkedEntityIds: [OFFSCENE_NPC_ID],
});

/** A campaign with an active scene, an active session and secrets in all three relevance states. */
export function makeLoadedCampaign(overrides: Partial<Campaign> = {}): Campaign {
  const scene = makeScene({
    id: SCENE_ID,
    title: 'Audience in the Ash Court',
    npcIds: [SCENE_NPC_ID],
    locationId: SCENE_LOCATION_ID,
    gmNotes: GM_PROSE.sceneGmNotes,
    readAloudText: 'Ash drifts through the shattered dome.',
  });

  return makeCampaign({
    npcs: [
      makeNpc({
        id: SCENE_NPC_ID,
        name: 'Chancellor Vayne',
        description: 'A stooped official in grey.',
        traits: GM_PROSE.npcTraits,
        motivations: GM_PROSE.npcMotivations,
      }),
      makeNpc({ id: OFFSCENE_NPC_ID, name: 'Duke Harrow' }),
    ],
    locations: [
      makeLocation({
        id: SCENE_LOCATION_ID,
        name: 'The Ash Court',
        description: 'A ruined hall of pale stone.',
      }),
    ],
    adventures: [makeAdventure({ id: 'adv-1', title: 'Embers', scenes: [scene] })],
    sessionLogs: [
      makeSessionLog({
        id: SESSION_ID,
        title: 'Session 4 — The Ash Court',
        prepNotes: GM_PROSE.sessionPrepNotes,
      }),
    ],
    plots: [makePlot({ id: 'plot-1', title: GM_PROSE.plotTitle, status: 'active' })],
    secrets: [REVEALED_SECRET, SCENE_UNREVEALED_SECRET, OFFSCENE_UNREVEALED_SECRET],
    activeSceneId: SCENE_ID,
    activeSessionId: SESSION_ID,
    ...overrides,
  });
}
