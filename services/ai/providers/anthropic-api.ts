/**
 * providers/anthropic-api.ts
 *
 * STUB: Anthropic REST API provider. This provider will call the Anthropic
 * Messages API directly using the `@anthropic-ai/sdk` package. It is the
 * future production path for cloud deployments where the Claude CLI is not
 * available.
 *
 * All methods currently throw a "not yet implemented" error. The TODO
 * comments show the intended implementation shape for each method.
 */

import type {
  AIProvider,
  GenerateWithSchemaOptions,
  GenerateTextOptions,
  GenerateChatOptions,
} from './types';

// ---------------------------------------------------------------------------
// Provider stub
// ---------------------------------------------------------------------------

export class AnthropicApiProvider implements AIProvider {
  readonly name = 'anthropic-api';

  /**
   * TODO: Implementation will use the Anthropic SDK's tool_use feature
   * for genuine schema enforcement:
   *
   * ```typescript
   * import Anthropic from '@anthropic-ai/sdk';
   *
   * const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
   *
   * const response = await client.messages.create({
   *   model: mapTierToApiModelId(options.model),
   *   max_tokens: 4096,
   *   system: options.instructions,
   *   messages: [{ role: 'user', content: options.prompt }],
   *   tools: [{
   *     name: 'structured_output',
   *     description: 'Return structured data matching the schema',
   *     input_schema: options.schema,
   *   }],
   *   tool_choice: { type: 'tool', name: 'structured_output' },
   * });
   *
   * // Extract tool_use block from response
   * const toolBlock = response.content.find(b => b.type === 'tool_use');
   * return toolBlock.input as T;
   * ```
   */
  async generateWithSchema<T = unknown>(_options: GenerateWithSchemaOptions): Promise<T> {
    throw new Error(
      'Anthropic API provider not yet implemented. Use claude-cli provider or enable mock mode.'
    );
  }

  /**
   * TODO: Implementation will use messages.create for plain text:
   *
   * ```typescript
   * const response = await client.messages.create({
   *   model: mapTierToApiModelId(options.model),
   *   max_tokens: 4096,
   *   messages: [{ role: 'user', content: options.prompt }],
   * });
   *
   * return response.content[0].text;
   * ```
   */
  async generateText(_options: GenerateTextOptions): Promise<string> {
    throw new Error(
      'Anthropic API provider not yet implemented. Use claude-cli provider or enable mock mode.'
    );
  }

  /**
   * TODO: Implementation will use the system parameter for chat:
   *
   * ```typescript
   * const messages = options.history.map(h => ({
   *   role: h.role === 'model' ? 'assistant' : 'user',
   *   content: h.parts.map(p => p.text).join('\n'),
   * }));
   *
   * const response = await client.messages.create({
   *   model: mapTierToApiModelId(options.model),
   *   max_tokens: 4096,
   *   system: options.systemInstruction,
   *   messages,
   * });
   *
   * return response.content[0].text;
   * ```
   */
  async generateChatCompletion(_options: GenerateChatOptions): Promise<string> {
    throw new Error(
      'Anthropic API provider not yet implemented. Use claude-cli provider or enable mock mode.'
    );
  }
}
