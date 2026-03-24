
import { generateText } from './core';

const MODEL_NAME = 'gemini-2.5-flash';

const STYLE_ANALYSIS_INSTRUCTIONS = `You are a literary analyst specializing in tabletop RPG content.
You will receive writing samples from a Game Master's campaign notes — NPC descriptions, location write-ups, and adventure hooks.
Analyze the DM's distinct voice and produce a concise style guide (200 words maximum) that could be handed to another writer to match this style exactly.

Focus on:
- Voice and tone (e.g., gritty, whimsical, literary, terse, baroque)
- Vocabulary level (e.g., simple, elevated, archaic, modern)
- Sentence structure (e.g., short punchy sentences, long flowing prose, fragmented for effect)
- Use of metaphor and sensory detail
- Thematic preferences and recurring imagery
- Pacing of description (dense vs. sparse)

Output ONLY the style guide text. No preamble, no headers, no bullet points unless the style itself calls for them.`;

/**
 * Analyzes a DM's writing samples and returns a concise style guide string
 * (200 words max) describing their voice, tone, and stylistic tendencies.
 */
export async function analyzeWritingStyle(
    samples: string[],
    campaignContext?: string
): Promise<string> {
    const filteredSamples = samples.filter(s => s && s.trim().length > 20);
    if (filteredSamples.length === 0) {
        return '';
    }

    const samplesBlock = filteredSamples
        .map((s, i) => `--- Sample ${i + 1} ---\n${s.trim()}`)
        .join('\n\n');

    const prompt = `Analyze these writing samples from a TTRPG Game Master. Describe their voice, tone, vocabulary level, sentence structure, use of metaphor, and thematic preferences. Output a concise style guide (200 words max) that could be given to another writer to match this style.\n\nWriting samples:\n\n${samplesBlock}`;

    const result = await generateText(prompt, MODEL_NAME, campaignContext);
    // Trim and cap at 1200 chars (~200 words) as a safety measure
    return result.trim().slice(0, 1200);
}
