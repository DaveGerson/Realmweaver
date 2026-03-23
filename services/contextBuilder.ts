
/**
 * services/contextBuilder.ts
 *
 * Tiered, token-budget-aware campaign context builder.
 *
 * Replaces the flat, ad-hoc `buildCampaignContext` helper in entityUtils.ts with a
 * structured approach that:
 *   - Always includes the most important context (Tier 1)
 *   - Adds richer contextual data when budget permits (Tier 2)
 *   - Fills remaining budget with world-overview data (Tier 3)
 *
 * Token budget is estimated as `text.length / 4` (one token ≈ 4 chars, a reasonable
 * rough approximation for English prose).
 *
 * Variant behaviour:
 *   'generation' — Emphasises world consistency: all entity names, setting, relationships
 *   'coach'      — Emphasises current session: active scene, combat, recent events first
 *   'chat'       — Balanced: entity names + current context in equal measure
 */

import type { Campaign } from '../types/Campaign';
import type { NPC } from '../types/NPC';
import type { Scene } from '../types/Scene';
import type { SessionLog } from '../types/SessionLog';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ContextVariant = 'generation' | 'coach' | 'chat';

export interface ContextOptions {
  variant: ContextVariant;
  campaign: Campaign;
  /** ID of the scene currently being played (from campaign.activeSceneId) */
  activeSceneId?: string;
  /** ID of the live session (from campaign.activeSessionId) */
  activeSessionId?: string;
  /**
   * Soft upper bound on context length expressed in estimated tokens.
   * Defaults to 4000 tokens (≈16 000 characters).
   */
  maxTokenEstimate?: number;
  /**
   * Entity ID that is the subject of the current generation request.
   * When set, Tier 2 will include full details for this entity so the AI
   * can maintain continuity with an already-existing record.
   */
  focusEntityId?: string;
  /**
   * Entity type corresponding to focusEntityId (e.g. 'npc', 'location').
   * Used to locate the entity in the campaign data.
   */
  focusEntityType?: string;
}

/**
 * Build a context string for use in AI prompts, respecting a token budget.
 * The caller should pass this as the `campaignContext` argument to any
 * `geminiService.*` function.
 */
