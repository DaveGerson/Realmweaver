/**
 * wp-i2-build-test-infra — blocker #1 (verifier round 2, regression from #29's fix)
 *
 * The #29 fix replaced the CDN Tailwind v3 JIT compiler (which scans the live DOM
 * at runtime via MutationObserver, so it can style whatever class string actually
 * ends up on an element) with build-time Tailwind v4 (`@tailwindcss/vite`, which
 * only emits CSS for class names it finds as *literal* strings in source). Several
 * components compose their entity-accent classes from `ENTITY_TYPE_CONFIG[...].color`
 * (or an equivalent runtime color variable) at runtime via template literals —
 * e.g. `` `text-${color}-400` ``, `` `bg-${c}-900/50 text-${c}-300 border-${c}-700/50` ``
 * — so those composed strings never appear literally in source and the build-time
 * scanner drops them. The verifier enumerated 37 of 88 required utilities missing
 * from the built stylesheet, including every accent class PlayerCharacterDashboard
 * uses (teal).
 *
 * Fix: index.css declares an explicit `@source inline(...)` safelist covering the
 * full cross-product of {text,bg,border,border-l} x {the ENTITY_TYPE_CONFIG colors
 * + blue} x {the shades in use}, plus the bg/border opacity-modifier variants.
 *
 * This test performs a REAL production build (not a source-text scan — the
 * verifier's report explicitly called out that every prior wp-i2 assertion was a
 * source scan and none of them would have caught a build-output regression) and
 * greps the emitted CSS for the exact utility classes the verifier proved missing,
 * plus the full ENTITY_TYPE_CONFIG color/template cross-product so a newly added
 * color or template call site is covered by the same safelist net.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

let builtCss: string;
let outDir: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'wp-i2-tailwind-safelist-'));
  // Real `vite build` into a throwaway directory — exercises the actual
  // @tailwindcss/vite scan-and-compile pipeline, not a source-text proxy for it.
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
  const assetsDir = join(outDir, 'assets');
  const cssFile = readdirSync(assetsDir).find((f) => f.endsWith('.css'));
  expect(cssFile, 'build did not emit a CSS asset').toBeDefined();
  builtCss = readFileSync(join(assetsDir, cssFile!), 'utf8');
}, 120_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

/** The built CSS escapes `/` and other special chars in selectors with `\`. */
function cssHasClass(css: string, className: string): boolean {
  const escaped = className.replace(/[.\/:]/g, (c) => `\\${c}`);
  return css.includes(`.${escaped}`);
}

describe('wp-i2 — Tailwind build-time safelist covers runtime-composed entity-accent classes (blocker #1)', () => {
  // Exact utilities the verifier enumerated as missing from the built stylesheet.
  const verifierReportedMissing = [
    'text-teal-400',
    'text-teal-300',
    'border-l-teal-500',
    'border-teal-500/30',
    'bg-teal-900/40',
    'bg-emerald-900/50',
    'bg-sky-900/50',
    'bg-orange-900/50',
    'bg-cyan-900/50',
    'bg-rose-900/50',
    'bg-yellow-900/50',
    'bg-emerald-500/10',
    'bg-violet-500/10',
    'bg-sky-500/10',
    'bg-orange-500/10',
    'bg-cyan-500/10',
    'bg-rose-500/10',
    'bg-yellow-500/10',
    'bg-slate-500/10',
    'border-violet-700/50',
    'border-sky-700/50',
    'border-orange-700/50',
    'border-cyan-700/50',
    'border-rose-700/50',
    'border-teal-700/50',
    'border-yellow-700/50',
  ];

  it.each(verifierReportedMissing)('emits %s', (cls) => {
    expect(cssHasClass(builtCss, cls), `${cls} is missing from the built stylesheet`).toBe(true);
  });

  // Full ENTITY_TYPE_CONFIG color cross-product (utils/entityUtils.ts), so a color
  // added there in the future is covered by this test without hand-listing it above.
  const entityColors = [
    'amber',
    'emerald',
    'violet',
    'sky',
    'orange',
    'cyan',
    'rose',
    'teal',
    'yellow',
    'slate',
    'blue',
  ];

  it.each(entityColors)('emits the text-%s-400 / text-%s-300 accent pair', (color) => {
    expect(cssHasClass(builtCss, `text-${color}-400`)).toBe(true);
    expect(cssHasClass(builtCss, `text-${color}-300`)).toBe(true);
  });

  it.each(entityColors)('emits the bg-%s-900/50 and border-%s-700/50 badge pair', (color) => {
    expect(cssHasClass(builtCss, `bg-${color}-900/50`)).toBe(true);
    expect(cssHasClass(builtCss, `border-${color}-700/50`)).toBe(true);
  });

  it.each(entityColors)('emits the CommandPalette bg-%s-500/10 + border-%s-500/30 pair', (color) => {
    expect(cssHasClass(builtCss, `bg-${color}-500/10`)).toBe(true);
    expect(cssHasClass(builtCss, `border-${color}-500/30`)).toBe(true);
  });

  it.each(entityColors)('emits the EntityQuickCard border-l-%s-500 accent', (color) => {
    expect(cssHasClass(builtCss, `border-l-${color}-500`)).toBe(true);
  });
});
