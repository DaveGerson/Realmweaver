/**
 * tests/services/partyKnowledgeFixtures.ts
 *
 * Shared fixtures for the E3 "party-knowledge AI wiring" lane. NOT a suite —
 * the filename deliberately has no `.test.` segment so Vitest does not collect
 * it (see tests/CLAUDE.md, `wp-i1-ai-proxy.harness.ts` follows the same rule).
 *
 * The CANARY_* tokens below are the never-leak instrumentation: each one is
 * planted in exactly one GM-authored prose field, so a player-facing context
 * that contains any of them names the field that leaked.
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
// Never-leak canaries — one per GM-only prose field
// ---------------------------------------------------------------------------

export const CANARY = {
  npcSecrets: 'CANARYNPCSECRETS',
  npcTraits: 'CANARYNPCTRAITS',
  npcMotivations: 'CANARYNPCMOTIVATIONS',
  npcBackstory: 'CANARYNPCBACKSTORY',
  locationSecrets: 'CANARYLOCATIONSECRETS',
  sceneGmNotes: 'CANARYSCENEGMNOTES',
  sessionPrepNotes: 'CANARYSESSIONPREPNOTES',
  sessionRunningNotes: 'CANARYSESSIONRUNNINGNOTES',
  unrevealedTitle: 'CANARYUNREVEALEDTITLE',
  unrevealedContent: 'CANARYUNREVEALEDCONTENT',
  secretNotes: 'CANARYSECRETNOTES',
  plotTitle: 'CANARYPLOTTITLE',
  plotDescription: 'CANARYPLOTDESCRIPTION',
} as const;

/** Every canary token, for the "not a single one of them leaked" assertions. */
export const ALL_CANARIES: string[] = Object.values(CANARY);

// ---------------------------------------------------------------------------
// Exact section strings the builder must emit (the executable contract)
// ---------------------------------------------------------------------------

export const GM_ONLY_HEADER = 'GM-ONLY — UNREVEALED SECRETS (never reveal to players):';
export const PARTY_KNOWLEDGE_HEADER = 'Established Party Knowledge (revealed secrets):';

/** `  - [category] Title: content` — the one entry format both sections use. */
export const secretLine = (s: Pick<Secret, 'category' | 'title' | 'content'>): string =>
  s.content ? `  - [${s.category}] ${s.title}: ${s.content}` : `  - [${s.category}] ${s.title}`;

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
// The canonical "loaded" campaign: every GM-only field carries its canary,
// and there is one revealed secret + two unrevealed secrets (one linked to the
// active scene, one linked to an off-scene entity).
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
  notes: CANARY.secretNotes,
});

export const SCENE_UNREVEALED_SECRET: Secret = makeSecret({
  id: 'sec-unrevealed-scene',
  title: CANARY.unrevealedTitle,
  content: CANARY.unrevealedContent,
  category: 'clue',
  isRevealed: false,
  linkedEntityIds: [SCENE_NPC_ID],
  notes: CANARY.secretNotes,
});

export const OFFSCENE_UNREVEALED_SECRET: Secret = makeSecret({
  id: 'sec-unrevealed-offscene',
  title: 'The Duke Sold The Water Rights',
  content: 'Nothing in this scene touches it.',
  category: 'secret',
  isRevealed: false,
  linkedEntityIds: [OFFSCENE_NPC_ID],
});

/**
 * A campaign with an active scene, an active session, secrets in all three
 * relevance states, and a canary in every GM-only prose field.
 */
export function makeLoadedCampaign(overrides: Partial<Campaign> = {}): Campaign {
  const scene = makeScene({
    id: SCENE_ID,
    title: 'Audience in the Ash Court',
    npcIds: [SCENE_NPC_ID],
    locationId: SCENE_LOCATION_ID,
    gmNotes: CANARY.sceneGmNotes,
    readAloudText: 'Ash drifts through the shattered dome.',
  });

  return makeCampaign({
    npcs: [
      makeNpc({
        id: SCENE_NPC_ID,
        name: 'Chancellor Vayne',
        description: 'A stooped official in grey.',
        secrets: CANARY.npcSecrets,
        traits: CANARY.npcTraits,
        motivations: CANARY.npcMotivations,
        backstory: CANARY.npcBackstory,
      }),
      makeNpc({ id: OFFSCENE_NPC_ID, name: 'Duke Harrow', secrets: CANARY.npcSecrets }),
    ],
    locations: [
      makeLocation({
        id: SCENE_LOCATION_ID,
        name: 'The Ash Court',
        description: 'A ruined hall of pale stone.',
        secrets: CANARY.locationSecrets,
      }),
    ],
    adventures: [makeAdventure({ id: 'adv-1', title: 'Embers', scenes: [scene] })],
    sessionLogs: [
      makeSessionLog({
        id: SESSION_ID,
        title: 'Session 4 — The Ash Court',
        prepNotes: CANARY.sessionPrepNotes,
        runningNotes: CANARY.sessionRunningNotes,
      }),
    ],
    plots: [
      makePlot({
        id: 'plot-1',
        title: CANARY.plotTitle,
        description: CANARY.plotDescription,
        status: 'active',
      }),
    ],
    secrets: [REVEALED_SECRET, SCENE_UNREVEALED_SECRET, OFFSCENE_UNREVEALED_SECRET],
    activeSceneId: SCENE_ID,
    activeSessionId: SESSION_ID,
    ...overrides,
  });
}
