
import type { RollableTable } from '../../types/index';
import { generateText, generateWithSchema } from './core';

// --- Schemas ---

const rollableTableSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: "A descriptive title for the table." },
    dieType: { type: 'string', description: "The type of die to roll, e.g., 'd6', 'd10', 'd20'." },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          range: { type: 'string', description: "The roll or range for this result, e.g., '1', '2-3'." },
          result: { type: 'string', description: "The outcome for this roll." },
        },
        required: ['range', 'result'],
      },
    },
  },
  required: ['title', 'dieType', 'entries'],
};

export const sessionAnalysisSchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string', description: "A concise, single-sentence summary of a specific event or beat found in the notes." },
          relatedEntityNames: {
              type: 'array',
              items: { type: 'string' },
              description: "Names of known entities (NPCs, Locations, Factions) mentioned or involved in this event."
          }
        },
        required: ['content', 'relatedEntityNames']
      }
    }
  },
  required: ['entries']
};

export const sessionRecapSchema = {
  type: 'object',
  properties: {
    recap: { type: 'string', description: "A narrative recap of the session suitable for reading at the start of the next session (3-5 paragraphs). Written in past tense, third person. Engaging and dramatic." },
    looseEnds: {
      type: 'array',
      items: { type: 'string' },
      description: "A list of unresolved plot threads, unanswered questions, or dangling hooks from this session that the DM should follow up on."
    },
    playerFacingRecap: { type: 'string', description: "A shorter, player-safe version of the recap with any GM secrets or hidden information stripped out. Suitable for sharing with players between sessions." },
  },
  required: ['recap', 'looseEnds', 'playerFacingRecap'],
};

export interface SessionRecapResult {
  recap: string;
  looseEnds: string[];
  playerFacingRecap: string;
}

// --- Freeform Text Config ---

interface FreeformTextConfig {
  id: string;
  persona: string;
  taskDescription: string;
  outputConstraints: string;
  userPromptTemplate: string;  // Use {{prompt}} as placeholder
  defaultTier: string;
}

const narrationConfig: FreeformTextConfig = {
  id: 'narration',
  persona: 'a master Dungeon Master, in the style of Brennan Lee Mulligan or Matt Mercer',
  taskDescription: 'Your task is to generate evocative, sensory-rich narrative descriptions for a tabletop RPG. Do not break character.',
  outputConstraints: 'Based on the context and the following request, provide a short, compelling narrative description (2-4 sentences) that the DM can read aloud to the players.',
  userPromptTemplate: 'Request: "{{prompt}}"',
  defaultTier: 'standard',
};

const improvisationConfig: FreeformTextConfig = {
  id: 'improvisation',
  persona: 'a master Dungeon Master, an expert at improvisation',
  taskDescription: 'Your task is to help a fellow DM handle an unexpected player action in a tabletop RPG. Provide 2-3 immediate, actionable consequences and a potential long-term consequence. Present your response in a clear, easy-to-scan format (e.g., using bullet points or bold headings). Do not break character.',
  outputConstraints: '',
  userPromptTemplate: 'The players did something unexpected. Here is the situation:\n"{{prompt}}"\n\nWhat happens next?',
  defaultTier: 'standard',
};

const enhancedTextConfig: FreeformTextConfig = {
  id: 'enhanced-text',
  persona: 'a creative assistant for a Dungeon Master',
  taskDescription: 'Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative.',
  outputConstraints: '',
  userPromptTemplate: 'Request: "{{prompt}}"',
  defaultTier: 'lite',
};

// --- Freeform Text Helper ---

function buildFreeformPrompt(config: FreeformTextConfig, prompt: string): string {
  return [
    `You are ${config.persona}.`,
    config.taskDescription,
    config.outputConstraints,
    '',
    config.userPromptTemplate.replace('{{prompt}}', prompt),
  ].filter(Boolean).join('\n\n');
}

// --- Generator Functions ---

export const generateNarration = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<string> => {
  const tier = useLiteModel ? 'lite' : narrationConfig.defaultTier;
  const fullPrompt = buildFreeformPrompt(narrationConfig, prompt);
  return generateText(fullPrompt, tier, campaignContext);
};

export const generateImprovisation = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<string> => {
  const tier = useLiteModel ? 'lite' : improvisationConfig.defaultTier;
  const fullPrompt = buildFreeformPrompt(improvisationConfig, prompt);
  return generateText(fullPrompt, tier, campaignContext);
};

export const generateRollableTable = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<RollableTable> => {
  const modelName = useLiteModel ? 'lite' : 'standard';
  const instructions = `You are a creative Dungeon Master. Based on the campaign context and the user's prompt, generate a custom rollable table for a tabletop RPG. The table should be thematic and provide interesting, varied outcomes. The roll ranges should be contiguous and cover the full range of a standard die (like d4, d6, d8, d10, d12, or d20).`;
  return generateWithSchema(prompt, rollableTableSchema, instructions, {}, modelName, campaignContext);
};

export const generateEnhancedText = (prompt: string, campaignContext?: string): Promise<string> => {
  const tier = enhancedTextConfig.defaultTier;
  const fullPrompt = buildFreeformPrompt(enhancedTextConfig, prompt);
  return generateText(fullPrompt, tier, campaignContext);
};

export const generateSessionRecap = async (
    sessionNotes: string,
    plotSummaries: string,
    campaignContext?: string
): Promise<SessionRecapResult> => {
    const modelName = 'standard';
    const instructions = `You are an expert Game Master's assistant. Your task is to generate a structured session recap from the DM's running notes.

You will produce three things:
1. **recap**: A narrative recap of the session (3-5 paragraphs). Written in past tense, third person. Engaging and dramatic, suitable for reading aloud at the start of the next session. Cover all major events, decisions, and encounters.
2. **looseEnds**: A list of unresolved plot threads, unanswered questions, cliffhangers, or dangling hooks that the DM should follow up on in future sessions. Be specific.
3. **playerFacingRecap**: A shorter, player-safe version of the recap. Strip out any GM secrets, hidden motivations, or information the players have not yet discovered. Keep it engaging but spoiler-free.

Active plot threads for context:
${plotSummaries}`;

    const prompt = `Here are the session notes to recap:\n\n${sessionNotes}`;
    return generateWithSchema(prompt, sessionRecapSchema, instructions, {}, modelName, campaignContext);
};

export const analyzeSessionNotes = async (notes: string, knownEntityNames: string[], campaignContext?: string): Promise<{entries: {content: string, relatedEntityNames: string[]}[]}> => {
    const modelName = 'standard';
    const instructions = `You are an expert Game Master's assistant. Your task is to process raw session notes into structured log entries.

    1. Break the notes down into distinct events.
    2. Summarize each event clearly and concisely.
    3. Identify if any of the following known entities are mentioned in the event:
    ${JSON.stringify(knownEntityNames)}

    Only list entities from the provided list in the 'relatedEntityNames' field.`;

    return generateWithSchema(notes, sessionAnalysisSchema, instructions, {}, modelName, campaignContext);
}
