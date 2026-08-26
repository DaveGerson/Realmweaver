/**
 * SPEC — E3 (party-knowledge AI wiring), part 1 of 2: `services/contextBuilder.ts`
 * =============================================================================
 * Source: docs/architecture/ontology-tracker.md row E3 ·
 *         docs/architecture/ontology-proposal-evaluation.md §E3.
 * Zero schema change: everything below is derived from the existing
 * `Secret` shape (`isRevealed`, `linkedEntityIds`, `category`, `title`,
 * `content`, `notes`) and `campaign.secrets ?? []`.
 *
 * BEHAVIOR CONTRACT
 * -----------------
 * 1. Scene-relevant unrevealed secrets reach the GM context variants.
 *    The `'generation'` and `'coach'` variants gain a Tier-2 section listing
 *    every secret with `isRevealed === false` whose `linkedEntityIds`
 *    intersects the *scene relevance set*. The section header is exactly
 *        GM-ONLY — UNREVEALED SECRETS (never reveal to players):
 *    and each entry is exactly
 *        `  - [<category>] <title>: <content>`
 *    (content truncated to 160 chars with a trailing '…'; the `: <content>`
 *    half is omitted entirely when `content` is empty). `Secret.notes` is DM
 *    bookkeeping and is never emitted, in any variant.
 *
 * 2. The scene relevance set is the union of:
 *      - the active scene's own id, its `npcIds`, and its `locationId`
 *      - `focusEntityId` when provided
 *      - the non-null ids in `focusSelection` (the DM Coach's editor selection)
 *    A secret with no `linkedEntityIds`, or one linked only to entities outside
 *    that set, is NOT shown — the section is about *this* scene, not the whole
 *    campaign. With no active scene, no focus entity and no selection the set
 *    is empty and the section is omitted entirely.
 *
 * 3. Revealed secrets are established party knowledge. `'generation'`,
 *    `'coach'` and `'player-safe'` all gain a section headed exactly
 *        Established Party Knowledge (revealed secrets):
 *    listing EVERY secret with `isRevealed === true` in the campaign (not just
 *    scene-linked ones — the party remembers what it learned), same entry
 *    format, scene-relevant ones ordered first. When both sections are present
 *    the GM-ONLY section comes first, and both sit in Tier 2 — i.e. before the
 *    Tier-3 rosters (`NPCs:` / `Locations:` …).
 *
 * 4. `'chat'` is unchanged: it gains NEITHER secrets section.
 *
 * 5. New variant `'player-safe'`. `ContextVariant` widens to
 *    `'generation' | 'coach' | 'chat' | 'player-safe'`. The player-safe variant
 *    emits NO GM-authored private prose. Specifically it must never contain:
 *      - `NPC.secrets` or `Location.secrets` (including the focus-entity
 *        `  Secrets:` line)
 *      - `Scene.gmNotes` (the active-scene `  GM Notes:` line AND the
 *        `--- CURRENT USER FOCUS ---` scene `Notes:` line)
 *      - `SessionLog.prepNotes` / `SessionLog.runningNotes`
 *      - any unrevealed `Secret` (title, content or notes), and the GM-ONLY
 *        header itself
 *      - `Secret.notes` of revealed secrets
 *      - the `Active Plot Threads:` section (plot titles and descriptions are
 *        GM plan text)
 *    It still includes: campaign identity + setting, `styleProfile`, the active
 *    scene's title and read-aloud text, the Tier-3 rosters, and the
 *    established-party-knowledge section.
 *
 * 6. The never-leak rules hold at EVERY budget. Truncation may drop content but
 *    must never promote GM-only content into a player-safe context, and the
 *    existing budget contract (`maxTokenEstimate`) still holds with the
 *    secrets sections present.
 *
 * 7. `buildCampaignContext` stays pure: same options in ⇒ byte-identical string
 *    out, and it never mutates the campaign it is handed.
 *
 * 8. Missing/empty data is a no-op, not a crash: `campaign.secrets` may be
 *    `undefined` (it is optional on `Campaign`) or `[]`, there may be no active
 *    scene, no active session and no completed sessions.
 */

import { describe, it, expect } from 'vitest';
import { buildCampaignContext, type ContextVariant } from '../../services/contextBuilder';
import {
  ALL_CANARIES,
  CANARY,
  GM_ONLY_HEADER,
  PARTY_KNOWLEDGE_HEADER,
  OFFSCENE_UNREVEALED_SECRET,
  REVEALED_SECRET,
  SCENE_ID,
  SCENE_LOCATION_ID,
  SCENE_NPC_ID,
  SCENE_UNREVEALED_SECRET,
  SESSION_ID,
  makeCampaign,
  makeLoadedCampaign,
  makeNpc,
  makeSecret,
  secretLine,
} from './partyKnowledgeFixtures';

