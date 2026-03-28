/**
 * electron-build.test.ts
 *
 * Structural verification tests that ensure the Electron desktop deployment
 * stays in sync with the main application. These tests inspect source files,
 * configuration, and build artifacts — they never launch Electron.
 *
 * Categories:
 *   1. File structure — required Electron files exist
 *   2. Package.json — scripts, main entry, dependencies
 *   3. AI proxy parity — electron/server.ts stays in sync with vite-plugin-ai-proxy.ts
 *   4. Build config — electron-builder.yml is valid
 *   5. TypeScript compilation — electron code compiles without errors
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');

function rootPath(...segments: string[]): string {
  return path.join(ROOT, ...segments);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ---------------------------------------------------------------------------
// 1. File structure
// ---------------------------------------------------------------------------

describe('Electron file structure', () => {
  const requiredFiles = [
    'electron/main.ts',
    'electron/server.ts',
    'electron/preload.ts',
    'electron/tsconfig.json',
    'electron-builder.yml',
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fileExists(rootPath(file))).toBe(true);
    });
  }

  it('build/ directory exists for app icons', () => {
    expect(fileExists(rootPath('build'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Package.json — Electron configuration
// ---------------------------------------------------------------------------

describe('package.json Electron configuration', () => {
  const pkg = JSON.parse(readFile(rootPath('package.json')));

  it('has main entry pointing to dist-electron/main.js', () => {
    expect(pkg.main).toBe('dist-electron/main.js');
  });

  it('has electron:build script', () => {
    expect(pkg.scripts['electron:build']).toBeDefined();
    // Must build both Vite and Electron
    expect(pkg.scripts['electron:build']).toContain('build');
    expect(pkg.scripts['electron:build']).toContain('electron:build-main');
  });

  it('has electron:dist scripts for each platform', () => {
    expect(pkg.scripts['electron:dist-mac']).toBeDefined();
    expect(pkg.scripts['electron:dist-win']).toBeDefined();
  });

  it('has electron as a devDependency', () => {
    expect(pkg.devDependencies.electron).toBeDefined();
  });

  it('has electron-builder as a devDependency', () => {
    expect(pkg.devDependencies['electron-builder']).toBeDefined();
  });

  it('electron:build-main compiles from electron/tsconfig.json', () => {
    expect(pkg.scripts['electron:build-main']).toContain('electron/tsconfig.json');
  });
});

// ---------------------------------------------------------------------------
// 3. AI proxy parity — electron/server.ts must stay in sync with
//    vite-plugin-ai-proxy.ts
// ---------------------------------------------------------------------------

describe('AI proxy parity between Vite plugin and Electron server', () => {
  const viteProxy = readFile(rootPath('vite-plugin-ai-proxy.ts'));
  const electronServer = readFile(rootPath('electron/server.ts'));

  it('both handle the /api/ai/generate endpoint', () => {
    expect(viteProxy).toContain('/api/ai/generate');
    expect(electronServer).toContain('/api/ai/generate');
  });

  it('both handle the /api/ai/health endpoint', () => {
    expect(viteProxy).toContain('/api/ai/health');
    expect(electronServer).toContain('/api/ai/health');
  });

  it('both use the same CliRequest interface fields', () => {
    // Extract the CliRequest interface fields from both files
    const cliRequestFields = ['prompt', 'model', 'outputFormat', 'systemPrompt', 'maxTurns'];
    for (const field of cliRequestFields) {
      expect(viteProxy).toContain(field);
      expect(electronServer).toContain(field);
    }
  });

  it('both use the same CLI argument flags', () => {
    const cliFlags = ['--print', '--model', '--output-format', '--system-prompt', '--max-turns'];
    for (const flag of cliFlags) {
      expect(viteProxy).toContain(flag);
      expect(electronServer).toContain(flag);
    }
  });

  it('both use the same timeout value', () => {
    // Extract TIMEOUT_MS from both
    const viteTimeout = viteProxy.match(/TIMEOUT_MS\s*=\s*(\d[\d_]*)/);
    const electronTimeout = electronServer.match(/TIMEOUT_MS\s*=\s*(\d[\d_]*)/);
    expect(viteTimeout).not.toBeNull();
    expect(electronTimeout).not.toBeNull();
    expect(viteTimeout![1]).toBe(electronTimeout![1]);
  });

  it('both use the same max buffer size', () => {
    const viteBuffer = viteProxy.match(/MAX_BUFFER\s*=\s*([^;]+)/);
    const electronBuffer = electronServer.match(/MAX_BUFFER\s*=\s*([^;]+)/);
    expect(viteBuffer).not.toBeNull();
    expect(electronBuffer).not.toBeNull();
    // Normalize whitespace for comparison
    expect(viteBuffer![1].trim()).toBe(electronBuffer![1].trim());
  });

  it('both use the same direct prompt limit', () => {
    const viteLimit = viteProxy.match(/DIRECT_PROMPT_LIMIT\s*=\s*(\d[\d_]*)/);
    const electronLimit = electronServer.match(/DIRECT_PROMPT_LIMIT\s*=\s*(\d[\d_]*)/);
    expect(viteLimit).not.toBeNull();
    expect(electronLimit).not.toBeNull();
    expect(viteLimit![1]).toBe(electronLimit![1]);
  });

  it('both use the same max request body size', () => {
    const viteMax = viteProxy.match(/MAX_REQUEST_BODY\s*=\s*([^;]+)/);
    const electronMax = electronServer.match(/MAX_REQUEST_BODY\s*=\s*([^;]+)/);
    expect(viteMax).not.toBeNull();
    expect(electronMax).not.toBeNull();
    expect(viteMax![1].trim()).toBe(electronMax![1].trim());
  });

  it('both parse the Claude CLI JSON envelope identically', () => {
    // Both must check for envelope.result and envelope.is_error
    expect(viteProxy).toContain("'result' in envelope");
    expect(electronServer).toContain("'result' in envelope");
    expect(viteProxy).toContain('envelope.is_error');
    expect(electronServer).toContain('envelope.is_error');
  });

  it('both default to the same CLAUDE_CLI_PATH', () => {
    const viteDefault = viteProxy.match(/CLAUDE_CLI_PATH\s*=\s*([^;]+)/);
    const electronDefault = electronServer.match(/CLAUDE_CLI_PATH\s*=\s*([^;]+)/);
    expect(viteDefault).not.toBeNull();
    expect(electronDefault).not.toBeNull();
    expect(viteDefault![1].trim()).toBe(electronDefault![1].trim());
  });

  it('both use execFile/spawn (no shell) for security', () => {
    // Both must import from child_process and use execFile/spawn
    expect(viteProxy).toContain("from 'child_process'");
    expect(electronServer).toContain("from 'child_process'");
    expect(viteProxy).toContain('execFile');
    expect(electronServer).toContain('execFile');
    expect(viteProxy).toContain('spawn');
    expect(electronServer).toContain('spawn');
  });

  it('both pipe stdin for large prompts', () => {
    expect(viteProxy).toContain('child.stdin.write');
    expect(electronServer).toContain('child.stdin.write');
    expect(viteProxy).toContain('child.stdin.end');
    expect(electronServer).toContain('child.stdin.end');
  });

  it('both handle the same error codes (ENOENT, ETIMEDOUT, SIGKILL)', () => {
    const errorCodes = ['ENOENT', 'ETIMEDOUT', 'SIGKILL', 'SIGTERM'];
    for (const code of errorCodes) {
      expect(viteProxy).toContain(code);
      expect(electronServer).toContain(code);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. electron-builder.yml validation
// ---------------------------------------------------------------------------

describe('electron-builder.yml configuration', () => {
  // Parse YAML manually (simple key checks — no yaml parser needed)
  const builderConfig = readFile(rootPath('electron-builder.yml'));

  it('specifies an appId', () => {
    expect(builderConfig).toMatch(/^appId:/m);
  });

  it('specifies a productName', () => {
    expect(builderConfig).toMatch(/^productName:/m);
  });

  it('includes dist and dist-electron in files', () => {
    expect(builderConfig).toContain('dist/**/*');
    expect(builderConfig).toContain('dist-electron/**/*');
  });

  it('sets main entry to dist-electron/main.js', () => {
    expect(builderConfig).toContain('dist-electron/main.js');
  });

  it('configures macOS targets', () => {
    expect(builderConfig).toMatch(/^mac:/m);
    expect(builderConfig).toContain('dmg');
  });

  it('configures Windows targets', () => {
    expect(builderConfig).toMatch(/^win:/m);
    expect(builderConfig).toContain('nsis');
  });

  it('configures both x64 and arm64 for macOS', () => {
    // After 'mac:' section, should have both architectures
    expect(builderConfig).toContain('x64');
    expect(builderConfig).toContain('arm64');
  });
});

