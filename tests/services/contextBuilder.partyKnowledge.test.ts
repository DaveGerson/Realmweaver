/**
 * Reveal state in `buildCampaignContext`. Everything is derived from the `Secret`
 * shape (`isRevealed`, `linkedEntityIds`, `category`, `title`, `content`) and
 * `campaign.secrets ?? []`, and every variant gets the same two sections:
 *
 * - Unrevealed secrets linked to what is in scope right now: the active scene,
 *   its NPCs and location, the focus entity, and the editor selection.
 * - Every revealed secret in the campaign as established party knowledge,
 *   scene-relevant ones first.
 *
 * `Secret.notes` is the DM's bookkeeping and is not sent to the model.
 */

import { describe, it, expect } from 'vitest';
import { buildCampaignContext, type ContextVariant } from '../../services/contextBuilder';
import {
  GM_PROSE,
  OFFSCENE_UNREVEALED_SECRET,
  PARTY_KNOWLEDGE_HEADER,
  REVEALED_SECRET,
  SCENE_ID,
  SCENE_LOCATION_ID,
  SCENE_NPC_ID,
  SCENE_UNREVEALED_SECRET,
  SECRET_NOTES,
  SESSION_ID,
  UNREVEALED_HEADER,
  makeCampaign,
  makeLoadedCampaign,
  makeLocation,
  makeNpc,
  makeSecret,
  secretLine,
} from './partyKnowledgeFixtures';