/** Rough token estimate matching the builder's internal formula. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/** The two GM-facing variants that gain the secrets sections. */
const GM_VARIANTS: ContextVariant[] = ['generation', 'coach'];

// ===========================================================================
// 1 + 2 — unrevealed secrets in the GM variants, scene-scoped
// ===========================================================================

describe.each(GM_VARIANTS)('GM variant %s — unrevealed secrets linked to the active scene', variant => {
  const campaign = makeLoadedCampaign();
  const ctx = () =>
    buildCampaignContext({
      variant,
      campaign,
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

  it('emits the GM-ONLY header verbatim', () => {
    expect(ctx()).toContain(GM_ONLY_HEADER);
  });

  it('lists a scene-linked unrevealed secret in the exact entry format', () => {
    expect(ctx()).toContain(secretLine(SCENE_UNREVEALED_SECRET));
  });

  it('omits an unrevealed secret linked only to off-scene entities', () => {
    expect(ctx()).not.toContain(OFFSCENE_UNREVEALED_SECRET.title);
  });

  it('never emits Secret.notes', () => {
    expect(ctx()).not.toContain(CANARY.secretNotes);
  });

  it('matches a secret linked to the active scene location', () => {
    const c = makeLoadedCampaign({
      secrets: [
        makeSecret({
          id: 's-loc',
          title: 'Cracks Beneath The Dais',
          content: 'The floor is hollow.',
          category: 'clue',
          linkedEntityIds: [SCENE_LOCATION_ID],
        }),
      ],
    });
    expect(
      buildCampaignContext({ variant, campaign: c, activeSceneId: SCENE_ID })
    ).toContain('Cracks Beneath The Dais');
  });

  it('matches a secret linked to the active scene itself', () => {
    const c = makeLoadedCampaign({
      secrets: [
        makeSecret({
          id: 's-scene',
          title: 'The Herald Is Late',
          content: 'Because he is already dead.',
          linkedEntityIds: [SCENE_ID],
        }),
      ],
    });
    expect(
      buildCampaignContext({ variant, campaign: c, activeSceneId: SCENE_ID })
    ).toContain('The Herald Is Late');
  });

  it('matches a secret linked to focusEntityId even with no active scene', () => {
    const c = makeCampaign({
      npcs: [makeNpc({ id: 'n-focus', name: 'Seraphina' })],
      secrets: [
        makeSecret({
          id: 's-focus',
          title: 'She Is The Lost Queen',
          content: 'Her signet ring is the proof.',
          linkedEntityIds: ['n-focus'],
        }),
      ],
    });

    const out = buildCampaignContext({
      variant,
      campaign: c,
      focusEntityId: 'n-focus',
      focusEntityType: 'npc',
    });

    expect(out).toContain(GM_ONLY_HEADER);
    expect(out).toContain('She Is The Lost Queen');
  });

  it('matches a secret linked to an id in focusSelection (DM Coach editor selection)', () => {
    const c = makeLoadedCampaign();
    const out = buildCampaignContext({
      variant,
      campaign: c,
      focusSelection: { selectedNpcId: OFFSCENE_UNREVEALED_SECRET.linkedEntityIds![0] },
    });

    expect(out).toContain(OFFSCENE_UNREVEALED_SECRET.title);
  });

  it('omits the whole GM-ONLY section when nothing is in scope', () => {
    const c = makeLoadedCampaign({ activeSceneId: undefined });
    const out = buildCampaignContext({ variant, campaign: c });

    expect(out).not.toContain(GM_ONLY_HEADER);
    expect(out).not.toContain(CANARY.unrevealedTitle);
  });

  it('omits a secret with no linkedEntityIds at all', () => {
    const c = makeLoadedCampaign({
      secrets: [makeSecret({ id: 's-orphan', title: 'Unlinked Truth', content: 'Floating.' })],
    });
    const out = buildCampaignContext({ variant, campaign: c, activeSceneId: SCENE_ID });

    expect(out).not.toContain('Unlinked Truth');
    expect(out).not.toContain(GM_ONLY_HEADER);
  });

  it('drops the ": content" half when the secret has empty content', () => {
    const bare = makeSecret({
      id: 's-bare',
      title: 'Titled Only',
      content: '',
      category: 'rumor',
      linkedEntityIds: [SCENE_NPC_ID],
    });
    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign({ secrets: [bare] }),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain('  - [rumor] Titled Only');
    expect(out).not.toContain('Titled Only:');
  });

  it('truncates long secret content to 160 characters with an ellipsis', () => {
    const long = 'x'.repeat(400);
    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign({
        secrets: [
          makeSecret({
            id: 's-long',
            title: 'Long One',
            content: long,
            category: 'clue',
            linkedEntityIds: [SCENE_NPC_ID],
          }),
        ],
      }),
      activeSceneId: SCENE_ID,
      maxTokenEstimate: 4000,
    });

    expect(out).toContain(`  - [clue] Long One: ${'x'.repeat(159)}…`);
    expect(out).not.toContain('x'.repeat(161));
  });
});

