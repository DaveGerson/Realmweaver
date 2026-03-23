
import React, { useEffect, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { Icons } from '@/components/common/Icons';
import { campaignService } from '@/services/campaignService';
import type { NPC, Location, Faction, Item, Adventure, Article, Plot, SessionLog, PlayerCharacter, Scene } from '@/types/index';

// ─── Entity type configuration ──────────────────────────────────────────────

export type QuickCardEntityType = 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'plot' | 'session-log' | 'player-character' | 'scene';

interface EntityTypeConfig {
  label: string;
  badgeClass: string;       // bg-* text-* classes for the type badge
  borderClass: string;      // left-border accent class
  Icon: React.ElementType;
}

const ENTITY_CONFIG: Record<QuickCardEntityType, EntityTypeConfig> = {
  npc: {
    label: 'NPC',
    badgeClass: 'bg-amber-900/60 text-amber-300',
    borderClass: 'border-l-amber-500',
    Icon: Icons.NPCs,
  },
  location: {
    label: 'Location',
    badgeClass: 'bg-emerald-900/60 text-emerald-300',
    borderClass: 'border-l-emerald-500',
    Icon: Icons.Locations,
  },
  faction: {
    label: 'Faction',
    badgeClass: 'bg-violet-900/60 text-violet-300',
    borderClass: 'border-l-violet-500',
    Icon: Icons.Factions,
  },
  item: {
    label: 'Item',
    badgeClass: 'bg-sky-900/60 text-sky-300',
    borderClass: 'border-l-sky-500',
    Icon: Icons.Items,
  },
  adventure: {
    label: 'Adventure',
    badgeClass: 'bg-orange-900/60 text-orange-300',
    borderClass: 'border-l-orange-500',
    Icon: Icons.Adventures,
  },
  article: {
    label: 'Article',
    badgeClass: 'bg-cyan-900/60 text-cyan-300',
    borderClass: 'border-l-cyan-500',
    Icon: Icons.FileText,
  },
  plot: {
    label: 'Plot',
    badgeClass: 'bg-yellow-900/60 text-yellow-300',
    borderClass: 'border-l-yellow-500',
    Icon: Icons.Plot,
  },
  'session-log': {
    label: 'Session',
    badgeClass: 'bg-rose-900/60 text-rose-300',
    borderClass: 'border-l-rose-500',
    Icon: Icons.SessionLog,
  },
  'player-character': {
    label: 'Character',
    badgeClass: 'bg-indigo-900/60 text-indigo-300',
    borderClass: 'border-l-indigo-500',
    Icon: Icons.PlayerCharacters,
  },
  scene: {
    label: 'Scene',
    badgeClass: 'bg-blue-900/60 text-blue-300',
    borderClass: 'border-l-blue-500',
    Icon: Icons.Scenes,
  },
};

// ─── Entity detail types ─────────────────────────────────────────────────────

interface EntityDetail {
  label: string;
  value: string;
}

// Expanded detail — every field has an editable flag and an optional fieldKey for saving
interface ExpandedDetail {
  label: string;
  value: string;
  fieldKey?: string;    // The entity field name for saving (e.g. 'description')
  editable: boolean;
  multiline?: boolean;  // true => <textarea>, false/undefined => <input>
}

function truncate(text: string, maxLen = 80): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text;
}

// ── Compact detail extractors (collapsed mode, max 4 rows) ───────────────────

function getNpcDetails(npc: NPC, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];
  if (npc.description) {
    const firstLine = npc.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Description', value: truncate(firstLine, 60) });
  }
  if (npc.traits) details.push({ label: 'Traits', value: truncate(npc.traits, 80) });
  if (npc.factionId && campaign) {
    const faction = campaign.factions.find(f => f.id === npc.factionId);
    if (faction) details.push({ label: 'Faction', value: faction.name });
  }
  if (npc.motivations) details.push({ label: 'Motivation', value: truncate(npc.motivations, 80) });
  return details.slice(0, 4);
}

