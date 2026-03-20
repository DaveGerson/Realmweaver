
import { Type } from "@google/genai";
import type { RollableTable } from '../../types/index';
import { generateText, generateWithSchema } from './core';

// --- Schemas ---

const rollableTableSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A descriptive title for the table." },
    dieType: { type: Type.STRING, description: "The type of die to roll, e.g., 'd6', 'd10', 'd20'." },
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          range: { type: Type.STRING, description: "The roll or range for this result, e.g., '1', '2-3'." },
          result: { type: Type.STRING, description: "The outcome for this roll." },
        },
        required: ['range', 'result'],
      },
    },
  },
  required: ['title', 'dieType', 'entries'],
};

export const sessionAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "A concise, single-sentence summary of a specific event or beat found in the notes." },
          relatedEntityNames: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
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
  type: Type.OBJECT,
  properties: {
    recap: { type: Type.STRING, description: "A narrative recap of the session suitable for reading at the start of the next session (3-5 paragraphs). Written in past tense, third person. Engaging and dramatic." },
    looseEnds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of unresolved plot threads, unanswered questions, or dangling hooks from this session that the DM should follow up on."
    },
    playerFacingRecap: { type: Type.STRING, description: "A shorter, player-safe version of the recap with any GM secrets or hidden information stripped out. Suitable for sharing with players between sessions." },
  },
  required: ['recap', 'looseEnds', 'playerFacingRecap'],
};

export interface SessionRecapResult {
  recap: string;
  looseEnds: string[];
  playerFacingRecap: string;
}

// --- Generator Functions ---

export const generateNarration = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<string> => {
    const modelName = useLiteModel ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash';
    const fullPrompt = `You are a master Dungeon Master, in the style of Brennan Lee Mulligan or Matt Mercer. Your task is to generate evocative, sensory-rich narrative descriptions for a tabletop RPG. Do not break character.

Based on the context and the following request, provide a short, compelling narrative description (2-4 sentences) that the DM can read aloud to the players.

Request: "${prompt}"`;
    return generateText(fullPrompt, modelName, campaignContext);
}

export const generateImprovisation = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<string> => {
    const modelName = useLiteModel ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash';
    const fullPrompt = `You are a master Dungeon Master, an expert at improvisation. Your task is to help a fellow DM handle an unexpected player action in a tabletop RPG. Provide 2-3 immediate, actionable consequences and a potential long-term consequence. Present your response in a clear, easy-to-scan format (e.g., using bullet points or bold headings). Do not break character.

The players did something unexpected. Here is the situation:
"${prompt}"

What happens next?`;
    return generateText(fullPrompt, modelName, campaignContext);
}

export const generateRollableTable = (prompt: string, campaignContext?: string, useLiteModel: boolean = false): Promise<RollableTable> => {
  const modelName = useLiteModel ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash';
  const instructions = `You are a creative Dungeon Master. Based on the campaign context and the user's prompt, generate a custom rollable table for a tabletop RPG. The table should be thematic and provide interesting, varied outcomes. The roll ranges should be contiguous and cover the full range of a standard die (like d4, d6, d8, d10, d12, or d20).`;
  return generateWithSchema(prompt, rollableTableSchema, instructions, {}, modelName, campaignContext);
};

export const generateEnhancedText = (prompt: string, campaignContext?: string): Promise<string> => {
    const modelName = 'gemini-flash-lite-latest'; // Always use lite model for quick enhancements
    const fullPrompt = `You are a creative assistant for a Dungeon Master. Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative.

Request: "${prompt}"`;
    return generateText(fullPrompt, modelName, campaignContext);
}

export const generateSessionRecap = async (
    sessionNotes: string,
    plotSummaries: string,
    campaignContext?: string
): Promise<SessionRecapResult> => {
    const modelName = 'gemini-2.5-flash';
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
    const modelName = 'gemini-2.5-flash';
    const instructions = `You are an expert Game Master's assistant. Your task is to process raw session notes into structured log entries.
    
    1. Break the notes down into distinct events.
    2. Summarize each event clearly and concisely.
    3. Identify if any of the following known entities are mentioned in the event:
    ${JSON.stringify(knownEntityNames)}
    
    Only list entities from the provided list in the 'relatedEntityNames' field.`;
    
    return generateWithSchema(notes, sessionAnalysisSchema, instructions, {}, modelName, campaignContext);
}
