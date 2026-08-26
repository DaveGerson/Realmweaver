/**
 * SPEC — E3 (party-knowledge AI wiring), part 2 of 2: `services/ai/dmCoach.ts`
 * =============================================================================
 * Source: docs/architecture/ontology-tracker.md row E3 ·
 *         docs/architecture/ontology-proposal-evaluation.md §E3 ("a hard
 *         revealed-only rule for player-facing generation").
 *
 * THE DEFECT THIS PINS
 * --------------------
 * `generateSessionRecap` asks for `recap`, `looseEnds` AND `playerFacingRecap`
 * in ONE call, against ONE context. Whatever GM truth that context carries —
 * unrevealed secrets, scene `gmNotes`, plot plans — is in the model's window
 * while it writes the text the DM pastes into the party chat. "Please strip the
 * secrets" in the instructions is not an enforcement.
 *
 * BEHAVIOR CONTRACT
 * -----------------
 * 1. Split the call. `generateSessionRecap` issues EXACTLY TWO
 *    `core.generateWithSchema` calls per invocation:
 *      a) the GM call — schema has `recap` + `looseEnds` and NO
 *         `playerFacingRecap` property;
 *      b) the player call — schema has `playerFacingRecap` and NO `recap`.
 *    The resolved `SessionRecapResult` merges them: `recap`/`looseEnds` from
 *    (a), `playerFacingRecap` from (b). The public result shape is unchanged,
 *    so `services/aiService.ts` needs no edit.
 *
 * 2. New optional 4th parameter carries the campaign, not a pre-built string:
 *
 *      export interface PlayerSafeRecapContext {
 *        campaign: Campaign;
 *        activeSceneId?: string;
 *        activeSessionId?: string;
 *        maxTokenEstimate?: number;
 *      }
 *
 *      generateSessionRecap(sessionNotes, plotSummaries, campaignContext?,
 *                           playerSafe?: PlayerSafeRecapContext)
 *
 *    When `playerSafe` is given, the player call's `campaignContext` argument is
 *    `buildCampaignContext({ variant: 'player-safe', ...playerSafe })` —
 *    derived inside dmCoach, never supplied by the caller.
 *
 * 3. Hard never-leak rules for the player call, holding in every case:
 *      - its `campaignContext` is NEVER the GM `campaignContext` string;
 *      - when `playerSafe` is omitted it is `undefined` — degrade to no context
 *        rather than fall back to the GM context;
 *      - `plotSummaries` (GM plan prose) goes ONLY to the GM call — neither the
 *        player prompt nor the player instructions may contain it.
 *
 * 4. The player call's instructions carry the rule verbatim (both strings):
 *      'PLAYER-FACING OUTPUT'
 *      'Never include unrevealed secrets, GM notes, hidden motivations, or any
 *       information the players have not discovered.'
 *    (the second as one line, exactly as spelled in PLAYER_SAFE_RULE below).
 *
 * 5. Unchanged: the session notes are the source material for BOTH calls; the
 *    GM instructions still describe the narrative recap and the loose-ends
 *    list and still carry `plotSummaries`; the model tier stays `'standard'`
 *    for both calls.
 *
 * 6. Degenerate inputs are not special-cased: empty notes, an empty campaign
 *    with no secrets / no sessions / no active scene, and repeated invocations
 *    (two invocations ⇒ four calls, no shared mutable state) all behave the
 *    same way.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(),
  generateText: vi.fn(async () => 'ok'),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

import * as core from '../../services/ai/core';
import { generateSessionRecap } from '../../services/ai/dmCoach';
import { buildCampaignContext } from '../../services/contextBuilder';
import {
  ALL_CANARIES,
  CANARY,
  PARTY_KNOWLEDGE_HEADER,
  REVEALED_SECRET,
  SCENE_ID,
  SESSION_ID,
  makeCampaign,
  makeLoadedCampaign,
  secretLine,
} from './partyKnowledgeFixtures';

// The exact phrasing the player-facing instructions must contain (contract §4).
const PLAYER_SAFE_HEADING = 'PLAYER-FACING OUTPUT';
const PLAYER_SAFE_RULE =
  'Never include unrevealed secrets, GM notes, hidden motivations, or any information the players have not discovered.';

const SESSION_NOTES = 'The party bargained with the Chancellor and left before dawn.';
const PLOT_SUMMARIES = `- ${CANARY.plotTitle}: ${CANARY.plotDescription}`;
const GM_CONTEXT = `Campaign: The Ashen Compact\n${CANARY.sceneGmNotes}`;

type SchemaShape = { properties?: Record<string, unknown> };

const hasProp = (schema: unknown, key: string): boolean =>
  Object.prototype.hasOwnProperty.call((schema as SchemaShape).properties ?? {}, key);

const allCalls = () => vi.mocked(core.generateWithSchema).mock.calls;

/** The call whose schema asks for the player-facing recap. */
const playerCall = () => {
  const call = allCalls().find(c => hasProp(c[1], 'playerFacingRecap'));
  expect(call, 'expected a dedicated player-facing recap call').toBeDefined();
  return call!;
};

