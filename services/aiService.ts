
import type { NPC, Location, Faction, RollableTable, Item, Scene, Adventure, Article, PointOfInterest, PlayerCharacter, RealmChatResponse, ChatMessage, DraftEntity, ModelTier, Campaign } from '../types/index';
import type { BatchAddData, AdventureForBatchAdd, SceneType, SceneStatus } from '../types/index';
import type { WorldEvent } from './ai/worldSimulation';
import type { AudioTranscriptionConfig, AudioTranscriptionSession } from './ai/audioTranscription';

import * as aiRealmWeaver from './ai/realmWeaver';
// R2 ("Generate ten") — the proposal wire shape. Nothing is persisted until the
// GM keeps a card, so it is not a `types/` entity; re-exported here so
// components never reach into `services/ai/*` (CLAUDE.md).
import type { SecretDraft } from './ai/realmWeaver';
export type { SecretDraft } from './ai/realmWeaver';
import * as aiDmCoach from './ai/dmCoach';
// Re-exported so callers can build the E3 player-safe recap context without
// reaching past this facade (CLAUDE.md) — see `generateSessionRecap` below.
export type { PlayerSafeRecapContext } from './ai/dmCoach';
// P2 (Callback Machine): callers assemble the request shape, so the facade
// re-exports it rather than making them reach into `services/ai/*`.
export type { CallbackComplicationRequest } from './ai/dmCoach';
// P4 (cold open): same reason — the caller assembles the request.
export type { ColdOpenRequest } from './ai/dmCoach';
// §4.8 (Extras & spear-carriers): the wire shape for a promotable draft —
// re-exported so components never reach into `services/ai/*` (CLAUDE.md).
export type { ExtraNpc } from './ai/dmCoach';
// Re-exported as-is rather than wrapped: a pure predicate over the campaign
// with no mock-mode branch, so the Session Prep Wizard can ask whether a cold
// open has anything to draw on without importing `services/ai/*` (CLAUDE.md).
export { hasColdOpenMaterial } from './ai/dmCoach';
import * as aiEvocationWizard from './ai/evocationWizard';
import * as aiRealmChat from './ai/realmChat';
import * as aiWorldSimulation from './ai/worldSimulation';
import * as aiStyleMatching from './ai/styleMatching';
import * as mockService from './ai/mockService';
import * as aiAudioTranscription from './ai/audioTranscription';

// Re-exported so SessionLogEditor can type its AI Scribe session without
// reaching past this facade (CLAUDE.md).
export type { AudioTranscriptionConfig, AudioTranscriptionSession };

// Re-exported as-is rather than wrapped: it is a pure validation predicate
// with no mock-mode branch, so WorldSimulationWizard can reach it without
// importing `services/ai/*` (CLAUDE.md).
export { isValidSuggestedUpdate } from './ai/worldSimulation';

export const generateNpc = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  if (isMockMode) {
    return mockService.generateNpc(prompt, false, campaignContext);
  }
  return aiRealmWeaver.generateNpc(prompt, campaignContext);
};

export const generateLocation = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
    if (isMockMode) {
        return mockService.generateLocation(prompt, campaignContext);
    }
    return aiRealmWeaver.generateLocation(prompt, campaignContext);
};

export const generateFaction = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
    if (isMockMode) {
        return mockService.generateFaction(prompt, campaignContext);
    }
    return aiRealmWeaver.generateFaction(prompt, campaignContext);
};

export const generateItem = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Item, 'id'>> => {
    if (isMockMode) {
        return mockService.generateItem(prompt, campaignContext);
    }
    return aiRealmWeaver.generateItem(prompt, campaignContext);
};

export const generateScene = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
    if (isMockMode) {
        return mockService.generateScene(prompt, campaignContext);
    }
    return aiRealmWeaver.generateScene(prompt, campaignContext);
};