export function buildCampaignContext(options: ContextOptions): string {
  const {
    variant,
    campaign,
    activeSceneId,
    activeSessionId,
    maxTokenEstimate = 4000,
    focusEntityId,
    focusEntityType,
  } = options;

  const maxChars = maxTokenEstimate * 4; // 1 token ≈ 4 chars
  const sections: string[] = [];
  let usedChars = 0;

  // -------------------------------------------------------------------------
  // Budget-aware helpers
  // -------------------------------------------------------------------------

  /** True if there is still meaningful budget left (>= 100 chars = ~25 tokens). */
  const hasBudget = () => usedChars < maxChars - 100;

  /**
   * Add a section if it fits within the remaining budget.
   * Returns true if it was added, false if it was skipped.
   */
  const tryAdd = (text: string): boolean => {
    if (!text.trim()) return false;
    if (usedChars + text.length > maxChars) return false;
    sections.push(text);
    usedChars += text.length + 1; // +1 for the newline separator
    return true;
  };

  /** Truncate a string to at most `limit` characters, appending '…' if cut. */
  const trunc = (s: string, limit: number): string => {
    if (!s) return '';
    return s.length <= limit ? s : s.slice(0, limit - 1) + '…';
  };

  /** Return the first N sentences of a string (splitting on '. '). */
  const firstSentences = (s: string, n: number): string => {
    if (!s) return '';
    const parts = s.split(/\. /);
    return parts.slice(0, n).join('. ').trim();
  };

  // -------------------------------------------------------------------------
  // Lookup helpers
  // -------------------------------------------------------------------------

  const findActiveSession = (): SessionLog | undefined => {
    if (!activeSessionId) return undefined;
    return campaign.sessionLogs?.find(sl => sl.id === activeSessionId);
  };

  const findActiveScene = (): Scene | undefined => {
    if (!activeSceneId) return undefined;
    for (const adv of campaign.adventures) {
      const scene = adv.scenes.find(s => s.id === activeSceneId);
      if (scene) return scene;
    }
    return undefined;
  };

  /** Collect NPC objects present in a scene. */
  const npcsInScene = (scene: Scene): NPC[] =>
    scene.npcIds
      .map(id => campaign.npcs.find(n => n.id === id))
      .filter((n): n is NPC => n !== undefined);

  /** Find the entity referenced by focusEntityId/focusEntityType. */
  const findFocusEntity = (): string | null => {
    if (!focusEntityId || !focusEntityType) return null;

    switch (focusEntityType) {
      case 'npc': {
        const npc = campaign.npcs.find(n => n.id === focusEntityId);
        if (!npc) return null;
        const lines: string[] = [
          `Focus NPC — ${npc.name}`,
          npc.description ? `  Description: ${trunc(npc.description, 200)}` : '',
          npc.traits ? `  Traits: ${trunc(npc.traits, 150)}` : '',
          npc.motivations ? `  Motivations: ${trunc(npc.motivations, 150)}` : '',
          npc.backstory ? `  Backstory: ${trunc(npc.backstory, 200)}` : '',
          npc.factionId
            ? `  Faction: ${campaign.factions.find(f => f.id === npc.factionId)?.name ?? npc.factionId}`
            : '',
        ];
        return lines.filter(Boolean).join('\n');
      }
      case 'location': {
        const loc = campaign.locations.find(l => l.id === focusEntityId);
        if (!loc) return null;
        return [
          `Focus Location — ${loc.name}`,
          loc.description ? `  Description: ${trunc(loc.description, 300)}` : '',
          loc.secrets ? `  Secrets: ${trunc(loc.secrets, 150)}` : '',
        ].filter(Boolean).join('\n');
      }
      case 'faction': {
        const fac = campaign.factions.find(f => f.id === focusEntityId);
        if (!fac) return null;
        return [
          `Focus Faction — ${fac.name}`,
          fac.description ? `  Description: ${trunc(fac.description, 200)}` : '',
          fac.goals ? `  Goals: ${trunc(fac.goals, 150)}` : '',
        ].filter(Boolean).join('\n');
      }
      case 'item': {
        const item = campaign.items.find(i => i.id === focusEntityId);
        if (!item) return null;
        return [
          `Focus Item — ${item.name}`,
          item.description ? `  Description: ${trunc(item.description, 200)}` : '',
          item.properties ? `  Properties: ${trunc(item.properties, 150)}` : '',
        ].filter(Boolean).join('\n');
      }
      default:
        return null;
    }
  };

  // =========================================================================
  // TIER 1 — Always included (~1000 tokens)
  // Campaign identity, active session recap, active scene summary.
  // =========================================================================

  // --- Campaign identity ---
  const settingText = trunc(campaign.setting, 500);
  const identityLines: string[] = [
    `Campaign: ${campaign.title}`,
    `Setting: ${settingText}`,
  ];
  if (campaign.settingType === 'official' && campaign.officialSetting) {
    identityLines.push(`Official Setting: ${campaign.officialSetting}`);
  }
  tryAdd(identityLines.join('\n'));

  // --- Active session recap ---
  const activeSession = findActiveSession();
  if (activeSession && hasBudget()) {
    const recapLines: string[] = [`Active Session: ${activeSession.title}`];
    if (activeSession.prepNotes) {
      recapLines.push(`  Prep Notes: ${trunc(activeSession.prepNotes, 300)}`);
    }
    if (activeSession.runningNotes) {
      recapLines.push(`  Running Notes: ${trunc(activeSession.runningNotes, 200)}`);
    }
    tryAdd(recapLines.join('\n'));
  }

  // --- Active scene summary ---
  const activeScene = findActiveScene();
  if (activeScene && hasBudget()) {
    const sceneLines: string[] = [
      `Active Scene: ${activeScene.title} (${activeScene.type})`,
    ];
    if (activeScene.readAloudText) {
      sceneLines.push(`  Read-Aloud: ${firstSentences(activeScene.readAloudText, 1)}`);
    }
    if (activeScene.gmNotes) {
      sceneLines.push(`  GM Notes: ${firstSentences(activeScene.gmNotes, 1)}`);
    }
    tryAdd(sceneLines.join('\n'));
  }

  // =========================================================================
  // TIER 2 — Contextual (~2000 tokens)
  // Scene participants, active location, plot threads, focus entity.
  // For 'coach': also include active encounter if combat is running.
  // =========================================================================

  // --- Combat encounter (coach variant, high priority) ---
  if (variant === 'coach' && campaign.activeEncounter && hasBudget()) {
    const enc = campaign.activeEncounter;
    const alive = enc.combatants.filter(c => c.hp > 0);
    const combatLines: string[] = [
      `Active Combat — Round ${enc.round}`,
      `  Combatants: ${alive.map(c => `${c.name} (HP ${c.hp}/${c.maxHp})`).join(', ')}`,
    ];
    tryAdd(combatLines.join('\n'));
  }

  // --- NPCs present in active scene ---
  if (activeScene && hasBudget()) {
    const sceneNpcs = npcsInScene(activeScene);
    if (sceneNpcs.length > 0) {
      const npcLines = sceneNpcs.map(n => {
        const parts: string[] = [n.name];
        if (n.traits) parts.push(trunc(n.traits, 80));
        if (n.motivations) parts.push(trunc(n.motivations, 80));
        return `  - ${parts.join(' | ')}`;
      });
      tryAdd(['NPCs in Scene:', ...npcLines].join('\n'));
    }
  }

  // --- Active scene location ---
  if (activeScene?.locationId && hasBudget()) {
    const loc = campaign.locations.find(l => l.id === activeScene.locationId);
    if (loc) {
      tryAdd([
        `Scene Location: ${loc.name}`,
        `  ${trunc(firstSentences(loc.description, 2), 300)}`,
      ].join('\n'));
    }
  }

  // --- Active plot threads (max 5) ---
  if (campaign.plots && campaign.plots.length > 0 && hasBudget()) {
    const activePlots = campaign.plots
      .filter(p => p.status === 'active')
      .slice(0, 5);
    if (activePlots.length > 0) {
      const plotLines = activePlots.map(
        p => `  - ${p.title} [${p.status}]${p.description ? ': ' + trunc(p.description, 80) : ''}`
      );
      tryAdd(['Active Plot Threads:', ...plotLines].join('\n'));
    }
  }

  // --- Focus entity full details ---
  if (focusEntityId && focusEntityType && hasBudget()) {
    const focusText = findFocusEntity();
    if (focusText) tryAdd(focusText);
  }

  // =========================================================================
  // TIER 3 — On demand (fills remaining budget)
  // Entity overview lists; added one collection at a time until budget runs out.
  // For 'coach' variant, skip the broad world lists — they are less useful
  // when the DM needs fast in-session assistance.
  // =========================================================================

  if (variant !== 'coach') {
    // NPC overview
    if (campaign.npcs.length > 0 && hasBudget()) {
      const npcOverview = campaign.npcs.map(n => {
        const oneLiner = n.description ? trunc(firstSentences(n.description, 1), 80) : '';
        return `  - ${n.name}${oneLiner ? ': ' + oneLiner : ''}`;
      });
      tryAdd(['NPCs:', ...npcOverview].join('\n'));
    }

    // Location overview
    if (campaign.locations.length > 0 && hasBudget()) {
      const locOverview = campaign.locations.map(l => {
        const oneLiner = l.description ? trunc(firstSentences(l.description, 1), 80) : '';
        return `  - ${l.name}${oneLiner ? ': ' + oneLiner : ''}`;
      });
      tryAdd(['Locations:', ...locOverview].join('\n'));
    }

    // Faction overview
    if (campaign.factions.length > 0 && hasBudget()) {
      const facOverview = campaign.factions.map(f => {
        const goal = f.goals ? trunc(f.goals, 80) : '';
        return `  - ${f.name}${goal ? ': ' + goal : ''}`;
      });
      tryAdd(['Factions:', ...facOverview].join('\n'));
    }

    // Lore article titles
    if (campaign.articles.length > 0 && hasBudget()) {
      tryAdd(`Lore Articles: ${campaign.articles.map(a => a.title).join(', ')}`);
    }

    // Adventure titles
    if (campaign.adventures.length > 0 && hasBudget()) {
      tryAdd(`Adventures: ${campaign.adventures.map(a => a.title).join(', ')}`);
    }

    // Item names
    if (campaign.items.length > 0 && hasBudget()) {
      tryAdd(`Notable Items: ${campaign.items.map(i => i.name).join(', ')}`);
    }

    // Player characters
    if (campaign.playerCharacters && campaign.playerCharacters.length > 0 && hasBudget()) {
      const pcNames = campaign.playerCharacters
        .map(pc => pc.characterSocial?.characterName ?? '?')
        .join(', ');
      tryAdd(`Player Characters: ${pcNames}`);
    }
  } else {
    // Coach variant: still include NPC names for quick reference but skip full overviews
    if (campaign.npcs.length > 0 && hasBudget()) {
      tryAdd(`Campaign NPCs: ${campaign.npcs.map(n => n.name).join(', ')}`);
    }
    if (campaign.locations.length > 0 && hasBudget()) {
      tryAdd(`Campaign Locations: ${campaign.locations.map(l => l.name).join(', ')}`);
    }
  }

  // --- Focus entity history (if entity has version history, append at the end) ---
  if (focusEntityId && focusEntityType && hasBudget()) {
    let historyEntries: Array<{ summary: string }> = [];

    if (focusEntityType === 'npc') {
      const npc = campaign.npcs.find(n => n.id === focusEntityId);
      historyEntries = npc?.history ?? [];
    } else if (focusEntityType === 'location') {
      const loc = campaign.locations.find(l => l.id === focusEntityId);
      historyEntries = loc?.history ?? [];
    }

    if (historyEntries.length > 0) {
      const histLines = historyEntries
        .slice(-5) // Most recent 5 entries
        .map(e => `  - ${trunc(e.summary, 100)}`);
      tryAdd(['Focus Entity History (recent):', ...histLines].join('\n'));
    }
  }

  return sections.join('\n');
}