function getLocationDetails(loc: Location, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];
  if (loc.description) {
    const firstLine = loc.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Atmosphere', value: truncate(firstLine, 80) });
  }
  const connectionCount = (loc.connections?.length ?? 0) + (loc.subLocationIds?.length ?? 0);
  if (connectionCount > 0) details.push({ label: 'Connections', value: String(connectionCount) });
  if (loc.parentLocationId && campaign) {
    const parent = campaign.locations.find(l => l.id === loc.parentLocationId);
    if (parent) details.push({ label: 'Within', value: parent.name });
  }
  if (loc.controllingFactionId && campaign) {
    const faction = campaign.factions.find(f => f.id === loc.controllingFactionId);
    if (faction) details.push({ label: 'Controlled by', value: faction.name });
  }
  return details.slice(0, 4);
}

function getFactionDetails(faction: Faction, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];
  if (faction.alignment) details.push({ label: 'Alignment', value: faction.alignment });
  if (faction.goals) details.push({ label: 'Goals', value: truncate(faction.goals, 80) });
  if (faction.memberIds.length > 0) details.push({ label: 'Members', value: String(faction.memberIds.length) });
  if (faction.headquartersLocationId && campaign) {
    const hq = campaign.locations.find(l => l.id === faction.headquartersLocationId);
    if (hq) details.push({ label: 'HQ', value: hq.name });
  }
  return details.slice(0, 4);
}

function getItemDetails(item: Item): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Rarity', value: item.rarity });
  if (item.description) {
    const firstLine = item.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Description', value: truncate(firstLine, 80) });
  }
  if (item.properties) details.push({ label: 'Properties', value: truncate(item.properties, 80) });
  return details.slice(0, 4);
}

function getAdventureDetails(adventure: Adventure): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Scenes', value: String(adventure.scenes?.length ?? 0) });
  if (adventure.level) details.push({ label: 'Level', value: String(adventure.level) });
  if (adventure.theme) details.push({ label: 'Theme', value: truncate(adventure.theme, 60) });
  if (adventure.hook) details.push({ label: 'Hook', value: truncate(adventure.hook, 80) });
  return details.slice(0, 4);
}

function getArticleDetails(article: Article, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Category', value: article.category });
  if (article.content) {
    const firstLine = article.content.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Content', value: truncate(firstLine, 80) });
  }
  const relatedCount = article.relatedEntityIds?.length ?? 0;
  if (relatedCount > 0) details.push({ label: 'References', value: String(relatedCount) });
  if (article.parentArticleId && campaign) {
    const parent = campaign.articles.find(a => a.id === article.parentArticleId);
    if (parent) details.push({ label: 'Under', value: parent.title });
  }
  return details.slice(0, 4);
}

function getPlotDetails(plot: Plot): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Status', value: plot.status });
  if (plot.description) {
    const firstLine = plot.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Summary', value: truncate(firstLine, 80) });
  }
  if (plot.relatedEntityIds.length > 0) details.push({ label: 'Entities', value: String(plot.relatedEntityIds.length) });
  return details.slice(0, 4);
}

function getSessionLogDetails(log: SessionLog): EntityDetail[] {
  const details: EntityDetail[] = [];
  if (log.sessionDate) details.push({ label: 'Date', value: log.sessionDate });
  details.push({ label: 'Status', value: log.status });
  if (log.recap) {
    const firstLine = log.recap.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Recap', value: truncate(firstLine, 80) });
  } else if (log.runningNotes) {
    const firstLine = log.runningNotes.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Notes', value: truncate(firstLine, 80) });
  }
  if (log.structuredNotes.length > 0) details.push({ label: 'Entries', value: String(log.structuredNotes.length) });
  return details.slice(0, 4);
}

function getPlayerCharacterDetails(pc: PlayerCharacter): EntityDetail[] {
  const details: EntityDetail[] = [];
  const { characterSocial, characterStatistics } = pc;
  if (characterSocial.species) details.push({ label: 'Race', value: characterSocial.species });
  const { classes } = characterStatistics;
  if (classes) {
    const classStr = classes.subclass
      ? `${classes.subclass} ${classes.charClass} ${classes.level}`
      : `${classes.charClass} ${classes.level}`;
    details.push({ label: 'Class', value: classStr });
  }
  if (characterSocial.background) details.push({ label: 'Background', value: characterSocial.background });
  if (characterSocial.personality) details.push({ label: 'Personality', value: truncate(characterSocial.personality, 80) });
  return details.slice(0, 4);
}