export const generateAdventure = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<AdventureForBatchAdd> => {
    if (isMockMode) {
        return mockService.generateAdventure(prompt, campaignContext);
    }
    return aiRealmWeaver.generateAdventure(prompt, campaignContext);
};

/**
 * R2 — "Generate ten, keep what you like" for the Secrets Tracker. One model
 * call proposes roughly ten secrets/clues from the campaign context; the caller
 * shows them as checkable preview cards and only creates the checked ones.
 */
export const generateSecretBatch = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<SecretDraft[]> => {
    if (isMockMode) {
        return mockService.generateSecretBatch(prompt, campaignContext);
    }
    return aiRealmWeaver.generateSecretBatch(prompt, campaignContext);
};

/**
 * Lazy DM step 5 ("develop fantastic locations") — retrofits 2-3 sensory
 * one-liners onto a location that predates `aspects` (or had them cleared).
 * Zero-typed-prompt: the request is built entirely from the location's own
 * name/description, the same convention as `generateSecretBatch`.
 */
export const generateLocationAspects = (
    location: { name: string; description: string },
    isMockMode: boolean = false,
    campaignContext?: string,
): Promise<string[]> => {
    if (isMockMode) {
        return mockService.generateLocationAspects(location, campaignContext);
    }
    return aiRealmWeaver.generateLocationAspects(location, campaignContext);
};

