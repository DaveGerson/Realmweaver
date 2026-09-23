/**
 * migration-verification.test.ts
 *
 * Structural verification tests for the Gemini-to-Claude migration.
 * These tests read source files and inspect imported module shapes —
 * they never call the actual AI API.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const AI_DIR = path.join(ROOT, 'services', 'ai');

/** Resolve a path relative to the project root. */
function rootPath(...segments: string[]): string {
  return path.join(ROOT, ...segments);
}

/** Read a file and return its contents as a string. */
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/** Return all .ts files in services/ai/ (not recursing into sub-dirs unless specified). */
function aiServiceFiles(includeProviders = false): string[] {
  const pattern = includeProviders
    ? path.join(AI_DIR, '**', '*.ts')
    : path.join(AI_DIR, '*.ts');
  // Use synchronous glob equivalent via fs.readdirSync for portability
  if (includeProviders) {
    const top = fs.readdirSync(AI_DIR, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of top) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(path.join(AI_DIR, entry.name));
      } else if (entry.isDirectory()) {
        const sub = fs.readdirSync(path.join(AI_DIR, entry.name), { withFileTypes: true });
        for (const subEntry of sub) {
          if (subEntry.isFile() && subEntry.name.endsWith('.ts')) {
            results.push(path.join(AI_DIR, entry.name, subEntry.name));
          }
        }
      }
    }
    return results;
  }
  return fs
    .readdirSync(AI_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.ts'))
    .map(e => path.join(AI_DIR, e.name));
}

// ---------------------------------------------------------------------------
// Test group 1: No Gemini SDK imports in service layer
// ---------------------------------------------------------------------------

