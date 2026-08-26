
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
 *   'generation'  — Emphasises world consistency: all entity names, setting, relationships
 *   'coach'       — Emphasises current session: active scene, combat, recent events first
 *   'chat'        — Balanced: entity names + current context in equal measure
 *   'player-safe' — Player-facing output only: no GM-authored private prose (NPC/Location
 *                   `secrets`, NPC `traits`/`motivations`/`backstory`, scene `gmNotes`,
 *                   session prep/running notes, plot plans) and no unrevealed `Secret`;
 *                   revealed secrets appear as established party knowledge. See
 *                   tests/services/contextBuilder.partyKnowledge.test.ts.
 *
 * E3 party knowledge (zero schema change, derived from the existing `Secret` shape):
 *   'generation' / 'coach' additionally gain a Tier-2 "GM-ONLY — UNREVEALED SECRETS" section
 *   listing every unrevealed secret linked to the current scene-relevance set (active scene +
 *   its NPCs/location, the focus entity, the editor selection). 'generation' / 'coach' /
 *   'player-safe' all gain an "Established Party Knowledge (revealed secrets)" section listing
 *   every revealed secret campaign-wide, scene-relevant ones first. 'chat' gains neither.
 */

import type { Campaign } from '../types/Campaign';
import type { NPC } from '../types/NPC';
import type { Scene } from '../types/Scene';
import type { SessionLog } from '../types/SessionLog';
import type { Secret } from '../types/Secret';

// ---------------------------------------------------------------------------
// E3 — party-knowledge section headers (exact strings; see
// tests/services/contextBuilder.partyKnowledge.test.ts and
// tests/services/partyKnowledgeFixtures.ts for the executable contract).
// ---------------------------------------------------------------------------

