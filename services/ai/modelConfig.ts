
/**
 * modelConfig.ts
 *
 * Centralises all AI model tier mapping and provider configuration for
 * Realmweaver. This module is the single source of truth during the gradual
 * migration away from Gemini toward the Anthropic Claude provider family.
 *
 * Service files should call `resolveModelName` instead of hard-coding Gemini
 * model strings so that the active provider is always honoured.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Logical quality tier used throughout the application. Callers select a tier
 * and this module maps it to the appropriate provider-specific model name.
 *
 * - `lite`     — fastest / cheapest; suitable for quick text enhancements and
 *               low-latency DM-coach responses
 * - `standard` — balanced speed and quality; default for entity generation
 * - `quality`  — highest quality; used for complex multi-entity generation and
 *               detailed world-building
 */
export type ModelTier = 'lite' | 'standard' | 'quality';

/**
 * Supported AI provider back-ends.
 *
 * - `claude-cli`     — Invokes the Claude Code CLI binary; suitable for local
 *                      development and environments where the SDK is installed
 * - `anthropic-api`  — Calls the Anthropic REST API directly; suitable for
 *                      production deployments
 */
export type AIProviderType = 'claude-cli' | 'anthropic-api';

// ---------------------------------------------------------------------------
// Browser-safe environment access
// ---------------------------------------------------------------------------

/**
 * `modelConfig.ts` is imported as a VALUE (not type-only) by
 * `providers/registry.ts` and `providers/claude-cli.ts`, so this module's
 * top-level code runs in the browser during `npm run dev` — the documented
 * production runtime (see CLAUDE.md, vite.config.ts). Vite's `define` only
 * rewrites `process.env.*` references at BUILD time (`vite build`); in dev
 * mode (`this.environment.config.consumer === 'client' && !isBuild`) it is a
 * no-op and nothing shims a `process` global, so a bare `process.env.FOO`
 * read throws `ReferenceError: process is not defined` on first call.
 *
 * Guard every read behind this shim instead: `process` exists in Node
 * (tests, and any future server-side usage) and is simply absent in the
 * browser, in which case every env var below correctly resolves to its
 * documented default rather than crashing.
 */
const ENV: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

// ---------------------------------------------------------------------------
// Tier → Model mappings
// ---------------------------------------------------------------------------

/**
 * Maps a `ModelTier` to the short model alias used by the Claude Code CLI
 * (`claude --model <alias>`).
 *
 * @param tier - The logical quality tier to resolve.
 * @returns The CLI model alias string.
 */
export function mapTierToCliModel(tier: ModelTier): string {
    switch (tier) {
        case 'lite':     return 'haiku';
        case 'standard': return 'sonnet';
        case 'quality':  return 'opus';
    }
}

/**
 * Maps a `ModelTier` to the full Anthropic API model ID used when calling the
 * REST API directly.
 *
 * @param tier - The logical quality tier to resolve.
 * @returns The Anthropic API model ID string.
 */
export function mapTierToApiModelId(tier: ModelTier): string {
    switch (tier) {
        case 'lite':     return 'claude-haiku-4-5-20251001';
        case 'standard': return 'claude-sonnet-4-6';
        case 'quality':  return 'claude-opus-4-6';
    }
}

// ---------------------------------------------------------------------------
// Legacy Gemini name → tier resolution
// ---------------------------------------------------------------------------

/**
 * Maps legacy Gemini model name strings to their equivalent `ModelTier` for
 * backwards compatibility during the gradual migration. Any unrecognised name
 * falls back to `'standard'`.
 *
 * @param geminiName - A Gemini model name string (e.g. `'gemini-2.5-flash'`).
 * @returns The closest `ModelTier` equivalent.
 */
export function resolveGeminiModelName(geminiName: string): ModelTier {
    switch (geminiName) {
        case 'gemini-flash-lite-latest': return 'lite';
        case 'gemini-2.5-flash':         return 'standard';
        case 'gemini-2.5-pro':           return 'quality';
        case 'gemini-3-pro-preview':     return 'quality';
        default:                          return 'standard';
    }
}

// ---------------------------------------------------------------------------
// Active provider detection
// ---------------------------------------------------------------------------

/**
 * Reads `REALMWEAVER_AI_PROVIDER` from the environment and returns the active
 * `AIProviderType`. Defaults to `'claude-cli'` when the variable is absent or
 * unrecognised.
 *
 * @returns The currently configured AI provider type.
 */
export function getActiveProvider(): AIProviderType {
    const raw = ENV.REALMWEAVER_AI_PROVIDER;
    if (raw === 'anthropic-api' || raw === 'claude-cli') {
        return raw;
    }
    return 'claude-cli';
}

// ---------------------------------------------------------------------------
// Unified model resolver
// ---------------------------------------------------------------------------