// ===========================================================================
// 3 — revealed secrets as established party knowledge
// ===========================================================================

describe.each(GM_VARIANTS)('GM variant %s — revealed secrets are party knowledge', variant => {
  it('emits the party-knowledge header and entry verbatim', () => {
    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain(PARTY_KNOWLEDGE_HEADER);
    expect(out).toContain(secretLine(REVEALED_SECRET));
  });

  it('includes revealed secrets that are not linked to the active scene', () => {
    const far = makeSecret({
      id: 's-far',
      title: 'The Bridge Toll Was A Lie',
      content: 'Learned three sessions ago.',
      category: 'revelation',
      isRevealed: true,
      linkedEntityIds: ['some-other-entity'],
    });
    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign({ secrets: [far] }),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain('The Bridge Toll Was A Lie');
  });

  it('orders scene-relevant revealed secrets before the rest', () => {
    const sceneLinked = makeSecret({
      id: 's-here',
      title: 'Vayne Signed The Writ',
      content: 'Seen by the party.',
      category: 'revelation',
      isRevealed: true,
      linkedEntityIds: [SCENE_NPC_ID],
    });
    const elsewhere = makeSecret({
      id: 's-elsewhere',
      title: 'The Ferry Sank',
      content: 'Old news.',
      category: 'revelation',
      isRevealed: true,
      linkedEntityIds: ['unrelated'],
    });

    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign({ secrets: [elsewhere, sceneLinked] }),
      activeSceneId: SCENE_ID,
    });

    expect(out.indexOf('Vayne Signed The Writ')).toBeGreaterThanOrEqual(0);
    expect(out.indexOf('Vayne Signed The Writ')).toBeLessThan(out.indexOf('The Ferry Sank'));
  });
});

describe('secrets section placement', () => {
  it('puts GM-ONLY before party knowledge, and both before the Tier-3 rosters', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
    });

    const gm = out.indexOf(GM_ONLY_HEADER);
    const known = out.indexOf(PARTY_KNOWLEDGE_HEADER);
    const roster = out.indexOf('\nNPCs:');

    expect(gm).toBeGreaterThanOrEqual(0);
    expect(known).toBeGreaterThan(gm);
    expect(roster).toBeGreaterThan(known);
  });
});

// ===========================================================================
// 4 — 'chat' is untouched
// ===========================================================================

