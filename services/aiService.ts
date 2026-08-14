
import type { NPC, Location, Faction, RollableTable, Item, Scene, Adventure, Article, PointOfInterest, PlayerCharacter, RealmChatResponse, ChatMessage, DraftEntity, ModelTier, Campaign } from '../types/index';
import type { BatchAddData, AdventureForBatchAdd, SceneType, SceneStatus } from '../types/index';
import type { WorldEvent } from './ai/worldSimulation';
import type { AudioTranscriptionConfig, AudioTranscriptionSession } from './ai/audioTranscription';

import * as aiRealmWeaver from './ai/realmWeaver';
import * as aiDmCoach from './ai/dmCoach';
import * as aiEvocationWizard from './ai/evocationWizard';
import * as aiRealmChat from './ai/realmChat';
import * as aiWorldSimulation from './ai/worldSimulation';
import * as aiStyleMatching from './ai/styleMatching';
import * as mockService from './ai/mockService';
import * as aiAudioTranscription from './ai/audioTranscription';

// Re-exported so components need only ever import from this facade (never
// `services/ai/*` directly, per CLAUDE.md) — the AI Scribe types travel
// alongside the `startAudioTranscription` facade function below (finding
// #42; components/editors/SessionLogEditor.tsx is wp-f1-owned and still
// imports both the function AND these types straight from
// `services/ai/audioTranscription` — this re-export makes that swap a
// pure import-path change with no other edits required).
export type { AudioTranscriptionConfig, AudioTranscriptionSession };

// Re-exported for the same reason: components/dialogs/WorldSimulationWizard.tsx
// (wp-g1-owned) currently imports this validator as a VALUE straight from
// `services/ai/worldSimulation`, which is the exact CLAUDE.md facade
// violation this file exists to prevent. `isValidSuggestedUpdate` has no
// mock-mode branch (it's a pure validation predicate, not an AI call), so
// re-exporting it here — rather than adding a needless isMockMode-gated
// wrapper — lets wp-g1 swap its import path with no behaviour change.
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

export const generateSessionRecap = (
    sessionNotes: string,
    plotSummaries: string,
    campaignContext?: string,
    isMockMode: boolean = false
): Promise<{ recap: string; looseEnds: string[]; playerFacingRecap: string }> => {
    if (isMockMode) {
        return mockService.generateSessionRecap(sessionNotes, plotSummaries, campaignContext);
    }
    return aiDmCoach.generateSessionRecap(sessionNotes, plotSummaries, campaignContext);
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
