/**
 * providers/claude-cli.ts
 *
 * Claude CLI provider implementation. Calls the local Vite middleware
 * endpoint at `/api/ai/generate` which in turn spawns the `claude` CLI
 * binary. This is the primary provider for local development where the
 * user has a Claude Code subscription (Max plan).
 *
 * The provider handles:
 * - Prompt assembly (instructions + campaign context + schema + formatting rules)
 * - JSON response parsing with a recovery pipeline
 * - Multi-turn chat flattening (CLI does not support native multi-turn)
 * - System prompt forwarding via the --system-prompt CLI flag
 * - Multimodal PDF handling via base64 inline encoding
 */

import type { ModelTier } from '@/services/ai/modelConfig';
import type {
  AIProvider,
  GenerateWithSchemaOptions,
  GenerateTextOptions,
  GenerateChatOptions,
} from './types';
import { withRetry } from './retry';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type CliModel = 'haiku' | 'sonnet' | 'opus';

const TIER_TO_CLI_MODEL: Record<ModelTier, CliModel> = {
  lite:     'haiku',
  standard: 'sonnet',
  quality:  'opus',
};

interface CliRequest {
  prompt: string;
  model: CliModel;
  outputFormat: 'json' | 'text';
  systemPrompt?: string;
  maxTurns?: number;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class ClaudeCliProvider implements AIProvider {
  readonly name = 'claude-cli';

  async generateWithSchema<T = unknown>(options: GenerateWithSchemaOptions): Promise<T> {
    const { prompt, schema, instructions, model, campaignContext, multimodalParts } = options;

    const contextBlock = campaignContext
      ? `\nReference the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>\n`
      : '';

    const schemaBlock = JSON.stringify(schema, null, 2);

    // Build system prompt: persona instructions + campaign context + schema contract
    const systemPrompt = [
      instructions,
      contextBlock,
      '',
      'IMPORTANT: Your entire response must be a single, valid JSON object that conforms to this schema:',
      schemaBlock,
      '',
      'Do not wrap it in markdown code blocks. Do not include any text before or after the JSON.',
      'Ensure all newlines within string values are escaped as \\n.',
    ].join('\n');

    // Build user prompt: just the user's actual request (+ multimodal if present)
    let userPrompt = prompt;
    if (multimodalParts?.length) {
      for (const part of multimodalParts) {
        if (part.mediaType === 'application/pdf') {
          userPrompt += `\n\n<document type="pdf" encoding="base64">\n${part.data}\n</document>`;
        }
      }
    }

    const raw = await this.callApi({
      prompt: userPrompt,
      model: TIER_TO_CLI_MODEL[model],
      outputFormat: 'json',
      systemPrompt,
    });

    return this.parseJsonResponse<T>(raw);
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const { prompt, model, campaignContext } = options;

    const systemPrompt = campaignContext
      ? `Reference the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>`
      : undefined;

    const raw = await this.callApi({
      prompt,
      model: TIER_TO_CLI_MODEL[model],
      outputFormat: 'text',
      systemPrompt,
    });

    return raw.trim();
  }

  async generateChatCompletion(options: GenerateChatOptions): Promise<string> {
    const { history, systemInstruction, model, campaignContext } = options;

    const contextBlock = campaignContext
      ? `\n\nUse the following existing campaign information for context and consistency:\n<campaign_context>\n${campaignContext}\n</campaign_context>`
      : '';

    // Flatten multi-turn history into a single prompt for CLI invocation.
    // The CLI does not support multi-turn conversations natively in --print mode.
    const conversationBlock = history
      .map(h => {
        const role = h.role === 'model' ? 'Assistant' : 'Human';
        const text = h.parts.map(p => p.text).join('\n');
        return `${role}: ${text}`;
      })
      .join('\n\n');

    const assembledPrompt = [
      conversationBlock,
      '',
      'Continue the conversation as the Assistant. Respond to the last Human message.',
    ].join('\n');

    const raw = await this.callApi({
      prompt: assembledPrompt,
      model: TIER_TO_CLI_MODEL[model],
      outputFormat: 'text',
      systemPrompt: `${systemInstruction}${contextBlock}`,
    });

    return raw.trim();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sends a request to the Vite middleware AI proxy endpoint. Wraps the
   * call in the retry utility to handle transient failures.
   */
  private async callApi(request: CliRequest): Promise<string> {
    return withRetry(
      () => this.rawCallApi(request),
      { maxAttempts: 2, delayMs: 1500, label: `${request.model} ${request.outputFormat}` }
    );
  }

  /**
   * Raw fetch call to the local Vite middleware endpoint. Separated from
   * callApi so that the retry wrapper can re-invoke it cleanly.
   */
  private async rawCallApi(request: CliRequest): Promise<string> {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model,
        outputFormat: request.outputFormat,
        systemPrompt: request.systemPrompt,
        maxTurns: 1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage = (errorBody as { error?: string }).error
        || `AI request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data: { result: string } = await response.json();
    return data.result;
  }

  /**
   * JSON recovery pipeline for structured output responses:
   * 1. Strip markdown fences (```json ... ```)
   * 2. Find JSON boundaries (first '{' to last '}')
   * 3. Attempt parse
   * 4. Throw with diagnostic info on failure
   */
  private parseJsonResponse<T>(raw: string): T {
    // Step 1: Strip markdown fences
    let cleaned = raw
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    // Step 2: Find JSON boundaries
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      console.error(
        'JSON parse failed. Raw response (first 500 chars):',
        raw.substring(0, 500)
      );
      throw new Error(
        'Received an invalid JSON response from the AI model. The response could not be parsed.'
      );
    }
  }
}