// ── Expanded detail extractors (all fields, with editable metadata) ──────────

function getNpcExpandedDetails(npc: NPC, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: npc.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Description', value: npc.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Traits', value: npc.traits ?? '', fieldKey: 'traits', editable: true, multiline: true });
  details.push({ label: 'Motivations', value: npc.motivations ?? '', fieldKey: 'motivations', editable: true, multiline: true });
  details.push({ label: 'Secrets', value: npc.secrets ?? '', fieldKey: 'secrets', editable: true, multiline: true });
  if (npc.backstory) details.push({ label: 'Backstory', value: npc.backstory, editable: false });
  details.push({ label: 'Example Quote', value: npc.exampleQuote ?? '', fieldKey: 'exampleQuote', editable: true, multiline: true });
  if (npc.stats) details.push({ label: 'Stats', value: npc.stats, editable: false });
  if (npc.factionId && campaign) {
    const faction = campaign.factions.find(f => f.id === npc.factionId);
    if (faction) details.push({ label: 'Faction', value: faction.name, editable: false });
  }
  if (npc.relationships.length > 0) details.push({ label: 'Relationships', value: String(npc.relationships.length), editable: false });
  if (npc.history.length > 0) details.push({ label: 'History entries', value: String(npc.history.length), editable: false });
  return details;
}

function getLocationExpandedDetails(loc: Location, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: loc.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Description', value: loc.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Secrets', value: loc.secrets ?? '', fieldKey: 'secrets', editable: true, multiline: true });
  // readAloudText is not on the base Location type but some locations may carry it from generation
  const locAny = loc as Location & { readAloudText?: string };
  if (locAny.readAloudText !== undefined) {
    details.push({ label: 'Read-Aloud', value: locAny.readAloudText, fieldKey: 'readAloudText', editable: true, multiline: true });
  }
  if (loc.parentLocationId && campaign) {
    const parent = campaign.locations.find(l => l.id === loc.parentLocationId);
    if (parent) details.push({ label: 'Within', value: parent.name, editable: false });
  }
  if (loc.controllingFactionId && campaign) {
    const faction = campaign.factions.find(f => f.id === loc.controllingFactionId);
    if (faction) details.push({ label: 'Controlled by', value: faction.name, editable: false });
  }
  const connectionCount = (loc.connections?.length ?? 0) + (loc.subLocationIds?.length ?? 0);
  if (connectionCount > 0) details.push({ label: 'Connections', value: String(connectionCount), editable: false });
  if (loc.pointsOfInterest && loc.pointsOfInterest.length > 0)
    details.push({ label: 'Points of Interest', value: String(loc.pointsOfInterest.length), editable: false });
  if (loc.loot && loc.loot.length > 0) details.push({ label: 'Loot items', value: String(loc.loot.length), editable: false });
  if (loc.history.length > 0) details.push({ label: 'History entries', value: String(loc.history.length), editable: false });
  return details;
}

function getFactionExpandedDetails(faction: Faction, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: faction.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Description', value: faction.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Goals', value: faction.goals ?? '', fieldKey: 'goals', editable: true, multiline: true });
  if (faction.alignment) details.push({ label: 'Alignment', value: faction.alignment, editable: false });
  if (faction.resources) details.push({ label: 'Resources', value: faction.resources, editable: false });
  if (faction.influence) details.push({ label: 'Influence', value: faction.influence, editable: false });
  if (faction.leaderId && campaign) {
    const leader = campaign.npcs.find(n => n.id === faction.leaderId);
    if (leader) details.push({ label: 'Leader', value: leader.name, editable: false });
  }
  if (faction.headquartersLocationId && campaign) {
    const hq = campaign.locations.find(l => l.id === faction.headquartersLocationId);
    if (hq) details.push({ label: 'HQ', value: hq.name, editable: false });
  }
  details.push({ label: 'Members', value: String(faction.memberIds.length), editable: false });
  return details;
}

