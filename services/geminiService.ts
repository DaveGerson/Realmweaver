import type { NPC, Location, Faction, RollableTable, Item, Scene, Adventure, Article, PointOfInterest } from '../types';
import type { BatchAddData, AdventureForBatchAdd } from '../types';

import * as aiRealmWeaver from './ai/realmWeaver';
import * as aiDmCoach from './ai/dmCoach';
import * as aiEvocationWizard from './ai/evocationWizard';
import * as mockService from './ai/mockService';

export const generateNpc = (prompt: string, useGroundedSearch: boolean = false, isMockMode: boolean = false, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  if (isMockMode) {
    return mockService.generateNpc(prompt, useGroundedSearch, campaignContext);
  }
  return aiRealmWeaver.generateNpc(prompt, useGroundedSearch, campaignContext);
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
}