/** Rough token estimate matching the builder's internal formula. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const VARIANTS: ContextVariant[] = ['generation', 'coach', 'chat'];

// ===========================================================================
// Unrevealed secrets, scene-scoped
// ===========================================================================

describe.each(VARIANTS)('%s — unrevealed secrets linked to the active scene', variant => {
  const campaign = makeLoadedCampaign();
  const ctx = () =>
    buildCampaignContext({
      variant,
      campaign,
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

  it('emits the section header verbatim', () => {
    expect(ctx()).toContain(UNREVEALED_HEADER);
  });

  it('lists a scene-linked unrevealed secret in the exact entry format', () => {
    expect(ctx()).toContain(secretLine(SCENE_UNREVEALED_SECRET));
  });

  it('omits an unrevealed secret linked only to off-scene entities', () => {
    expect(ctx()).not.toContain(OFFSCENE_UNREVEALED_SECRET.title);
  });

  it('does not send Secret.notes', () => {
    expect(ctx()).not.toContain(SECRET_NOTES);
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

    expect(out).toContain(UNREVEALED_HEADER);
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

  it('omits the whole section when nothing is in scope', () => {
    const c = makeLoadedCampaign({ activeSceneId: undefined });
    const out = buildCampaignContext({ variant, campaign: c });

    expect(out).not.toContain(UNREVEALED_HEADER);
    expect(out).not.toContain(SCENE_UNREVEALED_SECRET.title);
  });

  it('omits a secret with no linkedEntityIds at all', () => {
    const c = makeLoadedCampaign({
      secrets: [makeSecret({ id: 's-orphan', title: 'Unlinked Truth', content: 'Floating.' })],
    });
    const out = buildCampaignContext({ variant, campaign: c, activeSceneId: SCENE_ID });

    expect(out).not.toContain('Unlinked Truth');
    expect(out).not.toContain(UNREVEALED_HEADER);
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
// Revealed secrets as established party knowledge
// ===========================================================================

describe.each(VARIANTS)('%s — revealed secrets are party knowledge', variant => {
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
  it('puts unrevealed before party knowledge, and both before the Tier-3 rosters', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
    });

    const unrevealed = out.indexOf(UNREVEALED_HEADER);
    const known = out.indexOf(PARTY_KNOWLEDGE_HEADER);
    const roster = out.indexOf('\nNPCs:');

    expect(unrevealed).toBeGreaterThanOrEqual(0);
    expect(known).toBeGreaterThan(unrevealed);
    expect(roster).toBeGreaterThan(known);
  });
});

// ===========================================================================
// The GM's own prose reaches the GM's own assistant
// ===========================================================================

describe.each(VARIANTS)('%s — the GM\'s prose', variant => {
  it('includes scene notes, prep notes, NPC traits and motivations, and plot threads', () => {
    const out = buildCampaignContext({
      variant,
      campaign: makeLoadedCampaign(),
      activeSceneId: SCENE_ID,
      activeSessionId: SESSION_ID,
    });

    expect(out).toContain(GM_PROSE.sceneGmNotes);
    expect(out).toContain(GM_PROSE.sessionPrepNotes);
    expect(out).toContain(GM_PROSE.npcTraits);
    expect(out).toContain(GM_PROSE.npcMotivations);
    expect(out).toContain(GM_PROSE.plotTitle);
  });
});

// ===========================================================================
// Budget
// ===========================================================================

describe('the secrets sections respect the token budget', () => {
  it.each(VARIANTS)('%s stays within budget with 60 secrets in scope', variant => {
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
    expect(out).toContain(UNREVEALED_HEADER);
    expect(out).toContain('…and');
  });

  // Realm Chat rebuilds its context on every message, so a campaign that has
  // revealed a lot must still leave the model room for the world rosters.
  it.each(['generation', 'chat'] as const)(
    '%s keeps its NPC and location rosters when 90 secrets are revealed',
    variant => {
      const npcs = Array.from({ length: 40 }, (_, i) => makeNpc({ id: `npc-${i}`, name: `Townsfolk ${i}` }));
      const locations = Array.from({ length: 20 }, (_, i) => makeLocation({ id: `loc-${i}`, name: `Landmark ${i}` }));
      const secrets = Array.from({ length: 90 }, (_, i) =>
        makeSecret({
          id: `rev-${i}`,
          title: `Revealed ${i}`,
          content: 'The party learned this the hard way, and it changed how they deal with the city watch for good.',
          category: 'revelation',
          isRevealed: true,
          linkedEntityIds: [`npc-${i % 40}`],
        })
      );

      const out = buildCampaignContext({ variant, campaign: makeCampaign({ npcs, locations, secrets }) });

      expect(out).toContain(PARTY_KNOWLEDGE_HEADER);
      expect(out).toMatch(/…and \d+ more/);
      expect(out).toContain('NPCs:');
      expect(out).toContain('Townsfolk 0');
      expect(out).toContain('Locations:');
      expect(out).toContain('Landmark 0');
    }
  );
});

// ===========================================================================
// `isRevealed` truthiness, not `===`
// ===========================================================================

describe('a secret with isRevealed left undefined', () => {
  it('counts as unrevealed', () => {
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

    expect(out).toContain(UNREVEALED_HEADER);
    expect(out).toContain('No Reveal Flag Set');
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });
});

// ===========================================================================
// Purity and empty/missing data
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

    buildCampaignContext({ variant: 'generation', campaign, activeSceneId: SCENE_ID });

    expect(JSON.stringify(campaign)).toBe(before);
  });

  it.each(VARIANTS)('%s survives a campaign with secrets undefined', variant => {
    const campaign = makeCampaign();
    expect(campaign.secrets).toBeUndefined();

    const out = buildCampaignContext({ variant, campaign });
    expect(out).toContain('Campaign: The Ashen Compact');
    expect(out).not.toContain(UNREVEALED_HEADER);
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });

  it.each(VARIANTS)('%s survives an empty secrets array, no active scene and no sessions', variant => {
    const out = buildCampaignContext({
      variant,
      campaign: makeCampaign({ secrets: [] }),
    });

    expect(out).not.toContain(UNREVEALED_HEADER);
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });

  it('handles an activeSceneId that matches no scene', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign(),
      activeSceneId: 'no-such-scene',
    });

    expect(out).toContain('Campaign: The Ashen Compact');
    expect(out).not.toContain(UNREVEALED_HEADER);
  });

  it('handles a campaign with only unrevealed secrets (no party knowledge yet)', () => {
    const out = buildCampaignContext({
      variant: 'generation',
      campaign: makeLoadedCampaign({ secrets: [SCENE_UNREVEALED_SECRET] }),
      activeSceneId: SCENE_ID,
    });

    expect(out).toContain(UNREVEALED_HEADER);
    expect(out).not.toContain(PARTY_KNOWLEDGE_HEADER);
  });
});