function getItemExpandedDetails(item: Item): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: item.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Rarity', value: item.rarity, editable: false });
  details.push({ label: 'Description', value: item.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Properties', value: item.properties ?? '', fieldKey: 'properties', editable: true, multiline: true });
  return details;
}

function getAdventureExpandedDetails(adventure: Adventure): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: adventure.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Hook', value: adventure.hook ?? '', fieldKey: 'hook', editable: true, multiline: true });
  details.push({ label: 'Theme', value: adventure.theme ?? '', fieldKey: 'theme', editable: true, multiline: false });
  details.push({ label: 'Level', value: String(adventure.level), editable: false });
  details.push({ label: 'Scenes', value: String(adventure.scenes?.length ?? 0), editable: false });
  return details;
}

function getArticleExpandedDetails(article: Article, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: article.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Category', value: article.category, editable: false });
  // Limit editable content preview to first 500 chars to keep the card manageable
  details.push({ label: 'Content', value: (article.content ?? '').slice(0, 500), fieldKey: 'content', editable: true, multiline: true });
  if (article.parentArticleId && campaign) {
    const parent = campaign.articles.find(a => a.id === article.parentArticleId);
    if (parent) details.push({ label: 'Under', value: parent.title, editable: false });
  }
  const relatedCount = article.relatedEntityIds?.length ?? 0;
  if (relatedCount > 0) details.push({ label: 'References', value: String(relatedCount), editable: false });
  return details;
}

function getPlotExpandedDetails(plot: Plot): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: plot.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Status', value: plot.status, editable: false });
  details.push({ label: 'Description', value: plot.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  if (plot.relatedEntityIds.length > 0) details.push({ label: 'Entities', value: String(plot.relatedEntityIds.length), editable: false });
  return details;
}

function getSessionLogExpandedDetails(log: SessionLog): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: log.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Status', value: log.status, editable: false });
  if (log.sessionDate) details.push({ label: 'Date', value: log.sessionDate, editable: false });
  details.push({ label: 'Recap', value: log.recap ?? '', fieldKey: 'recap', editable: true, multiline: true });
  if (log.prepNotes) details.push({ label: 'Prep Notes', value: log.prepNotes, editable: false });
  if (log.notableEvents) details.push({ label: 'Notable Events', value: log.notableEvents, editable: false });
  if (log.looseEnds) details.push({ label: 'Loose Ends', value: log.looseEnds, editable: false });
  details.push({ label: 'Structured entries', value: String(log.structuredNotes.length), editable: false });
  return details;
}

function getPlayerCharacterExpandedDetails(pc: PlayerCharacter): ExpandedDetail[] {
  const { characterSocial, characterStatistics } = pc;
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: characterSocial.characterName, editable: false });
  if (characterSocial.species) details.push({ label: 'Race', value: characterSocial.species, editable: false });
  const { classes } = characterStatistics;
  if (classes) {
    const classStr = classes.subclass
      ? `${classes.subclass} ${classes.charClass} ${classes.level}`
      : `${classes.charClass} ${classes.level}`;
    details.push({ label: 'Class', value: classStr, editable: false });
  }
  if (characterSocial.background) details.push({ label: 'Background', value: characterSocial.background, editable: false });
  if (characterSocial.personality) details.push({ label: 'Personality', value: characterSocial.personality, editable: false });
  if (characterSocial.ideals) details.push({ label: 'Ideals', value: characterSocial.ideals, editable: false });
  if (characterSocial.bonds) details.push({ label: 'Bonds', value: characterSocial.bonds, editable: false });
  if (characterSocial.flaws) details.push({ label: 'Flaws', value: characterSocial.flaws, editable: false });
  if (characterStatistics.proficiencyBonus)
    details.push({ label: 'Proficiency', value: `+${characterStatistics.proficiencyBonus}`, editable: false });
  return details;
}

// ── Master expanded-detail dispatcher ────────────────────────────────────────