/** The call whose schema asks for the GM recap + loose ends. */
const gmCall = () => {
  const call = allCalls().find(c => hasProp(c[1], 'recap'));
  expect(call, 'expected a dedicated GM recap call').toBeDefined();
  return call!;
};

const promptOf = (call: unknown[]) => String(call[0]);
const instructionsOf = (call: unknown[]) => String(call[2]);
const modelOf = (call: unknown[]) => String(call[4]);
const contextOf = (call: unknown[]) => call[5] as string | undefined;

beforeEach(() => {
  vi.mocked(core.generateWithSchema).mockReset();
  vi.mocked(core.generateWithSchema).mockImplementation(async (_prompt, schema) => {
    if (hasProp(schema, 'playerFacingRecap')) {
      return { playerFacingRecap: 'PLAYER RECAP TEXT' };
    }
    return { recap: 'GM RECAP TEXT', looseEnds: ['The Chancellor still has the writ.'] };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// 1 — the call is split
// ===========================================================================

describe('generateSessionRecap splits GM and player-facing generation', () => {
  it('issues exactly two schema calls', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

    expect(allCalls()).toHaveLength(2);
  });

  it('asks for recap + looseEnds in one schema and playerFacingRecap in the other', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    expect(hasProp(gmCall()[1], 'recap')).toBe(true);
    expect(hasProp(gmCall()[1], 'looseEnds')).toBe(true);
    expect(hasProp(gmCall()[1], 'playerFacingRecap')).toBe(false);

    expect(hasProp(playerCall()[1], 'playerFacingRecap')).toBe(true);
    expect(hasProp(playerCall()[1], 'recap')).toBe(false);
  });

  it('merges the two responses into the unchanged SessionRecapResult shape', async () => {
    const result = await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    expect(result).toEqual({
      recap: 'GM RECAP TEXT',
      looseEnds: ['The Chancellor still has the writ.'],
      playerFacingRecap: 'PLAYER RECAP TEXT',
    });
  });

  it('sends the session notes to both calls and keeps the standard tier', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    expect(promptOf(gmCall())).toContain(SESSION_NOTES);
    expect(promptOf(playerCall())).toContain(SESSION_NOTES);
    expect(modelOf(gmCall())).toBe('standard');
    expect(modelOf(playerCall())).toBe('standard');
  });

  it('keeps the GM instructions describing the recap and loose ends, with the plot summaries', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    const gmInstructions = instructionsOf(gmCall());
    expect(gmInstructions).toContain('recap');
    expect(gmInstructions).toContain('looseEnds');
    expect(gmInstructions).toContain(PLOT_SUMMARIES);
    expect(contextOf(gmCall())).toBe(GM_CONTEXT);
  });

  it('makes two fresh calls on a second invocation (no shared state, four calls total)', async () => {
    const args = [SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, { campaign: makeLoadedCampaign() }] as const;

    const first = await generateSessionRecap(...args);
    const second = await generateSessionRecap(...args);

    expect(allCalls()).toHaveLength(4);
    expect(second).toEqual(first);
  });
});

// ===========================================================================
// 2 + 3 — the player call's context is player-safe, or nothing
// ===========================================================================

