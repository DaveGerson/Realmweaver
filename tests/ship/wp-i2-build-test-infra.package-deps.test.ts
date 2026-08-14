/**
 * wp-i2-build-test-infra — finding #117
 *
 * `reactflow@11.10.1` and `dagre@0.8.5` are pinned runtime dependencies, but no
 * source file imports either one — `components/visualizers/RelationshipGraph.tsx`
 * uses d3 only. They must be dropped from package.json (verified below by
 * re-deriving the "is it imported anywhere" check from the source tree, so the
 * assertion stays honest if someone later reintroduces a real React Flow usage).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'playwright-report', 'test-results', 'tests', 'e2e']);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const sources = collectSourceFiles(repoRoot);

function isImportedAnywhere(packageName: string): boolean {
  const pattern = new RegExp(
    `(?:from|import)\\s*\\(?\\s*['"]${packageName}(?:/[^'"]*)?['"]`,
  );
  return sources.some((file) => pattern.test(readFileSync(file, 'utf8')));
}

describe('wp-i2 — unused visualization dependencies (finding #117)', () => {
  for (const dep of ['reactflow', 'dagre'] as const) {
    it(`does not declare "${dep}" as a dependency while nothing imports it`, () => {
      const declared = Boolean(pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep]);

      // Either the package is genuinely used, or it must not be declared.
      expect({ dep, declared, imported: isImportedAnywhere(dep) }).toEqual({
        dep,
        declared: false,
        imported: false,
      });
    });
  }
});