function getExpandedDetails(
  entityType: QuickCardEntityType,
  entityId: string,
  campaign: ReturnType<typeof campaignService.getActiveCampaign>
): ExpandedDetail[] | null {
  if (!campaign) return null;
  switch (entityType) {
    case 'npc': {
      const npc = campaign.npcs.find(n => n.id === entityId);
      return npc ? getNpcExpandedDetails(npc, campaign) : null;
    }
    case 'location': {
      const loc = campaign.locations.find(l => l.id === entityId);
      return loc ? getLocationExpandedDetails(loc, campaign) : null;
    }
    case 'faction': {
      const faction = campaign.factions.find(f => f.id === entityId);
      return faction ? getFactionExpandedDetails(faction, campaign) : null;
    }
    case 'item': {
      const item = campaign.items.find(i => i.id === entityId);
      return item ? getItemExpandedDetails(item) : null;
    }
    case 'adventure': {
      const adv = campaign.adventures.find(a => a.id === entityId);
      return adv ? getAdventureExpandedDetails(adv) : null;
    }
    case 'article': {
      const article = campaign.articles.find(a => a.id === entityId);
      return article ? getArticleExpandedDetails(article, campaign) : null;
    }
    case 'plot': {
      const plot = campaign.plots.find(p => p.id === entityId);
      return plot ? getPlotExpandedDetails(plot) : null;
    }
    case 'session-log': {
      const log = campaign.sessionLogs.find(s => s.id === entityId);
      return log ? getSessionLogExpandedDetails(log) : null;
    }
    case 'player-character': {
      const pc = campaign.playerCharacters.find(p => p.id === entityId);
      return pc ? getPlayerCharacterExpandedDetails(pc) : null;
    }
    case 'scene': {
      for (const adv of campaign.adventures) {
        const scene = adv.scenes.find(s => s.id === entityId);
        if (scene) return getSceneExpandedDetails(scene, campaign);
      }
      return null;
    }
    default:
      return null;
  }
}

// ── Field save dispatcher ─────────────────────────────────────────────────────

function saveEntityField(entityType: QuickCardEntityType, entityId: string, fieldKey: string, value: string): void {
  switch (entityType) {
    case 'npc':
      campaignService.updateNpc(entityId, { [fieldKey]: value });
      break;
    case 'location':
      campaignService.updateLocation(entityId, { [fieldKey]: value });
      break;
    case 'faction':
      campaignService.updateFaction(entityId, { [fieldKey]: value });
      break;
    case 'item':
      campaignService.updateItem(entityId, { [fieldKey]: value });
      break;
    case 'adventure':
      campaignService.updateAdventure(entityId, { [fieldKey]: value });
      break;
    case 'article':
      campaignService.updateArticle(entityId, { [fieldKey]: value });
      break;
    case 'plot':
      campaignService.updatePlot(entityId, { [fieldKey]: value });
      break;
    case 'session-log':
      campaignService.updateSessionLog(entityId, { [fieldKey]: value });
      break;
    case 'scene': {
      const campaign = campaignService.getActiveCampaign();
      if (!campaign) break;
      for (const adv of campaign.adventures) {
        if (adv.scenes.some(s => s.id === entityId)) {
          campaignService.updateScene(adv.id, entityId, { [fieldKey]: value });
          break;
        }
      }
      break;
    }
    // player-character: no inline editing (complex nested structure)
    default:
      break;
  }
}

// ── Scene details ────────────────────────────────────────────────────────────

function getSceneDetails(scene: Scene, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Type', value: scene.type });
  if (scene.locationId && campaign) {
    const loc = campaign.locations.find(l => l.id === scene.locationId);
    if (loc) details.push({ label: 'Location', value: loc.name });
  }
  if (scene.npcIds.length > 0) {
    details.push({ label: 'NPCs', value: String(scene.npcIds.length) });
  }
  if (scene.readAloudText) {
    const firstLine = scene.readAloudText.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Read Aloud', value: truncate(firstLine, 80) });
  }
  return details.slice(0, 4);
}

function getSceneExpandedDetails(scene: Scene, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: scene.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Type', value: scene.type, editable: false });
  details.push({ label: 'Status', value: scene.status, editable: false });
  if (scene.locationId && campaign) {
    const loc = campaign.locations.find(l => l.id === scene.locationId);
    if (loc) details.push({ label: 'Location', value: loc.name, editable: false });
  }
  if (scene.npcIds.length > 0 && campaign) {
    const names = scene.npcIds.map(id => campaign.npcs.find(n => n.id === id)?.name).filter(Boolean).join(', ');
    if (names) details.push({ label: 'NPCs', value: names, editable: false });
  }
  details.push({ label: 'Read Aloud', value: scene.readAloudText ?? '', fieldKey: 'readAloudText', editable: true, multiline: true });
  details.push({ label: 'GM Notes', value: scene.gmNotes ?? '', fieldKey: 'gmNotes', editable: true, multiline: true });
  if (scene.rewards) details.push({ label: 'Rewards', value: scene.rewards, fieldKey: 'rewards', editable: true, multiline: true });
  return details;
}

