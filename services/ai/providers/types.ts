/**
 * providers/types.ts
 *
 * Defines the AIProvider interface and option types for all AI provider
 * backends. Both the Claude CLI provider and the future Anthropic API
 * provider implement this interface. The three methods mirror the existing
 * core.ts surface so that no downstream service modules need changes.
 */

import type { ModelTier } from '@/services/ai/modelConfig';

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

/**
 * Options for structured JSON generation. The prompt is assembled with
 * instructions, campaign context, and a JSON Schema embedded in the text.
 * The provider is responsible for instructing the model to return valid JSON
 * conforming to the schema.
 */
export interface GenerateWithSchemaOptions {
  prompt: string;
  schema: object;
  instructions: string;
  model: ModelTier;
  campaignContext?: string;
  /** For PDF parsing -- binary data encoded as base64 inline parts. */
  multimodalParts?: MultimodalPart[];
  /**
   * Optional cancellation signal. When it aborts, the provider stops any
   * in-flight network request, performs no further retries, and rejects
   * with an `AbortError`.
   */
  signal?: AbortSignal;
}

/**
 * Options for plain text generation. No structured output is expected.
 */
export interface GenerateTextOptions {
  prompt: string;
  model: ModelTier;
  campaignContext?: string;
  /**
   * Optional cancellation signal. When it aborts, the provider stops any
   * in-flight network request, performs no further retries, and rejects
   * with an `AbortError`.
   */
  signal?: AbortSignal;
}

/**
 * Options for multi-turn chat completion. The history follows the Gemini
 * conversation format (role + parts) for backward compatibility with
 * existing service modules. Providers flatten or adapt as needed.
 */
export interface GenerateChatOptions {
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  model: ModelTier;
  campaignContext?: string;
  /**
   * Optional cancellation signal. When it aborts, the provider stops any
   * in-flight network request, performs no further retries, and rejects
   * with an `AbortError`.
   */
  signal?: AbortSignal;
}

/**
 * A binary document part for multimodal input. Currently used for PDF
 * character sheet parsing. The data field contains base64-encoded content.
 */
export interface MultimodalPart {
  type: 'document';
  mediaType: string;
  data: string;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Abstract AI provider backend. Both `ClaudeCliProvider` and the future
 * `AnthropicApiProvider` implement this interface. The provider registry
 * manages which implementation is active.
 */
export interface AIProvider {
  /** Human-readable provider name (e.g. 'claude-cli', 'anthropic-api'). */
  readonly name: string;

  /**
   * Generate structured JSON output conforming to the given schema.
   * The provider embeds the schema in the prompt and parses the response.
   */
  generateWithSchema<T = unknown>(options: GenerateWithSchemaOptions): Promise<T>;

  /**
   * Generate plain text output. No structured parsing is applied.
   */
  generateText(options: GenerateTextOptions): Promise<string>;

  /**
   * Generate a chat completion from a multi-turn conversation history.
   * The provider adapts the Gemini-style history format as needed.
   */
  generateChatCompletion(options: GenerateChatOptions): Promise<string>;
}