describe("chat variant is unchanged by E3", () => {
  it('gains neither secrets section', () => {
    const out = buildCampaignContext({
      variant: 'chat',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

    expect(out).not.toContain(GM_ONLY_HEADER);
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
    expect(out).not.toContain(CANARY.unrevealedTitle);
  });

  it('still emits the campaign identity and Tier-3 rosters it emitted before', () => {
    const out = buildCampaignContext({ variant: 'chat', campaign: makeLoadedCampaign() });

    expect(out).toContain('Campaign: The Ashen Compact');
    expect(out).toContain('NPCs:');
    expect(out).toContain('Chancellor Vayne');
  });
});

// ===========================================================================
// 5 — the 'player-safe' variant
// ===========================================================================

describe("player-safe variant", () => {
  /** The maximal player-safe call: scene + session + focus entity + selection. */
  const playerSafe = () =>
    buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
      focusEntityId: SCENE_LOCATION_ID,
      focusEntityType: 'location',
      focusSelection: { selectedSceneId: SCENE_ID, selectedAdventureId: 'adv-1' },
    });

  it('leaks none of the GM-only canaries, with scene + session + focus + selection all set', () => {
    const out = playerSafe();
    for (const canary of ALL_CANARIES) {
      expect(out).not.toContain(canary);
    }
  });

  it('omits the GM-ONLY section header entirely', () => {
    expect(playerSafe()).not.toContain(GM_ONLY_HEADER);
  });

  it('omits every unrevealed secret, scene-linked or not', () => {
    const out = playerSafe();
    expect(out).not.toContain(SCENE_UNREVEALED_SECRET.title);
    expect(out).not.toContain(SCENE_UNREVEALED_SECRET.content);
    expect(out).not.toContain(OFFSCENE_UNREVEALED_SECRET.title);
  });

  it('includes revealed secrets as established party knowledge', () => {
    const out = playerSafe();
    expect(out).toContain(PARTY_KNOWLEDGE_HEADER);
    expect(out).toContain(secretLine(REVEALED_SECRET));
  });

  it('omits the Location.secrets line from the focus-entity block', () => {
    const out = playerSafe();
    expect(out).toContain('Focus Location — The Ash Court');
    expect(out).not.toContain('Secrets:');
    expect(out).not.toContain(CANARY.locationSecrets);
  });

  it('omits NPC.secrets prose even when the NPC is the focus entity', () => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign(),
      focusEntityId: SCENE_NPC_ID,
      focusEntityType: 'npc',
    });

    expect(out).toContain('Focus NPC — Chancellor Vayne');
    expect(out).not.toContain(CANARY.npcSecrets);
  });

  // MAJOR finding (Stage 1 review, item 1): `traits`/`motivations`/`backstory`
  // are GM-authored prose — hidden agendas, secret backstory beats — and are
  // exactly the "hidden motivations" category the player call's own
  // never-leak instruction bans. They must never reach a player-safe context,
  // whether the NPC is the focus entity or merely present in the active scene.
  it('omits NPC.traits/motivations/backstory from the focus-NPC block', () => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign(),
      focusEntityId: SCENE_NPC_ID,
      focusEntityType: 'npc',
    });

    expect(out).toContain('Focus NPC — Chancellor Vayne');
    expect(out).not.toContain('Traits:');
    expect(out).not.toContain('Motivations:');
    expect(out).not.toContain('Backstory:');
    expect(out).not.toContain(CANARY.npcTraits);
    expect(out).not.toContain(CANARY.npcMotivations);
    expect(out).not.toContain(CANARY.npcBackstory);
  });

  it('omits NPC.traits/motivations from the "NPCs in Scene" block, keeping only the name', () => {
    const out = playerSafe();

    expect(out).toContain('NPCs in Scene:');
    expect(out).toContain('Chancellor Vayne');
    expect(out).not.toContain(CANARY.npcTraits);
    expect(out).not.toContain(CANARY.npcMotivations);
  });

  it('omits the active scene GM Notes line but keeps the read-aloud text', () => {
    const out = playerSafe();
    expect(out).toContain('Active Scene: Audience in the Ash Court');
    expect(out).toContain('Ash drifts through the shattered dome');
    expect(out).not.toContain('GM Notes:');
    expect(out).not.toContain(CANARY.sceneGmNotes);
  });

  it('omits scene gmNotes from the CURRENT USER FOCUS block too', () => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign({ activeSceneId: undefined }),
      focusSelection: { selectedSceneId: SCENE_ID, selectedAdventureId: 'adv-1' },
    });

    expect(out).not.toContain(CANARY.sceneGmNotes);
  });

  it('omits NPC.traits from the CURRENT USER FOCUS "USER IS VIEWING NPC" block too', () => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign({ activeSceneId: undefined }),
      focusSelection: { selectedNpcId: SCENE_NPC_ID },
    });

    expect(out).toContain('USER IS VIEWING NPC: "Chancellor Vayne"');
    expect(out).not.toContain('Traits:');
    expect(out).not.toContain(CANARY.npcTraits);
  });

  it('omits session prep notes and running notes', () => {
    const out = playerSafe();
    expect(out).toContain('Active Session: Session 4 — The Ash Court');
    expect(out).not.toContain(CANARY.sessionPrepNotes);
    expect(out).not.toContain(CANARY.sessionRunningNotes);
  });

  it('omits the Active Plot Threads section', () => {
    const out = playerSafe();
    expect(out).not.toContain('Active Plot Threads:');
    expect(out).not.toContain(CANARY.plotTitle);
    expect(out).not.toContain(CANARY.plotDescription);
  });

  it('still includes campaign identity, style profile and the Tier-3 rosters', () => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign({ styleProfile: 'Wry, understated, lots of weather.' }),
    });

    expect(out).toContain('Campaign: The Ashen Compact');
    expect(out).toContain('Setting: A grim fantasy world');
    expect(out).toContain('Wry, understated, lots of weather.');
    expect(out).toContain('NPCs:');
    expect(out).toContain('Chancellor Vayne');
    expect(out).toContain('Locations:');
    expect(out).toContain('The Ash Court');
  });
});

// ===========================================================================
// 6 — never-leak holds at every budget; budget contract still holds
// ===========================================================================

