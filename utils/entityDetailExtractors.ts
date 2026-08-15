
import { campaignService } from '@/services/campaignService';
import type { NPC, Location, Faction, Item, Adventure, Article, Plot, SessionLog, PlayerCharacter, Scene } from '@/types/index';

// ─── Re-exported type ────────────────────────────────────────────────────────
// Defined here as the single source of truth; EntityQuickCard re-exports it.
export type QuickCardEntityType =
  | 'npc'
  | 'location'
  | 'faction'
  | 'item'
  | 'adventure'
  | 'article'
  | 'plot'
  | 'session-log'
  | 'player-character'
  | 'scene';

// ─── Shared detail row types ─────────────────────────────────────────────────

export interface EntityDetail {
  label: string;
  value: string;
}

// Expanded detail — every field has an editable flag and an optional fieldKey for saving
export interface ExpandedDetail {
  label: string;
  value: string;
  fieldKey?: string;    // The entity field name for saving (e.g. 'description')
  editable: boolean;
  multiline?: boolean;  // true => <textarea>, false/undefined => <input>
}

// ─── Shared helper ───────────────────────────────────────────────────────────

export function truncate(text: string, maxLen = 80): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text;
}

// ── Compact detail extractors (collapsed mode, max 4 rows) ───────────────────

export function getNpcDetails(npc: NPC, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
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

export function getLocationDetails(loc: Location, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
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

export function getFactionDetails(faction: Faction, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
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

export function getItemDetails(item: Item): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Rarity', value: item.rarity });
  if (item.description) {
    const firstLine = item.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Description', value: truncate(firstLine, 80) });
  }
  if (item.properties) details.push({ label: 'Properties', value: truncate(item.properties, 80) });
  return details.slice(0, 4);
}

export function getAdventureDetails(adventure: Adventure): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Scenes', value: String(adventure.scenes?.length ?? 0) });
  if (adventure.level) details.push({ label: 'Level', value: String(adventure.level) });
  if (adventure.theme) details.push({ label: 'Theme', value: truncate(adventure.theme, 60) });
  if (adventure.hook) details.push({ label: 'Hook', value: truncate(adventure.hook, 80) });
  return details.slice(0, 4);
}

export function getArticleDetails(article: Article, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
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

export function getPlotDetails(plot: Plot): EntityDetail[] {
  const details: EntityDetail[] = [];
  details.push({ label: 'Status', value: plot.status });
  if (plot.description) {
    const firstLine = plot.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Summary', value: truncate(firstLine, 80) });
  }
  if (plot.relatedEntityIds.length > 0) details.push({ label: 'Entities', value: String(plot.relatedEntityIds.length) });
  return details.slice(0, 4);
}

export function getSessionLogDetails(log: SessionLog): EntityDetail[] {
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

export function getPlayerCharacterDetails(pc: PlayerCharacter): EntityDetail[] {
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

export function getSceneDetails(scene: Scene, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
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

// ── Expanded detail extractors ────────────────────────────────────────────────

export function getNpcExpandedDetails(npc: NPC, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
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

export function getLocationExpandedDetails(loc: Location, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: loc.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Description', value: loc.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Secrets', value: loc.secrets ?? '', fieldKey: 'secrets', editable: true, multiline: true });
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

export function getFactionExpandedDetails(faction: Faction, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
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

export function getItemExpandedDetails(item: Item): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Name', value: item.name, fieldKey: 'name', editable: true, multiline: false });
  details.push({ label: 'Rarity', value: item.rarity, editable: false });
  details.push({ label: 'Description', value: item.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  details.push({ label: 'Properties', value: item.properties ?? '', fieldKey: 'properties', editable: true, multiline: true });
  return details;
}

export function getAdventureExpandedDetails(adventure: Adventure): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: adventure.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Hook', value: adventure.hook ?? '', fieldKey: 'hook', editable: true, multiline: true });
  details.push({ label: 'Theme', value: adventure.theme ?? '', fieldKey: 'theme', editable: true, multiline: false });
  details.push({ label: 'Level', value: String(adventure.level), editable: false });
  details.push({ label: 'Scenes', value: String(adventure.scenes?.length ?? 0), editable: false });
  return details;
}

export function getArticleExpandedDetails(article: Article, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: article.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Category', value: article.category, editable: false });
  details.push({ label: 'Content', value: article.content ?? '', fieldKey: 'content', editable: true, multiline: true });
  if (article.parentArticleId && campaign) {
    const parent = campaign.articles.find(a => a.id === article.parentArticleId);
    if (parent) details.push({ label: 'Under', value: parent.title, editable: false });
  }
  const relatedCount = article.relatedEntityIds?.length ?? 0;
  if (relatedCount > 0) details.push({ label: 'References', value: String(relatedCount), editable: false });
  return details;
}

export function getPlotExpandedDetails(plot: Plot): ExpandedDetail[] {
  const details: ExpandedDetail[] = [];
  details.push({ label: 'Title', value: plot.title, fieldKey: 'title', editable: true, multiline: false });
  details.push({ label: 'Status', value: plot.status, editable: false });
  details.push({ label: 'Description', value: plot.description ?? '', fieldKey: 'description', editable: true, multiline: true });
  if (plot.relatedEntityIds.length > 0) details.push({ label: 'Entities', value: String(plot.relatedEntityIds.length), editable: false });
  return details;
}

export function getSessionLogExpandedDetails(log: SessionLog): ExpandedDetail[] {
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

export function getPlayerCharacterExpandedDetails(pc: PlayerCharacter): ExpandedDetail[] {
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
  // proficiencyBonus is not on CharacterStatistics; derive from class level if available
  if (characterStatistics.classes?.level) {
    const bonus = Math.ceil(characterStatistics.classes.level / 4) + 1;
    details.push({ label: 'Proficiency', value: `+${bonus}`, editable: false });
  }
  return details;
}

export function getSceneExpandedDetails(scene: Scene, campaign: ReturnType<typeof campaignService.getActiveCampaign>): ExpandedDetail[] {
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

// ── Master expanded-detail dispatcher ────────────────────────────────────────

export function getExpandedDetails(
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

// ── Compact entity lookup (used in collapsed mode) ────────────────────────────

export function lookupEntity(
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