// ── Compact entity lookup (used in collapsed mode) ────────────────────────────

function lookupEntity(
  entityType: QuickCardEntityType,
  entityId: string,
  campaign: ReturnType<typeof campaignService.getActiveCampaign>
): { name: string; details: EntityDetail[] } | null {
  if (!campaign) return null;

  switch (entityType) {
    case 'npc': {
      const npc = campaign.npcs.find(n => n.id === entityId);
      if (!npc) return null;
      return { name: npc.name, details: getNpcDetails(npc, campaign) };
    }
    case 'location': {
      const loc = campaign.locations.find(l => l.id === entityId);
      if (!loc) return null;
      return { name: loc.name, details: getLocationDetails(loc, campaign) };
    }
    case 'faction': {
      const faction = campaign.factions.find(f => f.id === entityId);
      if (!faction) return null;
      return { name: faction.name, details: getFactionDetails(faction, campaign) };
    }
    case 'item': {
      const item = campaign.items.find(i => i.id === entityId);
      if (!item) return null;
      return { name: item.name, details: getItemDetails(item) };
    }
    case 'adventure': {
      const adventure = campaign.adventures.find(a => a.id === entityId);
      if (!adventure) return null;
      return { name: adventure.title, details: getAdventureDetails(adventure) };
    }
    case 'article': {
      const article = campaign.articles.find(a => a.id === entityId);
      if (!article) return null;
      return { name: article.title, details: getArticleDetails(article, campaign) };
    }
    case 'plot': {
      const plot = campaign.plots.find(p => p.id === entityId);
      if (!plot) return null;
      return { name: plot.title, details: getPlotDetails(plot) };
    }
    case 'session-log': {
      const log = campaign.sessionLogs.find(s => s.id === entityId);
      if (!log) return null;
      return { name: log.title, details: getSessionLogDetails(log) };
    }
    case 'player-character': {
      const pc = campaign.playerCharacters.find(p => p.id === entityId);
      if (!pc) return null;
      return { name: pc.characterSocial.characterName, details: getPlayerCharacterDetails(pc) };
    }
    case 'scene': {
      for (const adv of campaign.adventures) {
        const scene = adv.scenes.find(s => s.id === entityId);
        if (scene) return { name: scene.title, details: getSceneDetails(scene, campaign) };
      }
      return null;
    }
    default:
      return null;
  }
}

// ─── Popover positioning ─────────────────────────────────────────────────────

interface PopoverPosition {
  top: number;
  left: number;
  openUpward: boolean;
}

