
import type { Campaign } from '../../types/index';
import { generateWithSchema } from './core';

const MODEL_NAME = 'standard';

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  affectedEntityIds: string[];
  affectedEntityTypes: string[];
  suggestedUpdates: Array<{
    entityId: string;
    entityType: string;
    field: string;
    currentValue: string;
    proposedValue: string;
  }>;
  severity: 'minor' | 'major' | 'critical';
  category: 'faction' | 'npc' | 'location' | 'plot' | 'world';
}

const worldEventSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: "A short, evocative title for the world event." },
    description: {
      type: 'string',
      description: "A 2-4 sentence narrative description of what happened in the world during this time.",
    },
    affectedEntityIds: {
      type: 'array',
      items: { type: 'string' },
      description: "Array of entity IDs (from the campaign data) that are directly involved or affected.",
    },
    affectedEntityTypes: {
      type: 'array',
      items: { type: 'string' },
      description: "Parallel array of entity types ('npc', 'faction', 'location', 'plot') matching affectedEntityIds.",
    },
    suggestedUpdates: {
      type: 'array',
      description: "Proposed changes to campaign entities as a result of this event.",
      items: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: "The ID of the entity to update." },
          entityType: {
            type: 'string',
            description: "The type of entity: 'npc', 'faction', 'location', or 'plot'.",
          },
          field: {
            type: 'string',
            description: "The field on the entity to update, e.g. 'description', 'motivations', 'goals', 'secrets'.",
          },
          currentValue: {
            type: 'string',
            description: "The current value of the field (from the campaign data).",
          },
          proposedValue: {
            type: 'string',
            description: "The proposed new value for the field, reflecting the world event.",
          },
        },
        required: ['entityId', 'entityType', 'field', 'currentValue', 'proposedValue'],
      },
    },
    severity: {
      type: 'string',
      enum: ['minor', 'major', 'critical'],
      description: "How significant this event is: 'minor' = background detail, 'major' = plot-relevant change, 'critical' = world-altering consequence.",
    },
    category: {
      type: 'string',
      enum: ['faction', 'npc', 'location', 'plot', 'world'],
      description: "The primary domain this event belongs to.",
    },
  },
  required: ['title', 'description', 'affectedEntityIds', 'affectedEntityTypes', 'suggestedUpdates', 'severity', 'category'],
};

const worldEventsSchema = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      description: "An array of 2-4 world events that occurred during the elapsed time.",
      items: worldEventSchema,
    },
  },
  required: ['events'],
};

function buildSimulationPrompt(campaign: Campaign, daysPassed: number): string {
  const timeLabel =
    daysPassed === 1
      ? '1 day'
      : daysPassed < 7
      ? `${daysPassed} days`
      : daysPassed < 30
      ? `${Math.round(daysPassed / 7)} week${Math.round(daysPassed / 7) > 1 ? 's' : ''}`
      : daysPassed < 60
      ? 'about a month'
      : `${Math.round(daysPassed / 30)} months`;

  let prompt = `The following campaign world has been running for some time. ${timeLabel} have passed since the last session. Based on the faction goals, NPC motivations, and unresolved plot threads below, generate 2-4 plausible world events that would realistically have occurred during this time.

For each event, propose specific, incremental updates to entity fields (descriptions, motivations, goals, secrets) that reflect the changed world state. Use the exact entity IDs from the campaign data in 'entityId' fields. Keep proposed changes grounded and consistent with the existing tone.

CAMPAIGN: ${campaign.title}
SETTING: ${campaign.setting}

`;

  if (campaign.factions.length > 0) {
    prompt += `ACTIVE FACTIONS:\n`;
    campaign.factions.forEach(f => {
      prompt += `- [ID: ${f.id}] ${f.name}: Goals: "${f.goals}". Influence: "${f.influence || 'unknown'}".\n`;
    });
    prompt += '\n';
  }

  if (campaign.npcs.length > 0) {
    prompt += `KEY NPCS:\n`;
    campaign.npcs.slice(0, 10).forEach(n => {
      prompt += `- [ID: ${n.id}] ${n.name}: Motivations: "${n.motivations}". Secrets: "${n.secrets}".\n`;
    });
    prompt += '\n';
  }

  if (campaign.plots && campaign.plots.length > 0) {
    const activePlots = campaign.plots.filter(p => p.status !== 'resolved');
    if (activePlots.length > 0) {
      prompt += `UNRESOLVED PLOTS:\n`;
      activePlots.slice(0, 5).forEach(p => {
        prompt += `- [ID: ${p.id}] ${p.title}: ${p.description || ''}\n`;
      });
      prompt += '\n';
    }
  }

  // Last 2 session recaps for continuity
  if (campaign.sessionLogs && campaign.sessionLogs.length > 0) {
    const recentSessions = [...campaign.sessionLogs]
      .filter(s => s.status === 'completed' && s.recap)
      .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
      .slice(0, 2);

    if (recentSessions.length > 0) {
      prompt += `RECENT SESSION CONTEXT:\n`;
      recentSessions.forEach(s => {
        prompt += `- Session "${s.title}": ${s.recap?.substring(0, 300)}${(s.recap?.length ?? 0) > 300 ? '...' : ''}\n`;
        if (s.looseEnds) prompt += `  Unresolved threads: ${s.looseEnds}\n`;
      });
      prompt += '\n';
    }
  }

  prompt += `Time elapsed: ${timeLabel}\n`;
  prompt += `Generate 2-4 world events that would plausibly occur in this time. Focus on faction politics, NPC personal arcs, and consequences of previous sessions. Avoid events that resolve major plots entirely — leave threads open for the players.`;

  return prompt;
}