// ---------------------------------------------------------------------------
// 5. Electron TypeScript compilation
// ---------------------------------------------------------------------------

describe('Electron TypeScript compilation', () => {
  it('electron/tsconfig.json is valid JSON', () => {
    const tsconfig = JSON.parse(readFile(rootPath('electron/tsconfig.json')));
    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.outDir).toContain('dist-electron');
  });

  it('compiles without errors', () => {
    // Run tsc in noEmit mode to check for type errors without producing output
    try {
      execSync('npx tsc -p electron/tsconfig.json --noEmit', {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      throw new Error(
        `Electron TypeScript compilation failed:\n${error.stdout || ''}${error.stderr || ''}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Electron main process structure
// ---------------------------------------------------------------------------

describe('Electron main process structure', () => {
  const mainTs = readFile(rootPath('electron/main.ts'));

  it('imports from electron package', () => {
    expect(mainTs).toContain("from 'electron'");
  });

  it('imports server module', () => {
    expect(mainTs).toContain("from './server");
  });

  it('creates a BrowserWindow', () => {
    expect(mainTs).toContain('BrowserWindow');
  });

  it('uses contextIsolation and disables nodeIntegration for security', () => {
    expect(mainTs).toContain('contextIsolation: true');
    expect(mainTs).toContain('nodeIntegration: false');
  });

  it('uses a preload script', () => {
    expect(mainTs).toContain('preload');
  });

  it('loads the built app in production mode', () => {
    expect(mainTs).toContain('localhost');
    expect(mainTs).toContain('serverPort');
  });

  it('opens external links in system browser', () => {
    expect(mainTs).toContain('setWindowOpenHandler');
    expect(mainTs).toContain('shell.openExternal');
  });
});

// ---------------------------------------------------------------------------
// 7. Preload script security
// ---------------------------------------------------------------------------

describe('Electron preload script', () => {
  const preloadTs = readFile(rootPath('electron/preload.ts'));

  it('uses contextBridge (not direct exposure)', () => {
    expect(preloadTs).toContain('contextBridge');
    expect(preloadTs).toContain('exposeInMainWorld');
  });

  it('does not expose dangerous APIs', () => {
    // Should not expose fs, child_process, or require
    expect(preloadTs).not.toContain("require('fs')");
    expect(preloadTs).not.toContain("require('child_process')");
    expect(preloadTs).not.toContain('ipcRenderer.send');
    // Should not use nodeIntegration workarounds
    expect(preloadTs).not.toContain('remote');
  });
});

// ---------------------------------------------------------------------------
// 8. Static file server covers SPA routing
// ---------------------------------------------------------------------------

describe('Electron server SPA support', () => {
  const serverTs = readFile(rootPath('electron/server.ts'));

  it('serves index.html as default', () => {
    expect(serverTs).toContain('index.html');
  });

  it('has SPA fallback for client-side routes', () => {
    // Should serve index.html for unknown routes (SPA routing)
    expect(serverTs).toContain('SPA fallback');
    expect(serverTs).toContain('index.html');
  });

  it('prevents path traversal attacks', () => {
    expect(serverTs).toContain('path traversal');
    expect(serverTs).toContain('startsWith');
  });

  it('binds to 127.0.0.1 only (not 0.0.0.0)', () => {
    expect(serverTs).toContain("'127.0.0.1'");
    expect(serverTs).not.toContain("'0.0.0.0'");
  });

  it('supports common web asset MIME types', () => {
    const requiredTypes = ['.html', '.js', '.css', '.json', '.png', '.svg', '.woff2'];
    for (const ext of requiredTypes) {
      expect(serverTs).toContain(`'${ext}'`);
    }
  });
});