function calculatePosition(triggerRect: DOMRect, isExpanded: boolean): PopoverPosition {
  // Use larger estimates when expanded so the card fits on screen
  const CARD_HEIGHT = isExpanded ? 480 : 240;
  const CARD_WIDTH  = isExpanded ? 384 : 280;
  const MARGIN = 8;
  const viewportHeight = window.innerHeight;
  const viewportWidth  = window.innerWidth;

  // Prefer opening below; flip upward if not enough space
  const openUpward = triggerRect.bottom + CARD_HEIGHT + MARGIN > viewportHeight
    && triggerRect.top - CARD_HEIGHT - MARGIN >= 0;

  const top = openUpward
    ? triggerRect.top + window.scrollY - CARD_HEIGHT - MARGIN
    : triggerRect.bottom + window.scrollY + MARGIN;

  // Align left with trigger but clamp to viewport
  let left = triggerRect.left + window.scrollX;
  if (left + CARD_WIDTH > viewportWidth - MARGIN) {
    left = viewportWidth - CARD_WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  return { top, left, openUpward };
}

// ─── EntityQuickCard (the floating card) ─────────────────────────────────────

export interface EntityQuickCardProps {
  entityType: QuickCardEntityType;
  entityId: string;
  triggerRect: DOMRect;
  /** Called when user clicks "View" or the card's navigate action */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Called when the popover should close */
  onClose: () => void;
  /** Called when the pointer enters the card (keeps it alive during hover) */
  onPointerEnter?: () => void;
  /** Called when the pointer leaves the card */
  onPointerLeave?: () => void;
}

export const EntityQuickCard: React.FC<EntityQuickCardProps> = ({
  entityType,
  entityId,
  triggerRect,
  onNavigate,
  onClose,
  onPointerEnter,
  onPointerLeave,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const config = ENTITY_CONFIG[entityType];

  const campaign = campaignService.getActiveCampaign();
  const entityData = lookupEntity(entityType, entityId, campaign);

  // Position recalculates on every render — isExpanded triggers re-render
  const { top, left } = calculatePosition(triggerRect, isExpanded);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we intercept before the trigger's own pointer handler
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const handleCopyName = useCallback(() => {
    if (entityData?.name) {
      navigator.clipboard.writeText(entityData.name).catch(() => {
        // Clipboard API may not be available in all contexts; silently ignore
      });
    }
    onClose();
  }, [entityData, onClose]);

  const handleNavigate = useCallback(() => {
    onNavigate(entityType, entityId);
    onClose();
  }, [onNavigate, entityType, entityId, onClose]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // ── Mobile bottom sheet ───────────────────────────────────────────────────
  // On screens narrower than 768px, render as a fixed bottom sheet overlay.
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPointerDown={(e) => {
          // Close when tapping the backdrop (not the card itself)
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      >
        <div
          ref={cardRef}
          className={`bg-stone-800 border-t-2 border-stone-600 border-l-4 ${config.borderClass} rounded-t-xl p-4 w-full overflow-y-auto shadow-xl transition-all duration-200 ${isExpanded ? 'max-h-[80vh]' : 'max-h-[60vh]'}`}
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <QuickCardContent
            config={config}
            entityData={entityData}
            entityType={entityType}
            entityId={entityId}
            onNavigate={handleNavigate}
            onCopyName={handleCopyName}
            onClose={onClose}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
          />
        </div>
      </div>,
      document.body
    );
  }

  // ── Desktop popover ───────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      className={`fixed z-50 bg-stone-800 border border-stone-600 border-l-4 ${config.borderClass} rounded-lg shadow-xl transition-all duration-200 ${isExpanded ? 'w-96' : 'w-72'}`}
      style={{ top, left }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <QuickCardContent
        config={config}
        entityData={entityData}
        entityType={entityType}
        entityId={entityId}
        onNavigate={handleNavigate}
        onCopyName={handleCopyName}
        onClose={onClose}
        isExpanded={isExpanded}
        onToggleExpand={handleToggleExpand}
      />
    </div>,
    document.body
  );
};

// ─── Editable field component ─────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  entityType: QuickCardEntityType;
  entityId: string;
  multiline?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  fieldKey,
  entityType,
  entityId,
  multiline,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value if the prop changes (external update from outside)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue === value) return; // no change, skip save
    saveEntityField(entityType, entityId, fieldKey, localValue);
    setSavedIndicator(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSavedIndicator(false), 1500);
  }, [localValue, value, entityType, entityId, fieldKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const baseInputClass =
    'w-full bg-stone-700/60 border border-stone-600 rounded text-xs text-stone-200 px-2 py-1 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder-stone-500 resize-none';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-stone-500 text-xs">{label}</span>
        {savedIndicator && (
          <span className="text-xs text-emerald-400 flex items-center gap-0.5">
            <Icons.Check className="w-3 h-3" />
            saved
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          className={`${baseInputClass} min-h-[60px]`}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          aria-label={label}
        />
      ) : (
        <input
          type="text"
          className={baseInputClass}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          aria-label={label}
        />
      )}
    </div>
  );
};

// ─── Inner card content (shared between mobile/desktop) ──────────────────────