// Per-entity-type allowlist of writable, prose-string fields. Anything not
// listed here (ids, relationship arrays, history, membership arrays, etc.)
// is a structural field and must never be written from a model-supplied
// `field` name — see wp-g1-worldsim-dialogs finding #14 / #5.
export const WORLD_SIM_WRITABLE_FIELDS: Record<string, string[]> = {
  npc: ['description', 'traits', 'backstory', 'motivations', 'secrets', 'stats', 'exampleQuote'],
  faction: ['description', 'goals', 'alignment', 'resources', 'influence'],
  location: ['description', 'secrets'],
  plot: ['description'],
  adventure: ['hook', 'theme'],
};

function entityExists(campaign: Campaign, entityType: string, entityId: string): boolean {
  switch (entityType) {
    case 'npc':
      return campaign.npcs.some(e => e.id === entityId);
    case 'faction':
      return campaign.factions.some(e => e.id === entityId);
    case 'location':
      return campaign.locations.some(e => e.id === entityId);
    case 'plot':
      return (campaign.plots || []).some(e => e.id === entityId);
    case 'adventure':
      return campaign.adventures.some(e => e.id === entityId);
    default:
      return false;
  }
}

/**
 * Validates a single model-supplied suggested update against the writable
 * field allowlist and the actual campaign data. Returns false for unknown
 * entity types, non-allowlisted (structural) fields, non-string proposed OR
 * current values, or entity ids that don't exist in the campaign.
 *
 * `currentValue` is checked alongside `proposedValue` (not just for the
 * write) because the review pane renders both sides of the before/after
 * diff — a model that returns an object/array for `currentValue` would
 * otherwise survive filtering and crash the render before the DM can ever
 * reach Apply (wp-g1-worldsim-dialogs finding #5).
 */
export function isValidSuggestedUpdate(
  campaign: Campaign,
  update: { entityId: string; entityType: string; field: string; currentValue?: unknown; proposedValue: unknown }
): boolean {
  const allowedFields = WORLD_SIM_WRITABLE_FIELDS[update.entityType];
  if (!allowedFields) return false;
  if (!allowedFields.includes(update.field)) return false;
  if (typeof update.proposedValue !== 'string') return false;
  if ('currentValue' in update && typeof update.currentValue !== 'string') return false;
  if (!entityExists(campaign, update.entityType, update.entityId)) return false;
  return true;
}

export async function generateWorldEvents(
  campaign: Campaign,
  daysPassed: number,
  campaignContext?: string
): Promise<WorldEvent[]> {
  const prompt = buildSimulationPrompt(campaign, daysPassed);

  const instructions = `You are a veteran tabletop RPG Game Master simulating the living world of a TTRPG campaign between sessions. Your job is to generate realistic, narratively interesting events that occur off-screen while the players are away. Events should feel organic — driven by faction motivations and NPC goals, not random. Always use the exact entity IDs from the provided campaign data.`;

  const result = await generateWithSchema(
    prompt,
    worldEventsSchema,
    instructions,
    {},
    MODEL_NAME,
    campaignContext
  );

  // Attach stable IDs to each event, and drop any suggested update that
  // names an unvalidated field, entity type, value type, or entity id —
  // the event itself is always kept even if all of its updates are dropped.
  const events: WorldEvent[] = (result.events || []).map((e: Omit<WorldEvent, 'id'>) => ({
    ...e,
    id: crypto.randomUUID(),
    affectedEntityIds: e.affectedEntityIds || [],
    affectedEntityTypes: e.affectedEntityTypes || [],
    suggestedUpdates: (e.suggestedUpdates || []).filter(u => isValidSuggestedUpdate(campaign, u)),
  }));

  return events;
}