describe('the player-facing recap never sees GM truth', () => {
  it('builds the player context with the player-safe variant', async () => {
    const campaign = makeLoadedCampaign();

    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign,
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

    expect(contextOf(playerCall())).toBe(
      buildCampaignContext({
        variant: 'player-safe',
        campaign,
        activeSceneId: SCENE_ID,
        activeSessionId: SESSION_ID,
      })
    );
  });

  it('forwards maxTokenEstimate to the player-safe context build', async () => {
    const campaign = makeLoadedCampaign();

    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign,
      maxTokenEstimate: 250,
    });

    expect(contextOf(playerCall())).toBe(
      buildCampaignContext({ variant: 'player-safe', campaign, maxTokenEstimate: 250 })
    );
  });

  it('leaks no GM canary into the player call at all', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

    const wholePlayerCall = [
      promptOf(playerCall()),
      instructionsOf(playerCall()),
      contextOf(playerCall()) ?? '',
    ].join('\n');

    for (const canary of ALL_CANARIES) {
      expect(wholePlayerCall).not.toContain(canary);
    }
  });

  it('still gives the player call the revealed secrets as party knowledge', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
    });

    const ctx = contextOf(playerCall()) ?? '';
    expect(ctx).toContain(PARTY_KNOWLEDGE_HEADER);
    expect(ctx).toContain(secretLine(REVEALED_SECRET));
  });

  it('never passes the GM campaignContext string to the player call', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    expect(contextOf(playerCall())).not.toBe(GM_CONTEXT);
    expect(contextOf(playerCall()) ?? '').not.toContain(CANARY.sceneGmNotes);
  });

  it('passes NO context to the player call when playerSafe is omitted (legacy 3-arg call)', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT);

    expect(allCalls()).toHaveLength(2);
    expect(contextOf(playerCall())).toBeUndefined();
    expect(contextOf(gmCall())).toBe(GM_CONTEXT);
  });

  it('keeps the plot summaries out of the player call entirely', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    expect(promptOf(playerCall())).not.toContain(PLOT_SUMMARIES);
    expect(instructionsOf(playerCall())).not.toContain(PLOT_SUMMARIES);
    expect(instructionsOf(playerCall())).not.toContain(CANARY.plotTitle);
  });
});

// ===========================================================================
// 4 — the hard rule is stated in the player instructions
// ===========================================================================

describe('the player-facing instructions state the revealed-only rule', () => {
  it('contains the PLAYER-FACING OUTPUT heading and the verbatim rule', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
      campaign: makeLoadedCampaign(),
    });

    const instructions = instructionsOf(playerCall());
    expect(instructions).toContain(PLAYER_SAFE_HEADING);
    expect(instructions).toContain(PLAYER_SAFE_RULE);
  });

  it('states the rule even when there is no campaign to build a context from', async () => {
    await generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT);

    expect(instructionsOf(playerCall())).toContain(PLAYER_SAFE_RULE);
  });
});

// ===========================================================================
// 6 — degenerate inputs
// ===========================================================================

describe('degenerate inputs', () => {
  it('handles an empty campaign: no secrets, no sessions, no active scene', async () => {
    const result = await generateSessionRecap('', '', undefined, {
      campaign: makeCampaign(),
    });

    expect(allCalls()).toHaveLength(2);
    expect(contextOf(gmCall())).toBeUndefined();
    expect(contextOf(playerCall())).toContain('Campaign: The Ashen Compact');
    expect(result.playerFacingRecap).toBe('PLAYER RECAP TEXT');
  });

  it('handles a campaign whose secrets array is undefined', async () => {
    const campaign = makeCampaign({ npcs: [], secrets: undefined });

    await generateSessionRecap(SESSION_NOTES, '', undefined, { campaign });

    expect(contextOf(playerCall())).toBe(
      buildCampaignContext({ variant: 'player-safe', campaign })
    );
  });

  it('propagates a provider failure rather than returning a partial recap', async () => {
    vi.mocked(core.generateWithSchema).mockRejectedValue(new Error('provider exploded'));

    await expect(
      generateSessionRecap(SESSION_NOTES, PLOT_SUMMARIES, GM_CONTEXT, {
        campaign: makeLoadedCampaign(),
      })
    ).rejects.toThrow('provider exploded');
  });
});