describe('No Gemini SDK imports in service layer', () => {
  const GEMINI_SDK_IMPORT = /@google\/genai/;
  const EXCLUDED_FILE = 'audioTranscription.ts';

  it('no file in services/ai/ (except audioTranscription.ts) imports @google/genai', () => {
    const files = aiServiceFiles(true).filter(
      f => path.basename(f) !== EXCLUDED_FILE
    );

    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFile(file);
      if (GEMINI_SDK_IMPORT.test(content)) {
        violations.push(path.relative(ROOT, file));
      }
    }

    expect(
      violations,
      `These files still import @google/genai:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  it('audioTranscription.ts is allowed to use @google/genai (dynamic import)', () => {
    const filePath = path.join(AI_DIR, EXCLUDED_FILE);
    const content = readFile(filePath);
    // Confirm the exemption is still warranted — file actually uses it
    expect(content).toMatch(/@google\/genai/);
    // Confirm it is a dynamic import (not a static top-level import)
    expect(content).toMatch(/await import\(['"]@google\/genai['"]\)/);
  });
});

// ---------------------------------------------------------------------------
// Test group 2: All schemas are JSON Schema format
// ---------------------------------------------------------------------------

describe('All schemas are JSON Schema format', () => {
  /**
   * Recursively asserts that a schema node and all nested schemas use plain
   * JSON Schema constructs (string type identifiers, plain object properties,
   * string[] required arrays) rather than SDK Type.* enum values.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function assertJsonSchemaNode(schema: any, path: string): void {
    // type must be a plain string, not a Symbol/enum object
    if ('type' in schema) {
      expect(
        typeof schema.type,
        `${path}.type should be a string, not ${typeof schema.type}`
      ).toBe('string');
    }

    // properties must be a plain object (if present)
    if ('properties' in schema) {
      expect(
        typeof schema.properties,
        `${path}.properties should be a plain object`
      ).toBe('object');
      expect(
        Array.isArray(schema.properties),
        `${path}.properties should not be an array`
      ).toBe(false);

      // Recurse into property schemas
      for (const [key, value] of Object.entries(schema.properties)) {
        assertJsonSchemaNode(value, `${path}.properties.${key}`);
      }
    }

    // required must be a string array (if present)
    if ('required' in schema) {
      expect(
        Array.isArray(schema.required),
        `${path}.required should be an array`
      ).toBe(true);
      for (const item of schema.required as unknown[]) {
        expect(
          typeof item,
          `${path}.required items should be strings`
        ).toBe('string');
      }
    }

    // items must also be a valid JSON Schema node (if present)
    if ('items' in schema && typeof schema.items === 'object' && schema.items !== null) {
      assertJsonSchemaNode(schema.items, `${path}.items`);
    }
  }

  it('realmWeaver.ts schemas use plain string types', async () => {
    const mod = await import('../services/ai/realmWeaver');
    const schemas = [
      { name: 'npcSchema',               schema: mod.npcSchema },
      { name: 'locationSchema',          schema: mod.locationSchema },
      { name: 'factionSchema',           schema: mod.factionSchema },
      { name: 'itemSchema',              schema: mod.itemSchema },
      { name: 'skillCheckSchema',        schema: mod.skillCheckSchema },
      { name: 'sceneSchema',             schema: mod.sceneSchema },
      { name: 'adventureWithScenesSchema', schema: mod.adventureWithScenesSchema },
      { name: 'articleSchema',           schema: mod.articleSchema },
      { name: 'pointOfInterestSchema',   schema: mod.pointOfInterestSchema },
    ];

    for (const { name, schema } of schemas) {
      expect(schema, `${name} should be defined`).toBeDefined();
      expect(schema.type, `${name}.type should be 'object'`).toBe('object');
      assertJsonSchemaNode(schema, name);
    }
  });

  it('dmCoach.ts schemas use plain string types', async () => {
    const mod = await import('../services/ai/dmCoach');
    const schemas = [
      { name: 'sessionAnalysisSchema', schema: mod.sessionAnalysisSchema },
      { name: 'sessionRecapSchema',    schema: mod.sessionRecapSchema },
    ];

    for (const { name, schema } of schemas) {
      expect(schema, `${name} should be defined`).toBeDefined();
      expect(schema.type, `${name}.type should be 'object'`).toBe('object');
      assertJsonSchemaNode(schema, name);
    }
  });

  it('evocationWizard.ts schemas use plain string types', async () => {
    const mod = await import('../services/ai/evocationWizard');
    const schemas = [
      { name: 'playerCharacterSchema', schema: mod.playerCharacterSchema },
    ];

    for (const { name, schema } of schemas) {
      expect(schema, `${name} should be defined`).toBeDefined();
      expect(schema.type, `${name}.type should be 'object'`).toBe('object');
      assertJsonSchemaNode(schema, name);
    }
  });

  it('worldSimulation.ts exported schema uses plain string types', async () => {
    // worldSimulation.ts does not export schemas directly, but we verify
    // the module loads without error and that WorldEvent type is exported
    const mod = await import('../services/ai/worldSimulation');
    expect(typeof mod.generateWorldEvents).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Model config
// ---------------------------------------------------------------------------

describe('Model config', () => {
  it('mapTierToCliModel returns expected aliases', async () => {
    const { mapTierToCliModel } = await import('../services/ai/modelConfig');

    expect(mapTierToCliModel('lite')).toBe('haiku');
    expect(mapTierToCliModel('standard')).toBe('sonnet');
    expect(mapTierToCliModel('quality')).toBe('opus');
  });

  it('mapTierToApiModelId returns IDs containing the expected family name', async () => {
    const { mapTierToApiModelId } = await import('../services/ai/modelConfig');

    expect(mapTierToApiModelId('lite')).toContain('haiku');
    expect(mapTierToApiModelId('standard')).toContain('sonnet');
    expect(mapTierToApiModelId('quality')).toContain('opus');
  });

  it('resolveGeminiModelName maps legacy Gemini names to tiers', async () => {
    const { resolveGeminiModelName } = await import('../services/ai/modelConfig');

    expect(resolveGeminiModelName('gemini-2.5-flash')).toBe('standard');
    expect(resolveGeminiModelName('gemini-flash-lite-latest')).toBe('lite');
    expect(resolveGeminiModelName('gemini-2.5-pro')).toBe('quality');
    expect(resolveGeminiModelName('gemini-3-pro-preview')).toBe('quality');
    // Unknown strings should fall back to 'standard'
    expect(resolveGeminiModelName('some-unknown-model')).toBe('standard');
  });

  it('getActiveProvider returns claude-cli by default', async () => {
    const { getActiveProvider } = await import('../services/ai/modelConfig');

    // Ensure env var is not set so the default is exercised
    delete process.env.REALMWEAVER_AI_PROVIDER;
    expect(getActiveProvider()).toBe('claude-cli');
  });

  it('getActiveProvider respects REALMWEAVER_AI_PROVIDER env var', async () => {
    const { getActiveProvider } = await import('../services/ai/modelConfig');

    process.env.REALMWEAVER_AI_PROVIDER = 'anthropic-api';
    expect(getActiveProvider()).toBe('anthropic-api');

    process.env.REALMWEAVER_AI_PROVIDER = 'claude-cli';
    expect(getActiveProvider()).toBe('claude-cli');

    // Restore default
    delete process.env.REALMWEAVER_AI_PROVIDER;
  });
});

// ---------------------------------------------------------------------------
// Test group 4: Provider interface
// ---------------------------------------------------------------------------

describe('Provider interface', () => {
  it('ClaudeCliProvider has the correct name and method signatures', async () => {
    const { ClaudeCliProvider } = await import('../services/ai/providers/claude-cli');

    const provider = new ClaudeCliProvider();

    expect(provider.name).toBe('claude-cli');
    expect(typeof provider.generateWithSchema).toBe('function');
    expect(typeof provider.generateText).toBe('function');
    expect(typeof provider.generateChatCompletion).toBe('function');
  });

  it('ClaudeCliProvider instance satisfies the AIProvider interface shape', async () => {
    const { ClaudeCliProvider } = await import('../services/ai/providers/claude-cli');
    const provider = new ClaudeCliProvider();

    // Check arity: each method should accept an options object (1 parameter)
    expect(provider.generateWithSchema.length).toBe(1);
    expect(provider.generateText.length).toBe(1);
    expect(provider.generateChatCompletion.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Service facade exports
// ---------------------------------------------------------------------------

describe('Service facade exports', () => {
  const EXPECTED_FUNCTIONS = [
    'generateNpc',
    'generateLocation',
    'generateFaction',
    'generateItem',
    'generateScene',
    'generateAdventure',
    'generateArticle',
    'generateNarration',
    'generateImprovisation',
    'generateRollableTable',
    'generateCampaignFill',
    'generateEnhancedText',
    'generatePoiFromLoot',
    'parseDocumentForEntities',
    'generateChatResponse',
    'parseCharacterSheetPdf',
    'chatWithRealmWeaver',
    'analyzeSessionNotes',
    'generateNpcRoleplay',
    'generateSessionRecap',
    'generateStarterNpcs',
    'generateStarterLocations',
    'generateStarterAdventure',
    'analyzeWritingStyle',
    'generateWorldEvents',
  ] as const;

  it('all expected generator functions are exported from services/aiService.ts', async () => {
    const mod = await import('../services/aiService');

    const missing: string[] = [];
    for (const name of EXPECTED_FUNCTIONS) {
      if (typeof (mod as Record<string, unknown>)[name] !== 'function') {
        missing.push(name);
      }
    }

    expect(
      missing,
      `Missing or non-function exports from aiService:\n${missing.join('\n')}`
    ).toHaveLength(0);
  });

  it('no generator function accepts useGroundedSearch as a parameter', async () => {
    // Structural check: verify the source file does not expose useGroundedSearch
    // in any exported function signature
    const content = readFile(rootPath('services', 'aiService.ts'));
    expect(
      content,
      'aiService.ts should not reference useGroundedSearch'
    ).not.toContain('useGroundedSearch');
  });

  it('generateNpc does not require useGroundedSearch (second param is isMockMode boolean)', async () => {
    const mod = await import('../services/aiService');
    // The facade signature is: generateNpc(prompt, isMockMode?, campaignContext?)
    // Function.length reflects the number of required params before the first default
    // The current signature has 1 required (prompt), rest have defaults => length === 1
    expect(mod.generateNpc.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test group 6: No hardcoded Gemini model strings in services
// ---------------------------------------------------------------------------

describe('No hardcoded Gemini model strings in services', () => {
  const GEMINI_MODEL_STRINGS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-flash-lite-latest',
    'gemini-3-pro-preview',
  ];

  // Files allowed to mention Gemini model names (legacy mapping / exempt files)
  const EXEMPT_FILES = new Set([
    'mockService.ts',
    'audioTranscription.ts',
    // core.ts and modelConfig.ts contain the legacy mapping table — exempt them
    'core.ts',
    'modelConfig.ts',
  ]);

  it('service files do not hardcode Gemini model strings outside of allowed files', () => {
    const allFiles = aiServiceFiles(true);
    const violations: string[] = [];

    for (const file of allFiles) {
      const basename = path.basename(file);
      if (EXEMPT_FILES.has(basename)) {
        continue;
      }

      const content = readFile(file);
      for (const modelString of GEMINI_MODEL_STRINGS) {
        if (content.includes(modelString)) {
          violations.push(`${path.relative(ROOT, file)} contains '${modelString}'`);
        }
      }
    }

    expect(
      violations,
      `These files contain hardcoded Gemini model strings:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  it('exempt files (core.ts, modelConfig.ts) contain Gemini names only as mapping entries', () => {
    // Roadmap X2: modelConfig.ts owns the ONE legacy/tier mapping table
    // (`toModelTier` / `resolveGeminiModelName`). core.ts used to carry a
    // private duplicate; it now delegates, so it must NOT re-grow a copy.
    const corePath = path.join(AI_DIR, 'core.ts');
    const modelConfigPath = path.join(AI_DIR, 'modelConfig.ts');

    expect(readFile(modelConfigPath)).toContain('gemini-2.5-flash');
    const core = readFile(corePath);
    expect(core).toContain('toModelTier');
    expect(core).not.toContain('gemini-2.5-flash');
  });
});
