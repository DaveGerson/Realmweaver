/**
 * wp-i2-build-test-infra — finding #33
 *
 * `Locator.isVisible({ timeout })` is documented by Playwright as
 * "@deprecated This option is ignored. locator.isVisible() does not wait for the
 * element to become visible and returns immediately."
 * (node_modules/playwright-core/types/types.d.ts, Locator.isVisible).
 *
 * e2e/helpers.ts relies on that ignored timeout six times. The worst is
 * `createCampaign`'s `skipWizardBtn.isVisible({ timeout: 500 })`: FirstCampaignWizard
 * auto-opens from a React effect after the campaign transitions to 'editing', so the
 * instant check can lose the race, the fixed full-screen overlay is never dismissed,
 * and every later action in the test is swallowed. The five `{ force: true }` clicks
 * in the same file suppress exactly the actionability errors that would surface this.
 *
 * Contract: helpers must use a genuinely-waiting primitive (`waitFor`,
 * `expect(...).toBeVisible()`, or a `Promise.race` over competing locators) and must
 * not paper over pointer-event interception with `force: true`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const helpersSource = readFileSync(
  fileURLToPath(new URL('../../e2e/helpers.ts', import.meta.url)),
  'utf8'
);

/** Lines of `source` matching `pattern`, rendered as "lineNo: text" for readable failures. */
function matchingLines(source: string, pattern: RegExp): string[] {
  return source
    .split('\n')
    .map((text, i) => ({ text, lineNo: i + 1 }))
    .filter(({ text }) => pattern.test(text))
    .map(({ text, lineNo }) => `${lineNo}: ${text.trim()}`);
}

describe('wp-i2 — e2e/helpers.ts visibility checks (finding #33)', () => {
  it('never passes the ignored `timeout` option to Locator.isVisible', () => {
    expect(matchingLines(helpersSource, /\.isVisible\s*\(\s*\{/)).toEqual([]);
  });

  it('waits for the FirstCampaignWizard overlay instead of probing it instantly', () => {
    const skipWizardRegion = helpersSource.slice(helpersSource.indexOf('Skip wizard'));

    // The dismissal branch must not decide with an instantaneous isVisible() probe —
    // the wizard opens from a React effect and can lose that race.
    expect(matchingLines(skipWizardRegion, /\.isVisible\s*\(/)).toEqual([]);
    // ...and it must be driven by a genuinely-waiting primitive instead.
    expect(skipWizardRegion).toMatch(/waitFor\s*\(|toBeVisible\s*\(|Promise\.race/);
  });

  it('does not use `force: true` clicks to mask pointer-event interception', () => {
    expect(matchingLines(helpersSource, /force:\s*true/)).toEqual([]);
  });
});