/** The set of valid `ModelTier` values used for fast membership checks. */
const VALID_TIERS: ReadonlySet<string> = new Set<ModelTier>(['lite', 'standard', 'quality']);

/**
 * Resolves a caller-supplied string — which may be a `ModelTier` value **or** a
 * legacy Gemini model name — to the appropriate model identifier for the
 * currently active provider.
 *
 * This is the primary entry point that service files should use during the
 * gradual migration. Example:
 *
 * ```typescript
 * // Old code (Gemini, hard-coded):
 * const modelName = 'gemini-2.5-flash';
 *
 * // New code (provider-agnostic):
 * const modelName = resolveModelName('gemini-2.5-flash'); // or resolveModelName('standard')
 * ```
 *
 * @param tierOrLegacy - A `ModelTier` value or a legacy Gemini model name string.
 * @returns The provider-specific model identifier (CLI alias or API model ID).
 */
export function resolveModelName(tierOrLegacy: string): string {
    const tier: ModelTier = VALID_TIERS.has(tierOrLegacy)
        ? (tierOrLegacy as ModelTier)
        : resolveGeminiModelName(tierOrLegacy);

    const provider = getActiveProvider();

    switch (provider) {
        case 'anthropic-api': return mapTierToApiModelId(tier);
        case 'claude-cli':    return mapTierToCliModel(tier);
    }
}

// ---------------------------------------------------------------------------
// Provider-specific configuration
// ---------------------------------------------------------------------------

/**
 * Full configuration object for the active AI provider. Consumed by higher-
 * level service wrappers that need to know how to connect to the provider.
 */
export interface ProviderConfig {
    /** The resolved provider type. */
    type: AIProviderType;

    /**
     * Path to the `claude` binary when `type` is `'claude-cli'`.
     * Defaults to `'claude'` (assumes the binary is on `$PATH`).
     */
    cliPath?: string;

    /**
     * Anthropic API key when `type` is `'anthropic-api'`.
     * Read from `ANTHROPIC_API_KEY`.
     */
    apiKey?: string;

    /**
     * Custom base URL for the Anthropic API when `type` is `'anthropic-api'`.
     * Read from `REALMWEAVER_API_BASE_URL`. Useful for proxies or self-hosted
     * deployments.
     */
    baseUrl?: string;

    /** Default model tier applied when callers do not specify one. Defaults to `'standard'`. */
    defaultTier: ModelTier;

    /** Maximum number of retry attempts on transient failures. Defaults to `3`. */
    maxRetries: number;

    /** Request timeout in milliseconds. Defaults to `120000` (2 minutes). */
    timeoutMs: number;
}

/**
 * Builds and returns a `ProviderConfig` populated from environment variables.
 *
 * | Environment Variable          | Config field      | Default      |
 * |-------------------------------|-------------------|--------------|
 * | `REALMWEAVER_AI_PROVIDER`     | `type`            | `claude-cli` |
 * | `CLAUDE_CLI_PATH`             | `cliPath`         | `'claude'`   |
 * | `ANTHROPIC_API_KEY`           | `apiKey`          | —            |
 * | `REALMWEAVER_API_BASE_URL`    | `baseUrl`         | —            |
 * | `REALMWEAVER_DEFAULT_TIER`    | `defaultTier`     | `'standard'` |
 * | `REALMWEAVER_MAX_RETRIES`     | `maxRetries`      | `3`          |
 * | `REALMWEAVER_TIMEOUT_MS`      | `timeoutMs`       | `120000`     |
 *
 * @returns A fully populated `ProviderConfig` object.
 */
export function getProviderConfig(): ProviderConfig {
    const type = getActiveProvider();

    const rawTier = ENV.REALMWEAVER_DEFAULT_TIER ?? '';
    const defaultTier: ModelTier = VALID_TIERS.has(rawTier)
        ? (rawTier as ModelTier)
        : 'standard';

    const rawRetries = parseInt(ENV.REALMWEAVER_MAX_RETRIES ?? '', 10);
    const maxRetries = Number.isFinite(rawRetries) && rawRetries >= 0 ? rawRetries : 3;

    const rawTimeout = parseInt(ENV.REALMWEAVER_TIMEOUT_MS ?? '', 10);
    const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 120_000;

    const config: ProviderConfig = {
        type,
        defaultTier,
        maxRetries,
        timeoutMs,
    };

    if (type === 'claude-cli') {
        config.cliPath = ENV.CLAUDE_CLI_PATH ?? 'claude';
    }

    if (type === 'anthropic-api') {
        const apiKey = ENV.ANTHROPIC_API_KEY;
        if (apiKey) {
            config.apiKey = apiKey;
        }
        const baseUrl = ENV.REALMWEAVER_API_BASE_URL;
        if (baseUrl) {
            config.baseUrl = baseUrl;
        }
    }

    return config;
}