export const generateArticle = (prompt: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> => {
    if (isMockMode) {
        return mockService.generateArticle(prompt, campaignContext);
    }
    return aiRealmWeaver.generateArticle(prompt, campaignContext);
};

export const generateNarration = (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = false): Promise<string> => {
    if (isMockMode) {
        return mockService.generateNarration(prompt, campaignContext, useLiteModel, isMockMode);
    }
    return aiDmCoach.generateNarration(prompt, campaignContext, useLiteModel);
};

export const generateImprovisation = (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = false): Promise<string> => {
    if (isMockMode) {
        return mockService.generateImprovisation(prompt, campaignContext, useLiteModel, isMockMode);
    }
    return aiDmCoach.generateImprovisation(prompt, campaignContext, useLiteModel);
};

/**
 * P2 — the Callback Machine. Zero-prompt: the caller samples dormant campaign
 * material and hands it over with a coach-variant context; the DM types
 * nothing. GM-facing only — the result belongs in the running log, never in a
 * player-facing recap.
 */
export const generateCallbackComplication = (
    request: aiDmCoach.CallbackComplicationRequest,
    isMockMode: boolean = false
): Promise<string> => {
    if (isMockMode) {
        return mockService.generateCallbackComplication(request);
    }
    return aiDmCoach.generateCallbackComplication(request);
};

/**
 * §4.2 — GM Intrusion. Zero-prompt and zero-precondition: unlike
 * `generateCallbackComplication` above, this never needs dormant material and
 * never throws on an empty campaign, so it is the one live-complication
 * button that still works in a brand-new campaign's first session. GM-facing
 * only, same as Callback — the result belongs in the running log, never in a
 * player-facing recap.
 */
export const generateGmIntrusion = (
    isMockMode: boolean = false,
    campaignContext?: string,
    sceneSummary?: string,
    useLiteModel: boolean = false
): Promise<string> => {
    if (isMockMode) {
        return mockService.generateGmIntrusion(campaignContext, sceneSummary, useLiteModel);
    }
    return aiDmCoach.generateGmIntrusion(campaignContext, sceneSummary, useLiteModel);
};

/**
 * §4.8 — Extras & spear-carriers. Generates `count` throwaway name +
 * one-line-detail pairs for a crowd scene — lighter than a full NPC record,
 * with each line individually promotable to one via `campaignService.createNpc`.
 */
export const generateExtras = (
    count: number,
    campaignContext?: string,
    useLiteModel: boolean = false,
    isMockMode: boolean = false
): Promise<aiDmCoach.ExtraNpc[]> => {
    if (isMockMode) {
        return mockService.generateExtras(count, campaignContext, useLiteModel);
    }
    return aiDmCoach.generateExtras(count, campaignContext, useLiteModel);
};

/**
 * P4 — the "Previously on…" cold open. Zero-prompt: the caller hands over the
 * campaign (and, optionally, a context string it built) and the draft is
 * composed from the last completed session's recap + loose ends + the most
 * recent engraved moments, in the campaign's styleProfile voice.
 */
export const generateColdOpen = (
    request: aiDmCoach.ColdOpenRequest,
    isMockMode: boolean = false
): Promise<string> => {
    if (isMockMode) {
        return mockService.generateColdOpen(request);
    }
    return aiDmCoach.generateColdOpen(request);
};

// §4.1 Scene Menu Generator — the proposal wire shape. Nothing is persisted
// until the DM keeps a draft (folded into the Session Prep Wizard's own
// `lazyBeats` state), so it is not a `types/` entity; re-exported here so
// components never reach into `services/ai/*` (CLAUDE.md).
export type { SceneMenuDraft } from './ai/dmCoach';
// §4.6 Strong Start Styles — same reasoning: the caller assembles the request.
export type { StrongStartRequest } from './ai/dmCoach';

/**
 * §4.1 Scene Menu Generator — zero-prompt: the "prompt" is a fixed constant
 * inside `dmCoach.ts`, never DM-typed. Widens the lazy path's Beats step with
 * a generate -> preview -> keep-some flow, mirroring R2's `generateSecretBatch`
 * one step down in scale.
 */
export const generateSceneMenu = (
    campaignContext?: string,
    isMockMode: boolean = false
): Promise<aiDmCoach.SceneMenuDraft[]> => {
    if (isMockMode) {
        return mockService.generateSceneMenu(campaignContext);
    }
    return aiDmCoach.generateSceneMenu(campaignContext);
};

/**
 * §4.6 Strong Start Styles — widens the cold open with two more zero-prompt
 * drafting angles ('action', 'reincorporate'). The 'previously-on' style is
 * NOT here — it continues to call `generateColdOpen` verbatim, unchanged.
 */
export const generateStrongStart = (
    request: aiDmCoach.StrongStartRequest,
    isMockMode: boolean = false
): Promise<string> => {
    if (isMockMode) {
        return mockService.generateStrongStart(request);
    }
    return aiDmCoach.generateStrongStart(request);
};

export const generateRollableTable = (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = false): Promise<RollableTable> => {
    if (isMockMode) {
        return mockService.generateRollableTable(prompt, campaignContext, useLiteModel, isMockMode);
    }
    return aiDmCoach.generateRollableTable(prompt, campaignContext, useLiteModel);
};

export const generateCampaignFill = (prompt: string, options: { npcs: boolean, locations: boolean, factions: boolean, adventures: boolean, items: boolean }, isMockMode: boolean = false, campaignContext?: string): Promise<BatchAddData> => {
    if (isMockMode) {
        return mockService.generateCampaignFill(prompt, options, isMockMode, campaignContext);
    }
    return aiEvocationWizard.generateCampaignFill(prompt, options, campaignContext);
};

export const generateEnhancedText = (prompt: string, campaignContext?: string, isMockMode: boolean = false): Promise<string> => {
    if (isMockMode) {
        return mockService.generateEnhancedText(prompt, campaignContext);
    }
    return aiDmCoach.generateEnhancedText(prompt, campaignContext);
};

export const generatePoiFromLoot = (prompt: string, campaignContext?: string, isMockMode: boolean = false): Promise<Omit<PointOfInterest, 'id'>> => {
    if (isMockMode) {
        return mockService.generatePoiFromLoot(prompt, campaignContext, isMockMode);
    }
    return aiRealmWeaver.generatePoiFromLoot(prompt, campaignContext);
};

export const parseDocumentForEntities = (documentContent: string, isMockMode: boolean = false, campaignContext?: string): Promise<BatchAddData> => {
    if (isMockMode) {
        return mockService.generateCampaignFill(documentContent, { npcs: true, locations: true, factions: true, adventures: true, items: true }, isMockMode, campaignContext);
    }
    return aiEvocationWizard.parseDocumentForEntities(documentContent, campaignContext);
}

export const generateChatResponse = (history: { role: 'user' | 'model', text: string }[], campaignContext?: string, isMockMode: boolean = false): Promise<string> => {
    if (isMockMode) {
        return mockService.generateChatResponse(history, campaignContext, isMockMode);
    }
    return aiEvocationWizard.generateChatResponse(history, campaignContext);
}

export const parseCharacterSheetPdf = (pdfBase64: string, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<PlayerCharacter, 'id'>> => {
    if (isMockMode) {
        return mockService.parseCharacterSheetPdf(pdfBase64, campaignContext, isMockMode);
    }
    return aiEvocationWizard.parseCharacterSheetPdf(pdfBase64, campaignContext);
}

export const chatWithRealmWeaver = (
    history: ChatMessage[],
    currentDrafts: DraftEntity[],
    approvedEntitiesLog: string[],
    campaignContext: string,
    tier: ModelTier,
    isMockMode: boolean = false,
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'scene'
): Promise<RealmChatResponse> => {
    if (isMockMode) {
        return mockService.chatWithRealmWeaver(history, currentDrafts, approvedEntitiesLog, campaignContext, tier, focusedEntityType);
    }
    return aiRealmChat.chatWithRealmWeaver(history, currentDrafts, approvedEntitiesLog, campaignContext, tier, focusedEntityType);
};

export const analyzeSessionNotes = (notes: string, knownEntityNames: string[], campaignContext?: string, isMockMode: boolean = false): Promise<{entries: {content: string, relatedEntityNames: string[]}[]}> => {
    if (isMockMode) {
        return mockService.analyzeSessionNotes(notes, knownEntityNames, campaignContext);
    }
    return aiDmCoach.analyzeSessionNotes(notes, knownEntityNames, campaignContext);
}

export const generateNpcRoleplay = (
    npcContext: string,
    conversationHistory: Array<{ role: string; text: string }>,
    userMessage: string,
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<{ dialogue: string; moodCue: string }> => {
    if (isMockMode) {
        return mockService.generateNpcRoleplay(npcContext, conversationHistory, userMessage, campaignContext);
    }
    return aiRealmChat.generateNpcRoleplay(npcContext, conversationHistory, userMessage, campaignContext);
};

/**
 * Table Pulse, §4.3 of the lazy-DM research doc — "Ask the Table" (P5's
 * narrowest slice: `PlayerCharacter.playerFlags` only). Zero-prompt: the DM
 * taps one button and gets a short list of between-session check-in
 * questions, personalized with any player appetites already on the roster.
 */
export const generateCheckInQuestions = (
    request: aiDmCoach.CheckInQuestionsRequest = {},
    isMockMode: boolean = false
): Promise<string[]> => {
    if (isMockMode) {
        return mockService.generateCheckInQuestions(request);
    }
    return aiDmCoach.generateCheckInQuestions(request);
};

export const generateSessionRecap = (
    sessionNotes: string,
    plotSummaries: string,
    campaignContext?: string,
    isMockMode: boolean = false,
    // E3: when supplied, dmCoach derives the player-facing half's context via
    // buildCampaignContext({ variant: 'player-safe', ... }) internally — see
    // tests/services/dmCoach.playerSafeRecap.test.ts. Ignored in mock mode
    // (the mock response is canned and never touches campaign context).
    playerSafe?: aiDmCoach.PlayerSafeRecapContext
): Promise<{ recap: string; looseEnds: string[]; playerFacingRecap: string }> => {
    if (isMockMode) {
        return mockService.generateSessionRecap(sessionNotes, plotSummaries, campaignContext);
    }
    return aiDmCoach.generateSessionRecap(sessionNotes, plotSummaries, campaignContext, playerSafe);
};

export const generateStarterNpcs = (
    worldDescription: string,
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<Array<Omit<NPC, 'id' | 'factionId'>>> => {
    if (isMockMode) {
        return mockService.generateStarterNpcs(worldDescription, campaignContext);
    }
    return aiEvocationWizard.generateStarterNpcs(worldDescription, campaignContext);
};

export const generateStarterLocations = (
    worldDescription: string,
    npcs: Array<Omit<NPC, 'id' | 'factionId'>>,
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>> => {
    if (isMockMode) {
        return mockService.generateStarterLocations(worldDescription, npcs, campaignContext);
    }
    return aiEvocationWizard.generateStarterLocations(worldDescription, npcs, campaignContext);
};

const SCENE_TYPES: readonly SceneType[] = ['combat', 'social', 'exploration', 'puzzle'];
const SCENE_STATUSES: readonly SceneStatus[] = ['planned', 'in-progress', 'completed'];

/**
 * Mock data returns `scenes[].type` / `scenes[].status` as plain `string`
 * (mockService.ts isn't schema-typed against Scene), so it doesn't
 * structurally satisfy `AdventureForBatchAdd`. This narrows those two
 * fields to their real literal union types (falling back to a sane default
 * if the mock ever returns an unrecognized value) instead of widening
 * `AdventureForBatchAdd` or casting through `any`.
 */
const toAdventureForBatchAdd = (raw: {
    title: string;
    hook: string;
    theme: string;
    level: number;
    scenes: Array<Omit<Scene, 'id' | 'type' | 'status'> & { type: string; status: string }>;
}): AdventureForBatchAdd => ({
    title: raw.title,
    hook: raw.hook,
    theme: raw.theme,
    level: raw.level,
    scenes: raw.scenes.map(scene => ({
        ...scene,
        type: (SCENE_TYPES as string[]).includes(scene.type) ? (scene.type as SceneType) : 'social',
        status: (SCENE_STATUSES as string[]).includes(scene.status) ? (scene.status as SceneStatus) : 'planned',
    })),
});

export const generateStarterAdventure = (
    worldDescription: string,
    npcs: Array<Omit<NPC, 'id' | 'factionId'>>,
    locations: Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>,
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<AdventureForBatchAdd> => {
    if (isMockMode) {
        return mockService.generateStarterAdventure(worldDescription, npcs, locations, campaignContext)
            .then(toAdventureForBatchAdd);
    }
    return aiEvocationWizard.generateStarterAdventure(worldDescription, npcs, locations, campaignContext);
};

export const analyzeWritingStyle = (
    samples: string[],
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<string> => {
    if (isMockMode) {
        return mockService.analyzeWritingStyle(samples, campaignContext);
    }
    return aiStyleMatching.analyzeWritingStyle(samples, campaignContext);
};

/**
 * Starts a real-time audio transcription session (AI Scribe). Per
 * CLAUDE.md, this is the only entry point components should import — never
 * `services/ai/audioTranscription` directly — so mock mode is always
 * honoured (finding #42). Pass `isMockMode: true` on the config to route to
 * the mock, which emits canned transcript chunks on a timer and never
 * touches the microphone or the real-time Gemini Live API.
 */
export const startAudioTranscription = (
    config: AudioTranscriptionConfig & { isMockMode?: boolean }
): Promise<AudioTranscriptionSession> => {
    if (config.isMockMode) {
        return mockService.startAudioTranscription(config);
    }
    return aiAudioTranscription.startAudioTranscription(config);
};

export { WorldEvent };

export const generateWorldEvents = (
    campaign: Campaign,
    daysPassed: number,
    isMockMode: boolean = false,
    campaignContext?: string
): Promise<WorldEvent[]> => {
    if (isMockMode) {
        return mockService.generateWorldEvents(campaign, daysPassed, campaignContext);
    }
    return aiWorldSimulation.generateWorldEvents(campaign, daysPassed, campaignContext);
};