const GM_ONLY_SECRETS_HEADER = 'GM-ONLY — UNREVEALED SECRETS (never reveal to players):';
const PARTY_KNOWLEDGE_HEADER = 'Established Party Knowledge (revealed secrets):';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ContextVariant = 'generation' | 'coach' | 'chat' | 'player-safe';

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
  /**
   * Currently selected entities in the editor UI. When provided, a
   * "CURRENT USER FOCUS" section is appended to the context so the AI
   * knows what the DM is actively looking at. Used by the DM Coach.
   */
  focusSelection?: {
    selectedNpcId?: string | null;
    selectedLocationId?: string | null;
    selectedSceneId?: string | null;
    selectedAdventureId?: string | null;
  };
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
    focusSelection,
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

  /**
   * Add a list section (header + one entry per line) by filling entries one
   * at a time until the remaining budget is exhausted, rather than dropping
   * the whole section when the full list doesn't fit (finding #15). Once the
   * budget runs out, appends an "…and N more" marker (if it fits) so callers
   * know the list was truncated instead of silently missing entries.
   *
   * `cap`, when provided, additionally bounds THIS call to at most `cap`
   * characters beyond the current `usedChars` — a fair per-section share of
   * the remaining budget (see `nextTier3Quota` below), so a single roster
   * filling greedily to the byte can no longer starve every Tier-3 section
   * that follows it. Falls back to the full remaining budget when omitted.
   *
   * Note: this checks against the effective limit directly on every entry
   * rather than `hasBudget()`, since `hasBudget()`'s ~100-char slack would
   * either stop short of the true limit or (worse) let one entry overshoot it.
   *
   * E3 fix: when the whole list does NOT fit whole, entries are filled only
   * up to `limit` minus the worst-case marker length, reserved up front —
   * otherwise a greedy fill can land exactly on `limit` with zero bytes left
   * for the very marker that announces the cut (observed with 40
   * fixed-length secret entries against a small budget: 8 entries filled to
   * the last byte, no "…and 32 more"). When the full list DOES fit, no
   * reservation applies and every entry is included with no marker.
   */
  const tryAddList = (header: string, entries: string[], cap?: number): boolean => {
    if (entries.length === 0) return false;

    const limit = cap !== undefined ? Math.min(maxChars, usedChars + cap) : maxChars;

    // Fast path: the whole list fits with no truncation — no marker needed.
    const wholeText = [header, ...entries].join('\n');
    if (usedChars + wholeText.length <= limit) {
      sections.push(wholeText);
      usedChars += wholeText.length + 1;
      return true;
    }

    // Truncated path: reserve room for the largest possible "…and N more"
    // marker before filling entries, so a genuine cut is always announced.
    const maxMarkerLen = `  …and ${entries.length} more`.length;
    const reservedLimit = limit - maxMarkerLen - 1; // -1 for the marker's joining newline

    const lines: string[] = [header];
    let runningLen = header.length;
    let addedCount = 0;

    for (const entry of entries) {
      const newLen = runningLen + 1 + entry.length; // +1 for the joining newline
      if (usedChars + newLen > reservedLimit) break;
      lines.push(entry);
      runningLen = newLen;
      addedCount++;
    }

    if (addedCount === 0) {
      // The section's quota was too small for even one full entry. Emit a
      // header + "…and N more" marker (if it fits) rather than dropping the
      // whole section silently — a truncated-to-zero roster still tells the
      // model the entity type exists, which a fully-absent section does not.
      const marker = `  …and ${entries.length} more`;
      const zeroLen = header.length + 1 + marker.length;
      if (usedChars + zeroLen <= limit) {
        const text = `${header}\n${marker}`;
        sections.push(text);
        usedChars += text.length + 1;
        return true;
      }
      return false;
    }

    const remaining = entries.length - addedCount;
    if (remaining > 0) {
      const marker = `  …and ${remaining} more`;
      const newLen = runningLen + 1 + marker.length;
      if (usedChars + newLen <= limit) {
        lines.push(marker);
        runningLen = newLen;
      }
    }

    const text = lines.join('\n');
    sections.push(text);
    usedChars += text.length + 1; // +1 for the newline separator between sections
    return true;
  };

  /**
   * Add a single-line "Header: value, value, …" section, truncating to as
   * many comma-joined values as fit within budget instead of dropping the
   * whole joined string when it doesn't fit whole (finding #15's sibling
   * defect on Lore Articles / Adventures / Notable Items / Player Characters
   * / the coach variant's NPC & Location name lists — these were still
   * whole-string `tryAdd` calls). Appends "…and N more" when truncated, and
   * — like `tryAddList` — still emits a marker rather than nothing at all
   * when the quota is too small for even one value.
   *
   * `cap` behaves identically to `tryAddList`'s per-section budget share.
   */
  const tryAddJoined = (header: string, values: string[], cap?: number): boolean => {
    if (values.length === 0) return false;

    const limit = cap !== undefined ? Math.min(maxChars, usedChars + cap) : maxChars;

    let text = '';
    let addedCount = 0;
    for (const v of values) {
      const candidate = addedCount === 0 ? `${header} ${v}` : `${text}, ${v}`;
      if (usedChars + candidate.length > limit) break;
      text = candidate;
      addedCount++;
    }

    if (addedCount === 0) {
      const marker = `${header} …and ${values.length} more`;
      if (usedChars + marker.length <= limit) {
        sections.push(marker);
        usedChars += marker.length + 1;
        return true;
      }
      return false;
    }

    const remaining = values.length - addedCount;
    if (remaining > 0) {
      const withMarker = `${text} …and ${remaining} more`;
      if (usedChars + withMarker.length <= limit) {
        text = withMarker;
      }
    }

    sections.push(text);
    usedChars += text.length + 1;
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

  /** True for the player-facing variant that must never carry GM-authored prose. */
  const isPlayerSafe = variant === 'player-safe';

  /**
   * Render one secret as `  - [<category>] <title>: <content>` (content
   * truncated to 160 chars; the `: <content>` half dropped when content is
   * empty). Used by both the GM-ONLY and established-party-knowledge
   * sections. `Secret.notes` is DM bookkeeping and is deliberately never
   * read here.
   */
  const secretEntry = (s: Secret): string => {
    const content = trunc(s.content, 160);
    return content ? `  - [${s.category}] ${s.title}: ${content}` : `  - [${s.category}] ${s.title}`;
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
          // player-safe: traits/motivations/backstory are GM-authored prose
          // (hidden agendas, secret backstory beats) — never player-facing.
          !isPlayerSafe && npc.traits ? `  Traits: ${trunc(npc.traits, 150)}` : '',
          !isPlayerSafe && npc.motivations ? `  Motivations: ${trunc(npc.motivations, 150)}` : '',
          !isPlayerSafe && npc.backstory ? `  Backstory: ${trunc(npc.backstory, 200)}` : '',
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
          // player-safe: Location.secrets is GM-authored private prose, never player-facing.
          !isPlayerSafe && loc.secrets ? `  Secrets: ${trunc(loc.secrets, 150)}` : '',
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

  // --- Style profile (Tier 1 — always included when present) ---
  if (campaign.styleProfile && campaign.styleProfile.trim()) {
    tryAdd(`WRITING STYLE: Generate content matching this DM's voice: ${campaign.styleProfile.trim()}`);
  }

  // --- Active session recap ---
  const activeSession = findActiveSession();
  if (activeSession && hasBudget()) {
    const recapLines: string[] = [`Active Session: ${activeSession.title}`];
    // player-safe: prep/running notes are GM bookkeeping, never player-facing.
    if (!isPlayerSafe && activeSession.prepNotes) {
      recapLines.push(`  Prep Notes: ${trunc(activeSession.prepNotes, 300)}`);
    }
    if (!isPlayerSafe && activeSession.runningNotes) {
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
    // player-safe: GM Notes is GM-only prose (scene goals, hidden setup) — never player-facing.
    if (!isPlayerSafe && activeScene.gmNotes) {
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
      const sceneNpcIds = new Set(sceneNpcs.map(n => n.id));
      const npcLines = sceneNpcs.map(n => {
        const parts: string[] = [n.name];
        // player-safe: traits/motivations are GM-authored prose (hidden
        // agendas among them) — never player-facing. Name only.
        if (!isPlayerSafe && n.traits) parts.push(trunc(n.traits, 80));
        if (!isPlayerSafe && n.motivations) parts.push(trunc(n.motivations, 80));
        const faction = n.factionId ? campaign.factions.find(f => f.id === n.factionId) : undefined;
        if (faction) parts.push(`[${faction.name}]`);
        return `  - ${parts.join(' | ')}`;
      });
      tryAdd(['NPCs in Scene:', ...npcLines].join('\n'));

      // Inter-NPC relationship lines (coach variant: helps AI generate aware dialogue/narration)
      if (variant === 'coach' && hasBudget()) {
        const relLines: string[] = [];
        for (const npc of sceneNpcs) {
          for (const rel of npc.relationships ?? []) {
            if (!sceneNpcIds.has(rel.targetId)) continue;
            const targetName = campaign.npcs.find(n => n.id === rel.targetId)?.name ?? rel.targetId;
            relLines.push(`  - ${npc.name} ${rel.relationType} ${targetName}`);
          }
        }
        if (relLines.length > 0) {
          tryAdd(['NPC Relationships in Scene:', ...relLines].join('\n'));
        }
      }
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
  // player-safe: plot titles/descriptions are GM plan text, omit the whole section.
  if (!isPlayerSafe && campaign.plots && campaign.plots.length > 0 && hasBudget()) {
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

  // --- E3: party-knowledge secrets (Tier 2 — before the Tier-3 rosters) ---
  // Zero schema change: derived entirely from the existing `Secret` shape
  // (`isRevealed`, `linkedEntityIds`, `category`, `title`, `content`) and
  // `campaign.secrets ?? []`. See
  // tests/services/contextBuilder.partyKnowledge.test.ts for the contract.
  const allSecrets = campaign.secrets ?? [];

  if (allSecrets.length > 0) {
    // The "scene relevance set": the active scene's own id, its NPCs and its
    // location, plus the current focus entity and any non-null id the editor
    // selection (DM Coach) is pointing at. Empty when none of those are set.
    const relevantIds = new Set<string>();
    if (activeScene) {
      relevantIds.add(activeScene.id);
      activeScene.npcIds.forEach(id => relevantIds.add(id));
      if (activeScene.locationId) relevantIds.add(activeScene.locationId);
    }
    if (focusEntityId) relevantIds.add(focusEntityId);
    if (focusSelection) {
      const { selectedNpcId, selectedLocationId, selectedSceneId, selectedAdventureId } = focusSelection;
      [selectedNpcId, selectedLocationId, selectedSceneId, selectedAdventureId].forEach(id => {
        if (id) relevantIds.add(id);
      });
    }

    const isSceneRelevant = (s: Secret) => (s.linkedEntityIds ?? []).some(id => relevantIds.has(id));

    // GM-ONLY — unrevealed secrets linked to something in scope right now.
    // Never built for 'chat' or 'player-safe' — this is GM truth the players
    // must not see.
    if ((variant === 'generation' || variant === 'coach') && hasBudget()) {
      // Truthiness, not `=== false` — an old/hand-edited save can have
      // `isRevealed: undefined` (no field-level migration backfills it; see
      // `deriveLoadedGuns`/`SecretsTracker`, which both treat that the same
      // way via `!s.isRevealed`). A strict-false check would silently drop
      // such a secret from BOTH GM sections instead of treating it as
      // unrevealed GM truth.
      const unrevealedInScope = allSecrets.filter(s => !s.isRevealed && isSceneRelevant(s));
      if (unrevealedInScope.length > 0) {
        tryAddList(GM_ONLY_SECRETS_HEADER, unrevealedInScope.map(secretEntry));
      }
    }

    // Established party knowledge — every revealed secret campaign-wide,
    // scene-relevant ones first. Present in every variant except 'chat'.
    if (variant !== 'chat' && hasBudget()) {
      const revealed = allSecrets.filter(s => !!s.isRevealed);
      if (revealed.length > 0) {
        const inScene = revealed.filter(isSceneRelevant);
        const elsewhere = revealed.filter(s => !isSceneRelevant(s));
        tryAddList(PARTY_KNOWLEDGE_HEADER, [...inScene, ...elsewhere].map(secretEntry));
      }
    }
  }

  // =========================================================================
  // TIER 3 — On demand (fills remaining budget)
  // Entity overview lists; added one collection at a time until budget runs out.
  // For 'coach' variant, skip the broad world lists — they are less useful
  // when the DM needs fast in-session assistance.
  // =========================================================================

  // Fair per-section budget share for Tier 3 (finding #15 follow-up): a
  // single roster (e.g. 200 NPCs) filling `tryAddList`/`tryAddJoined`
  // greedily to within a byte of `maxChars` used to starve every Tier-3
  // section that came after it — NPCs would be full while Locations,
  // Factions, Lore Articles, Adventures and Items vanished with no marker.
  // `nextTier3Quota` hands out `remaining budget / sections not yet
  // attempted` before each section, counting only sections that actually
  // have data to show (so campaigns with, say, no Factions don't rob a
  // slice from Items). A section that uses less than its quota leaves the
  // surplus for the next one; a section that fills its quota still leaves
  // every later roster a fair, non-zero shot at appearing (truncated, with
  // an "…and N more" marker) rather than being silently dropped whole.
  const hasNpcs = campaign.npcs.length > 0;
  const hasLocations = campaign.locations.length > 0;
  const hasFactions = campaign.factions.length > 0;
  const hasArticles = campaign.articles.length > 0;
  const hasAdventures = campaign.adventures.length > 0;
  const hasItems = campaign.items.length > 0;
  const hasPlayerCharacters = !!campaign.playerCharacters && campaign.playerCharacters.length > 0;

  let tier3SectionsLeft = variant !== 'coach'
    ? [hasNpcs, hasLocations, hasFactions, hasArticles, hasAdventures, hasItems, hasPlayerCharacters].filter(Boolean).length
    : [hasNpcs, hasLocations].filter(Boolean).length;

  const nextTier3Quota = (): number => {
    const remainingBudget = Math.max(0, maxChars - usedChars);
    const quota = tier3SectionsLeft > 0 ? Math.floor(remainingBudget / tier3SectionsLeft) : remainingBudget;
    tier3SectionsLeft = Math.max(0, tier3SectionsLeft - 1);
    return quota;
  };

  if (variant !== 'coach') {
    // NPC overview
    if (hasNpcs && hasBudget()) {
      const npcOverview = campaign.npcs.map(n => {
        const oneLiner = n.description ? trunc(firstSentences(n.description, 1), 80) : '';
        return `  - ${n.name}${oneLiner ? ': ' + oneLiner : ''}`;
      });
      tryAddList('NPCs:', npcOverview, nextTier3Quota());
    }

    // Location overview
    if (hasLocations && hasBudget()) {
      const locOverview = campaign.locations.map(l => {
        const oneLiner = l.description ? trunc(firstSentences(l.description, 1), 80) : '';
        return `  - ${l.name}${oneLiner ? ': ' + oneLiner : ''}`;
      });
      tryAddList('Locations:', locOverview, nextTier3Quota());
    }

    // Faction overview
    if (hasFactions && hasBudget()) {
      const facOverview = campaign.factions.map(f => {
        const goal = f.goals ? trunc(f.goals, 80) : '';
        return `  - ${f.name}${goal ? ': ' + goal : ''}`;
      });
      tryAddList('Factions:', facOverview, nextTier3Quota());
    }

    // Lore article titles
    if (hasArticles && hasBudget()) {
      tryAddJoined('Lore Articles:', campaign.articles.map(a => a.title), nextTier3Quota());
    }

    // Adventure titles
    if (hasAdventures && hasBudget()) {
      tryAddJoined('Adventures:', campaign.adventures.map(a => a.title), nextTier3Quota());
    }

    // Item names
    if (hasItems && hasBudget()) {
      tryAddJoined('Notable Items:', campaign.items.map(i => i.name), nextTier3Quota());
    }

    // Player characters
    if (hasPlayerCharacters && hasBudget()) {
      const pcNames = campaign.playerCharacters!.map(pc => pc.characterSocial?.characterName ?? '?');
      tryAddJoined('Player Characters:', pcNames, nextTier3Quota());
    }
  } else {
    // Coach variant: still include NPC names for quick reference but skip full overviews
    if (hasNpcs && hasBudget()) {
      tryAddJoined('Campaign NPCs:', campaign.npcs.map(n => n.name), nextTier3Quota());
    }
    if (hasLocations && hasBudget()) {
      tryAddJoined('Campaign Locations:', campaign.locations.map(l => l.name), nextTier3Quota());
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

  // --- Current user focus (editor selection) ---
  if (focusSelection && hasBudget()) {
    const { selectedNpcId: focusNpcId, selectedLocationId: focusLocId, selectedSceneId: focusSceneId, selectedAdventureId: focusAdvId } = focusSelection;

    let selectionContext = '';

    if (focusSceneId && focusAdvId) {
      const focusAdv = campaign.adventures.find(a => a.id === focusAdvId);
      const focusScene = focusAdv?.scenes.find(s => s.id === focusSceneId);
      if (focusScene && focusAdv && focusScene.id !== activeSceneId) {
        selectionContext += `USER IS VIEWING SCENE: "${focusScene.title}" (Adventure: ${focusAdv.title})\n`;
        // player-safe: scene gmNotes is GM-only, in this block too.
        if (!isPlayerSafe && focusScene.gmNotes) selectionContext += `Notes: ${trunc(focusScene.gmNotes, 200)}\n`;
      }
    } else if (focusLocId) {
      const focusLoc = campaign.locations.find(l => l.id === focusLocId);
      if (focusLoc) {
        selectionContext += `USER IS VIEWING LOCATION: "${focusLoc.name}"\n`;
        if (focusLoc.description) selectionContext += `Desc: ${trunc(firstSentences(focusLoc.description, 1), 200)}\n`;
      }
    } else if (focusNpcId) {
      const focusNpc = campaign.npcs.find(n => n.id === focusNpcId);
      if (focusNpc) {
        selectionContext += `USER IS VIEWING NPC: "${focusNpc.name}"\n`;
        // player-safe: traits is GM-authored prose, in this block too (same
        // leak class as the focus-NPC and NPCs-in-scene blocks above).
        if (!isPlayerSafe && focusNpc.traits) selectionContext += `Traits: ${trunc(focusNpc.traits, 150)}\n`;
      }
    }

    if (selectionContext) {
      tryAdd(`--- CURRENT USER FOCUS ---\n${selectionContext}`);
    }
  }

  return sections.join('\n');
}
