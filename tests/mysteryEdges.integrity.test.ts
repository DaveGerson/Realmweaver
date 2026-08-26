/**
 * SPEC — Wave 2, lane SECRETS (E1): the `Secret.revealsSecretId` integrity contract.
 *
 * `types/Secret.ts` gains exactly three optional fields:
 *
 *   - `revealsSecretId?: string` — a clue-category secret points at the
 *     revelation-category secret it supports. This is an ID-BEARING edge.
 *   - `isVital?: boolean` — meaningful on revelations. Not id-bearing.
 *   - `cluesNeeded?: number` — per-revelation override of the three-clue
 *     threshold. Absent means 3. Not id-bearing.
 *
 * All three are optional, so a campaign saved before they existed is valid
 * exactly as it stands: nothing backfills them, nothing rewrites them, and a
 * secret that never sets them keeps reading back `undefined` forever.
 *
 * Because `revealsSecretId` is id-bearing it joins the hand-maintained N-place
 * integrity contract of `docs/architecture/semantic-model.html` §7. This file
 * pins the three stops that live in `services/campaignService.ts`; the
 * remaining two live in `tests/mysteryEdges.continuity.test.ts` (the
 * broken-reference lint) and `tests/mysteryEdges.backlinks.test.ts` (the
 * inbound edge). All five are mandatory before the lane is done.
 *
 * 1. **Cascade deletion.** `_purgeEntityReferences` clears `revealsSecretId`
 *    when — and only when — the secret it points at is the one being deleted.
 *    Deleting the clue does not touch the revelation (the edge is
 *    one-directional). Deleting anything else in the campaign leaves the edge
 *    alone. Every clue pointing at a deleted revelation is cleared, not just
 *    the first. `isVital` and `cluesNeeded` carry no id and are never swept.
 *
 * 2. **`duplicateCampaign` — idMap.get-or-keep.** A clue in the copy points at
 *    the COPY's revelation, never at the original's. An edge that was already
 *    dangling before the copy is PRESERVED verbatim (`idMap.get(id) ?? id`) —
 *    it must never be re-minted into a fresh UUID that points at nothing. The
 *    source campaign is left untouched. `isVital` / `cluesNeeded` ride along
 *    unchanged.
 *
 * 3. **`importTemplateData` — remap-or-drop.** A clue whose target is present
 *    in the same template resolves to that target's newly minted id. A clue
 *    whose target is absent from the template has `revealsSecretId` DROPPED
 *    (left `undefined`) — never preserved as a foreign id and never re-minted.
 *    `isVital` / `cluesNeeded` are carried through from the template as given.
 *
 * The lane's ONLY permitted `types/` change is these three fields.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    setupTestEnvironment,
    makeTestStore,
    type CreateCampaignStoreFn,
} from './helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

type Store = ReturnType<CreateCampaignStoreFn>;

/** Seeds one revelation and two clues pointing at it. */
function seedMystery(service: Store) {
    const revelationId = service.createSecret({
        title: 'The Duke is the drowned god',
        content: 'He has been dead for nine years.',
        category: 'revelation',
        isRevealed: false,
        isVital: true,
        cluesNeeded: 2,
    });
    const clueAId = service.createSecret({
        title: 'The wet footprints',
        content: 'They lead away from the throne, never toward it.',
        category: 'clue',
        isRevealed: false,
        revealsSecretId: revelationId,
    });
    const clueBId = service.createSecret({
        title: 'The sealed casket',
        content: 'It weighs nothing at all.',
        category: 'clue',
        isRevealed: false,
        revealsSecretId: revelationId,
    });
    return { revelationId, clueAId, clueBId };
}

const secretById = (service: Store, id: string) =>
    (service.getState().campaigns[0].secrets ?? []).find(s => s.id === id);

// ---------------------------------------------------------------------------
// 0. The fields themselves
// ---------------------------------------------------------------------------

