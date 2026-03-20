
import type { NPC, Location, Faction, RollableTable, Item, Scene, Adventure, Article, PointOfInterest, PlayerCharacter, RealmChatResponse, ChatMessage, DraftEntity, ModelTier } from '../types/index';
import type { BatchAddData, AdventureForBatchAdd } from '../types/index';

import * as aiRealmWeaver from './ai/realmWeaver';
import * as aiDmCoach from './ai/dmCoach';
import * as aiEvocationWizard from './ai/evocationWizard';
import * as aiRealmChat from './ai/realmChat';
import * as mockService from './ai/mockService';

export const generateNpc = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  if (isMockMode) {
    return mockService.generateNpc(prompt, useGroundedSearch, campaignContext);
  }
  return aiRealmWeaver.generateNpc(prompt, useGroundedSearch, campaignContext);
};

export const generateLocation = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
    if (isMockMode) {
        return mockService.generateLocation(prompt, campaignContext);
    }
    return aiRealmWeaver.generateLocation(prompt, useGroundedSearch, campaignContext);
};

export const generateFaction = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
    if (isMockMode) {
        return mockService.generateFaction(prompt, campaignContext);
    }
    return aiRealmWeaver.generateFaction(prompt, useGroundedSearch, campaignContext);
};

export const generateItem = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Item, 'id'>> => {
    if (isMockMode) {
        return mockService.generateItem(prompt, campaignContext);
    }
    return aiRealmWeaver.generateItem(prompt, useGroundedSearch, campaignContext);
};

export const generateScene = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
    if (isMockMode) {
        return mockService.generateScene(prompt, campaignContext);
    }
    return aiRealmWeaver.generateScene(prompt, useGroundedSearch, campaignContext);
};

export const generateAdventure = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<AdventureForBatchAdd> => {
    if (isMockMode) {
        return mockService.generateAdventure(prompt, campaignContext);
    }
    return aiRealmWeaver.generateAdventure(prompt, useGroundedSearch, campaignContext);
};

export const generateArticle = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> => {
    if (isMockMode) {
        return mockService.generateArticle(prompt, campaignContext);
    }
    return aiRealmWeaver.generateArticle(prompt, useGroundedSearch, campaignContext);
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
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article'
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