interface QuickCardContentProps {
  config: EntityTypeConfig;
  entityData: { name: string; details: EntityDetail[] } | null;
  entityType: QuickCardEntityType;
  entityId: string;
  onNavigate: () => void;
  onCopyName: () => void;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const QuickCardContent: React.FC<QuickCardContentProps> = ({
  config,
  entityData,
  entityType,
  entityId,
  onNavigate,
  onCopyName,
  onClose,
  isExpanded,
  onToggleExpand,
}) => {
  const [pinned, setPinned] = useState(() => campaignService.isPinned(entityType, entityId));
  if (!entityData) {
    return (
      <div className="p-3 text-stone-400 text-sm">
        Entity not found.
      </div>
    );
  }

  // Expanded details are only fetched when the panel is open
  const campaign = isExpanded ? campaignService.getActiveCampaign() : null;
  const expandedDetails = isExpanded ? getExpandedDetails(entityType, entityId, campaign) : null;

  // Player characters: show read-only expanded data, no editable fields
  const isPlayerCharacter = entityType === 'player-character';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <config.Icon className="w-4 h-4 flex-shrink-0 text-stone-400" />
          <span className="font-semibold text-stone-100 text-sm truncate">{entityData.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badgeClass}`}>
            {config.label}
          </span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors p-0.5"
            aria-label="Close"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact details row (collapsed mode only) */}
      {!isExpanded && entityData.details.length > 0 && (
        <dl className="px-3 pb-2 space-y-1">
          {entityData.details.map((detail, i) => (
            <div key={i} className="flex gap-1.5 text-xs">
              <dt className="text-stone-500 flex-shrink-0 w-20 truncate">{detail.label}</dt>
              <dd className="text-stone-300 min-w-0 break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Expanded details panel */}
      {isExpanded && (
        <div className="px-3 pb-2 max-h-[60vh] overflow-y-auto space-y-2.5">
          {isPlayerCharacter && (
            <p className="text-xs text-stone-500 italic mb-1">
              Player Characters support read-only preview here. Use the full editor to make changes.
            </p>
          )}
          {expandedDetails && expandedDetails.map((detail, i) => {
            if (!isPlayerCharacter && detail.editable && detail.fieldKey) {
              return (
                <EditableField
                  key={`${detail.fieldKey}-${i}`}
                  label={detail.label}
                  value={detail.value}
                  fieldKey={detail.fieldKey}
                  entityType={entityType}
                  entityId={entityId}
                  multiline={detail.multiline}
                />
              );
            }
            // Read-only row
            return (
              <div key={i} className="space-y-0.5">
                <span className="text-stone-500 text-xs block">{detail.label}</span>
                <p className="text-stone-300 text-xs leading-relaxed break-words">
                  {detail.value || <span className="text-stone-600 italic">empty</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-stone-700 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`View ${entityData.name}`}
        >
          <Icons.FolderOpen className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`Edit ${entityData.name}`}
        >
          <Icons.Edit className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onToggleExpand}
          className={`flex items-center gap-1.5 text-xs transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ${isExpanded ? 'text-amber-400 hover:text-amber-300' : 'text-stone-400 hover:text-stone-200'}`}
          aria-label={isExpanded ? 'Collapse quick card' : 'Expand quick card'}
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? <Icons.Minimize className="w-3.5 h-3.5" />
            : <Icons.Maximize className="w-3.5 h-3.5" />
          }
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
        <button
          onClick={() => {
            if (pinned) {
              campaignService.unpinEntity(entityType, entityId);
            } else {
              campaignService.pinEntity(entityType, entityId);
            }
            setPinned(prev => !prev);
          }}
          className={`flex items-center gap-1.5 text-xs transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ${pinned ? 'text-amber-400 hover:text-amber-300' : 'text-stone-400 hover:text-stone-200'}`}
          aria-label={pinned ? `Unpin ${entityData.name}` : `Pin ${entityData.name}`}
          title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
        >
          {pinned ? <Icons.Star className="w-3.5 h-3.5 fill-current" /> : <Icons.Star className="w-3.5 h-3.5" />}
          {pinned ? 'Pinned' : 'Pin'}
        </button>
        <button
          onClick={onCopyName}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ml-auto"
          aria-label={`Copy name: ${entityData.name}`}
        >
          <Icons.Clipboard className="w-3.5 h-3.5" />
          Copy Name
        </button>
      </div>
    </div>
  );
};
