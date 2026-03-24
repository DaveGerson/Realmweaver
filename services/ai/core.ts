/**
 * core.ts
 *
 * Backward-compatible adapter layer. Preserves the exact same 3 exported
 * function signatures that all 6 service modules (realmWeaver, dmCoach,
 * evocationWizard, realmChat, worldSimulation, styleMatching) call today.
 *
 * Internally, these functions delegate to the active AIProvider via the
 * provider registry. Legacy Gemini model names are mapped to ModelTier
 * values so that service modules work unchanged during the gradual migration.
 *
 * The `configOverrides` parameter is accepted for backward compatibility:
 * - `configOverrides.contents` (multimodal PDF): converted to MultimodalPart[]
 * - `configOverrides.tools` (Google Search grounding): silently dropped (no Claude equivalent)
 * - All other Gemini-specific config fields are ignored
 */

import { getActiveProvider } from './providers/registry';
import type { ModelTier } from '@/services/ai/modelConfig';
import type { MultimodalPart } from './providers/types';

// ---------------------------------------------------------------------------
// Legacy model name mapping
// ---------------------------------------------------------------------------

/**
 * Maps legacy Gemini model name strings (and direct tier names) to ModelTier.
 * Unrecognised names fall back to 'standard'.
 */
function mapLegacyModelName(name: string): ModelTier {
  const map: Record<string, ModelTier> = {
    'gemini-flash-lite-latest': 'lite',
    'gemini-2.5-flash':         'standard',
    'gemini-2.5-pro':           'quality',
    'gemini-3-pro-preview':     'quality',
    // Direct tier names pass through
    'lite':                     'lite',
    'standard':                 'standard',
    'quality':                  'quality',
  };
  return map[name] || 'standard';
}

// ---------------------------------------------------------------------------
// Exported functions (signatures preserved exactly)
// ---------------------------------------------------------------------------

/**
 * Generate structured JSON output conforming to the given schema.
 *
 * @param prompt - The user's generation prompt.
 * @param schema - JSON Schema object describing the expected output shape.
 * @param instructions - System-level instructions for the AI model.
 * @param configOverrides - Legacy Gemini config. Only `contents` (multimodal)
 *   is forwarded; `tools` (Google Search grounding) is silently dropped.
 * @param modelName - A Gemini model name or ModelTier string.
 * @param campaignContext - Optional campaign context for consistency.
 * @returns Parsed JSON object matching the schema.
 */
export const generateWithSchema = async (
  prompt: string,
  schema: object,
  instructions: string,
  configOverrides: object = {},
  modelName: string,
  campaignContext?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  const provider = getActiveProvider();
  const model = mapLegacyModelName(modelName);

  // Extract multimodal parts from Gemini-style configOverrides.
  // The Gemini SDK uses { contents: { parts: [{ inlineData: { mimeType, data } }] } }
  // for PDF and other binary inputs. We convert these to our MultimodalPart format.
  let multimodalParts: MultimodalPart[] | undefined;

  const overrides = configOverrides as Record<string, unknown>;
  const contents = overrides.contents as
    | { parts?: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> }
    | undefined;

  if (contents?.parts) {
    multimodalParts = contents.parts
      .filter((p): p is { inlineData: { mimeType: string; data: string } } =>
        p.inlineData !== undefined
      )
      .map(p => ({
        type: 'document' as const,
        mediaType: p.inlineData.mimeType,
        data: p.inlineData.data,
      }));

    // Also extract any text part that was included alongside the PDF and
    // append it to the prompt so the model receives the text instruction.
    const textPart = contents.parts.find(p => 'text' in p && p.text);
    if (textPart && textPart.text) {
      // If the caller passed an empty prompt (common for PDF parsing), use
      // the text part as the prompt. Otherwise append it.
      if (!prompt) {
        prompt = textPart.text;
      } else {
        prompt = `${prompt}\n\n${textPart.text}`;
      }
    }
  }

  // Silently drop Google Search grounding tools -- no Claude equivalent.
  if (overrides.tools) {
    console.info(
      'core.ts: Google Search grounding (configOverrides.tools) is not supported by the Claude provider and has been silently dropped.'
    );
  }

  return provider.generateWithSchema({
    prompt,
    schema,
    instructions,
    model,
    campaignContext,
    multimodalParts: multimodalParts?.length ? multimodalParts : undefined,
  });
};

/**
 * Generate plain text output.
 *
 * @param fullPrompt - The complete prompt text (instructions included by caller).
 * @param modelName - A Gemini model name or ModelTier string.
 * @param campaignContext - Optional campaign context for consistency.
 * @returns The generated text.
 */
export const generateText = async (
  fullPrompt: string,
  modelName: string,
  campaignContext?: string
): Promise<string> => {
  const provider = getActiveProvider();
  return provider.generateText({
    prompt: fullPrompt,
    model: mapLegacyModelName(modelName),
    campaignContext,
  });
};

/**
 * Generate a chat completion from a multi-turn conversation history.
 *
 * @param history - Gemini-style conversation history (role + parts).
 * @param systemInstruction - System-level instruction for the assistant.
 * @param modelName - A Gemini model name or ModelTier string.
 * @param campaignContext - Optional campaign context for consistency.
 * @returns The assistant's response text.
 */
export const generateChatCompletion = async (
  history: { role: string; parts: { text: string }[] }[],
  systemInstruction: string,
  modelName: string,
  campaignContext?: string
): Promise<string> => {
  const provider = getActiveProvider();
  return provider.generateChatCompletion({
    history,
    systemInstruction,
    model: mapLegacyModelName(modelName),
    campaignContext,
  });
};
