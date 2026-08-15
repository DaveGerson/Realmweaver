/**
 * providers/registry.ts
 *
 * Provider registry singleton. Manages which AIProvider implementation is
 * active and provides lazy instantiation. The default provider is 'claude-cli'.
 *
 * Usage from core.ts:
 *   import { getActiveProvider } from './providers/registry';
 *   const provider = getActiveProvider();
 *   const result = await provider.generateText({ ... });
 */

import type { AIProvider } from './types';
import { ClaudeCliProvider } from './claude-cli';
import { AnthropicApiProvider } from './anthropic-api';
import { getActiveProvider as getConfiguredProviderType } from '../modelConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = 'claude-cli' | 'anthropic-api' | 'gemini';

// ---------------------------------------------------------------------------
// Registry state
// ---------------------------------------------------------------------------

let activeProvider: AIProvider | null = null;
// Lazily initialised from REALMWEAVER_AI_PROVIDER (via modelConfig.getActiveProvider())
// on first read, rather than hard-coded, so the env var actually takes effect. `null`
// means "not yet initialised from env"; `setProvider` can still override it explicitly.
let activeProviderName: ProviderName | null = null;

function resolveInitialProviderName(): ProviderName {
  // modelConfig.getActiveProvider() already validates the env var and falls
  // back to 'claude-cli' for anything unrecognised.
  return getConfiguredProviderType();
}

/**
 * Factory map for lazy provider instantiation. Each entry returns a new
 * provider instance. The 'gemini' entry exists only to provide a clear
 * error message during the migration period.
 */
const providers: Record<ProviderName, () => AIProvider> = {
  'claude-cli':    () => new ClaudeCliProvider(),
  'anthropic-api': () => new AnthropicApiProvider(),
  'gemini':        () => { throw new Error('Gemini provider removed. Use claude-cli.'); },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the currently active AIProvider instance, instantiating it on
 * first access. Subsequent calls return the cached instance until
 * `setProvider` is called.
 */
export function getActiveProvider(): AIProvider {
  if (activeProviderName === null) {
    activeProviderName = resolveInitialProviderName();
  }
  if (!activeProvider) {
    activeProvider = providers[activeProviderName]();
  }
  return activeProvider;
}

/**
 * Switches the active provider. The next call to `getActiveProvider()`
 * will instantiate the new provider. Any cached instance is discarded.
 *
 * @param name - The provider to activate.
 */
export function setProvider(name: ProviderName): void {
  activeProvider = null;
  activeProviderName = name;
}

/**
 * Returns the name of the currently configured provider (may not be
 * instantiated yet).
 */
export function getProviderName(): ProviderName {
  if (activeProviderName === null) {
    activeProviderName = resolveInitialProviderName();
  }
  return activeProviderName;
}