describe('player-safe never leaks at any budget', () => {
  const budgets = [1, 20, 60, 120, 400, 4000];

  it.each(budgets)('leaks nothing at maxTokenEstimate=%i', maxTokenEstimate => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
      focusEntityId: SCENE_LOCATION_ID,
      focusEntityType: 'location',
      maxTokenEstimate,
    });

    for (const canary of ALL_CANARIES) {
      expect(out).not.toContain(canary);
    }
  });

  it.each(budgets)('respects the token budget at maxTokenEstimate=%i', maxTokenEstimate => {
    const out = buildCampaignContext({
      variant: 'player-safe',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      maxTokenEstimate,
    });

    expect(estimateTokens(out)).toBeLessThanOrEqual(maxTokenEstimate + 25);
  });
});

describe('the secrets sections respect the token budget in GM variants', () => {
  it.each(GM_VARIANTS)('%s stays within budget with 60 secrets in scope', variant => {
    const secrets = Array.from({ length: 60 }, (_, i) =>
      makeSecret({
        id: `s-${i}`,
        title: `Secret ${i}`,
        content: 'A reasonably long secret body that would blow a small budget on its own.',
        category: i % 2 === 0 ? 'clue' : 'secret',
        isRevealed: i % 3 === 0,
        linkedEntityIds: [SCENE_NPC_ID],
      })
    );

    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign({ secrets }),
      activeSceneId: SCENE_ID,
      maxTokenEstimate: 300,
    });

    expect(estimateTokens(out)).toBeLessThanOrEqual(325);
    // Truncated, not dropped: the section announces itself and marks the cut.
    expect(out).toContain(GM_ONLY_HEADER);
    expect(out).toContain('…and');
  });
});

// ===========================================================================
// MINOR finding (Stage 1 review, item 5) — `isRevealed` truthiness, not `===`
// ===========================================================================

describe('a secret with isRevealed left undefined (old/hand-edited save)', () => {
  it('is treated as unrevealed GM truth in the GM-ONLY section', () => {
    const undefinedRevealed = makeSecret({
      id: 's-undef',
      title: 'No Reveal Flag Set',
      content: 'Migrated from a save with no per-secret backfill.',
      category: 'clue',
      linkedEntityIds: [SCENE_NPC_ID],
    });
    // Simulating a legacy payload missing the field.
    delete undefinedRevealed.isRevealed;

    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign({ secrets: [undefinedRevealed] }),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain(GM_ONLY_HEADER);
    expect(out).toContain('No Reveal Flag Set');
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });
});

// ===========================================================================
// 7 + 8 — purity and empty/missing data
// ===========================================================================

describe('purity and degenerate inputs', () => {
  it('is deterministic — the same options produce a byte-identical string', () => {
    const campaign = makeLoadedCampaign();
    const opts = { variant: 'coach' as const, campaign, activeSceneId: SCENE_ID };

    expect(buildCampaignContext(opts)).toBe(buildCampaignContext(opts));
  });

  it('does not mutate the campaign it is given', () => {
    const campaign = makeLoadedCampaign();
    const before = JSON.stringify(campaign);

    buildCampaignContext({ variant: 'player-safe', campaign, activeSceneId: SCENE_ID });
    buildCampaignContext({ variant: 'generation', campaign, activeSceneId: SCENE_ID });

    expect(JSON.stringify(campaign)).toBe(before);
  });

  it.each<ContextVariant>(['generation', 'coach', 'chat', 'player-safe'])(
    '%s survives a campaign with secrets undefined',
    variant => {
      const campaign = makeCampaign();
      expect(campaign.secrets).toBeUndefined();

      const out = buildCampaignContext({ variant, campaign });
      expect(out).toContain('Campaign: The Ashen Compact');
      expect(out).not.toContain(GM_ONLY_HEADER);
      expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
    }
  );

  it.each<ContextVariant>(['generation', 'coach', 'chat', 'player-safe'])(
    '%s survives an empty secrets array, no active scene and no sessions',
    variant => {
      const out = buildCampaignContext({
        variant,
        campaign: makeCampaign({ secrets: [] }),
      });

      expect(out).not.toContain(GM_ONLY_HEADER);
      expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
    }
  );

  it('handles an activeSceneId that matches no scene', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign(),
      activeSceneId: 'no-such-scene',
    });

    expect(out).toContain('Campaign: The Ashen Compact');
    expect(out).not.toContain(GM_ONLY_HEADER);
  });

  it('handles a campaign with only unrevealed secrets (no party knowledge yet)', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign({ secrets: [SCENE_UNREVEALED_SECRET] }),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain(GM_ONLY_HEADER);
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });
});