describe('Secret — the three optional mystery fields round-trip through the store', () => {
    it('persists revealsSecretId, isVital and cluesNeeded exactly as given', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId } = seedMystery(service);

        const revelation = secretById(service, revelationId)!;
        expect(revelation.isVital).toBe(true);
        expect(revelation.cluesNeeded).toBe(2);

        expect(secretById(service, clueAId)!.revealsSecretId).toBe(revelationId);
    });

    it('leaves all three undefined on a secret written the old way', () => {
        const { service } = makeTestStore(createCampaignStore);
        const id = service.createSecret({
            title: 'An older save',
            content: 'Written before the mystery edges existed.',
            category: 'secret',
            isRevealed: false,
        });

        const secret = secretById(service, id)!;
        expect(secret.revealsSecretId).toBeUndefined();
        expect(secret.isVital).toBeUndefined();
        expect(secret.cluesNeeded).toBeUndefined();
    });

    it('lets updateSecret set and then clear the edge', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId } = seedMystery(service);
        const loneId = service.createSecret({
            title: 'A rumour with a home',
            content: 'They say the tide obeys him.',
            category: 'clue',
            isRevealed: false,
        });

        service.updateSecret(loneId, { revealsSecretId: revelationId });
        expect(secretById(service, loneId)!.revealsSecretId).toBe(revelationId);

        service.updateSecret(loneId, { revealsSecretId: undefined });
        expect(secretById(service, loneId)!.revealsSecretId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 1. Cascade deletion
// ---------------------------------------------------------------------------

describe('_purgeEntityReferences — deleting a revelation clears every clue pointing at it', () => {
    it('clears revealsSecretId on all inbound clues and keeps the clues themselves', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId, clueBId } = seedMystery(service);

        service.deleteSecret(revelationId);

        expect(secretById(service, revelationId)).toBeUndefined();
        expect(secretById(service, clueAId)).toBeDefined();
        expect(secretById(service, clueAId)!.revealsSecretId).toBeUndefined();
        expect(secretById(service, clueBId)!.revealsSecretId).toBeUndefined();
    });

    it('leaves the edge alone when a DIFFERENT secret is deleted', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId } = seedMystery(service);
        const unrelatedId = service.createSecret({
            title: 'An unrelated rumour',
            content: 'Nothing to do with the Duke.',
            category: 'rumor',
            isRevealed: false,
        });

        service.deleteSecret(unrelatedId);

        expect(secretById(service, clueAId)!.revealsSecretId).toBe(revelationId);
    });

    it('leaves the edge alone when an entity of another type is deleted', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId } = seedMystery(service);
        const npcId = service.createNpc({
            name: 'The Harbourmaster', description: '', traits: '', backstory: '',
            motivations: '', secrets: '', stats: '', exampleQuote: '',
            knowsPlayerHistory: [], relationships: [], history: [],
        });
        service.updateSecret(clueAId, { linkedEntityIds: [npcId] });

        service.deleteNpc(npcId);

        // The entity link is swept (existing behaviour); the mystery edge is not.
        expect(secretById(service, clueAId)!.linkedEntityIds).toEqual([]);
        expect(secretById(service, clueAId)!.revealsSecretId).toBe(revelationId);
    });

    it('does not touch the revelation when a clue is deleted (the edge is one-directional)', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId, clueBId } = seedMystery(service);

        service.deleteSecret(clueAId);

        const revelation = secretById(service, revelationId)!;
        expect(revelation.isVital).toBe(true);
        expect(revelation.cluesNeeded).toBe(2);
        expect(secretById(service, clueBId)!.revealsSecretId).toBe(revelationId);
    });

    it('never sweeps isVital or cluesNeeded — neither carries an id', () => {
        const { service } = makeTestStore(createCampaignStore);
        const { revelationId, clueAId } = seedMystery(service);

        service.deleteSecret(clueAId);

        const revelation = secretById(service, revelationId)!;
        expect(revelation.isVital).toBe(true);
        expect(revelation.cluesNeeded).toBe(2);
    });

    it('survives a campaign whose secrets array is empty', () => {
        const { service } = makeTestStore(createCampaignStore);
        const npcId = service.createNpc({
            name: 'Nobody', description: '', traits: '', backstory: '',
            motivations: '', secrets: '', stats: '', exampleQuote: '',
            knowsPlayerHistory: [], relationships: [], history: [],
        });

        expect(() => service.deleteNpc(npcId)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 2. duplicateCampaign — idMap.get-or-keep
// ---------------------------------------------------------------------------

describe('duplicateCampaign — the mystery edge is remapped into the copy', () => {
    it('points the copied clue at the COPIED revelation', () => {
        const { service } = makeTestStore(createCampaignStore);
        const ids = seedMystery(service);
        const sourceId = service.getState().campaigns[0].id;

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;

        const copyRevelation = copy.secrets!.find(s => s.category === 'revelation')!;
        const copyClueA = copy.secrets!.find(s => s.title === 'The wet footprints')!;
        const copyClueB = copy.secrets!.find(s => s.title === 'The sealed casket')!;

        // Sanity: the remap actually ran.
        expect(copyRevelation.id).not.toBe(ids.revelationId);

        expect(copyClueA.revealsSecretId).toBe(copyRevelation.id);
        expect(copyClueB.revealsSecretId).toBe(copyRevelation.id);
        expect(copyClueA.revealsSecretId).not.toBe(ids.revelationId);
    });

    it('carries isVital and cluesNeeded across unchanged', () => {
        const { service } = makeTestStore(createCampaignStore);
        seedMystery(service);
        const sourceId = service.getState().campaigns[0].id;

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;
        const copyRevelation = copy.secrets!.find(s => s.category === 'revelation')!;

        expect(copyRevelation.isVital).toBe(true);
        expect(copyRevelation.cluesNeeded).toBe(2);
    });

    it('preserves an already-dangling edge verbatim instead of minting a fresh UUID', () => {
        const { service } = makeTestStore(createCampaignStore);
        const clueId = service.createSecret({
            title: 'A clue with nowhere to go',
            content: 'Its revelation was deleted by hand in an exported file.',
            category: 'clue',
            isRevealed: false,
            revealsSecretId: 'a-revelation-that-never-existed',
        });
        const sourceId = service.getState().campaigns[0].id;

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;
        const copyClue = copy.secrets!.find(s => s.title === 'A clue with nowhere to go')!;

        expect(copyClue.id).not.toBe(clueId);
        expect(copyClue.revealsSecretId).toBe('a-revelation-that-never-existed');
    });

    it('leaves the source campaign untouched', () => {
        const { service } = makeTestStore(createCampaignStore);
        const ids = seedMystery(service);
        const sourceId = service.getState().campaigns[0].id;

        service.duplicateCampaign(sourceId);

        expect(secretById(service, ids.clueAId)!.revealsSecretId).toBe(ids.revelationId);
    });
});

// ---------------------------------------------------------------------------
// 3. importTemplateData — remap-or-drop
// ---------------------------------------------------------------------------

/** An export-shaped template carrying a full little mystery. */
function mysteryTemplate(): Record<string, unknown> {
    return {
        title: 'The Drowned Court',
        setting: 'A city that sank politely.',
        settingType: 'custom',
        secrets: [
            {
                id: 'tpl-revelation',
                title: 'The Duke is the drowned god',
                content: 'He has been dead for nine years.',
                category: 'revelation',
                isRevealed: false,
                isVital: true,
                cluesNeeded: 4,
            },
            {
                id: 'tpl-clue-good',
                title: 'The wet footprints',
                content: 'They lead away from the throne.',
                category: 'clue',
                isRevealed: false,
                revealsSecretId: 'tpl-revelation',
            },
            {
                id: 'tpl-clue-dangling',
                title: 'A clue from a half-edited export',
                content: 'Its revelation is not in this file.',
                category: 'clue',
                isRevealed: false,
                revealsSecretId: 'tpl-revelation-that-is-not-here',
            },
            {
                id: 'tpl-plain',
                title: 'A plain secret',
                content: 'No edges at all.',
                category: 'secret',
                isRevealed: false,
            },
        ],
    };
}

describe('importTemplateData — the mystery edge is remapped or dropped', () => {
    it('resolves an in-template edge to the newly minted revelation id', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.importTemplateData(mysteryTemplate());

        const secrets = campaign().secrets ?? [];
        const revelation = secrets.find(s => s.title === 'The Duke is the drowned god')!;
        const clue = secrets.find(s => s.title === 'The wet footprints')!;

        // Sanity: ids were re-minted, not copied from the template.
        expect(revelation.id).not.toBe('tpl-revelation');

        expect(clue.revealsSecretId).toBe(revelation.id);
    });

    it('drops an edge whose target is absent from the template', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.importTemplateData(mysteryTemplate());

        const dangling = (campaign().secrets ?? [])
            .find(s => s.title === 'A clue from a half-edited export')!;

        expect(dangling.revealsSecretId).toBeUndefined();
    });

    it('never re-mints a dropped edge into a fresh UUID pointing at nothing', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.importTemplateData(mysteryTemplate());

        const secrets = campaign().secrets ?? [];
        const knownIds = new Set(secrets.map(s => s.id));
        const dangling = secrets.find(s => s.title === 'A clue from a half-edited export')!;

        expect(dangling.revealsSecretId === undefined || knownIds.has(dangling.revealsSecretId)).toBe(true);
    });

    it('carries isVital and cluesNeeded through from the template', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.importTemplateData(mysteryTemplate());

        const revelation = (campaign().secrets ?? [])
            .find(s => s.title === 'The Duke is the drowned god')!;

        expect(revelation.isVital).toBe(true);
        expect(revelation.cluesNeeded).toBe(4);
    });

    it('leaves all three fields undefined on a template secret that omits them', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.importTemplateData(mysteryTemplate());

        const plain = (campaign().secrets ?? []).find(s => s.title === 'A plain secret')!;

        expect(plain.revealsSecretId).toBeUndefined();
        expect(plain.isVital).toBeUndefined();
        expect(plain.cluesNeeded).toBeUndefined();
    });
});
