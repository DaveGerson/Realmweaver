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

/**
 * wp-i2-build-test-infra — verifier round 2, minor #7
 *
 * The #33 fix converted every `isVisible({timeout})` instant-probe into a genuinely
 * waiting `isVisibleWithin`, which is correct, but `createCampaign` then probed its
 * two pairs of mutually-exclusive locators (templateSelectHeading/creatorHeading,
 * createFirstBtn/selectorCreateBtn) SERIALLY — so the common case (already on one of
 * the two screens) pays up to 2x the per-candidate timeout before proceeding, adding
 * real wall-clock to every spec that calls createCampaign across two Playwright
 * projects in CI. Fix: race the mutually-exclusive candidates concurrently via a
 * `raceVisible` helper so the winning candidate settles the check immediately.
 */
describe('wp-i2 — createCampaign races mutually-exclusive locators (minor #7)', () => {
  it('defines a race-based visibility helper', () => {
    expect(helpersSource).toMatch(/function raceVisible\s*\(/);
    // Must wait concurrently (all candidates start together), not serially.
    expect(helpersSource).toMatch(/raceVisible[\s\S]*?forEach/);
  });

  it('routes the template-select vs creator-form screen check through raceVisible', () => {
    const createCampaignSource = helpersSource.slice(
      helpersSource.indexOf('export async function createCampaign'),
      helpersSource.indexOf('export async function createCampaign') + 2500
    );

    expect(createCampaignSource).toMatch(/raceVisible\(\[\s*\{\s*locator:\s*templateSelectHeading/);
  });

  it('routes the welcome-screen vs cross-campaign-dashboard entry point check through raceVisible', () => {
    const createCampaignSource = helpersSource.slice(
      helpersSource.indexOf('export async function createCampaign'),
      helpersSource.indexOf('export async function createCampaign') + 2500
    );

    expect(createCampaignSource).toMatch(/raceVisible\(\[\s*\{\s*locator:\s*createFirstBtn/);
  });

  it('no longer serially awaits both mutually-exclusive candidates with isVisibleWithin', () => {
    // The two removed serial-probe pairs must not reappear.
    expect(helpersSource).not.toMatch(
      /isVisibleWithin\(templateSelectHeading[\s\S]{0,200}isVisibleWithin\(creatorHeading/
    );
    expect(helpersSource).not.toMatch(
      /isVisibleWithin\(createFirstBtn[\s\S]{0,200}isVisibleWithin\(selectorCreateBtn/
    );
  });
});

/**
 * wp-i2-build-test-infra — verifier round 2, minor #6
 *
 * `reuseExistingServer: !process.env.CI` in playwright.config.ts means a stale (or
 * unrelated) server already bound to the target port is silently reused locally.
 * Fix: e2e/global-setup.ts asserts the served page really is Realmweaver before any
 * spec runs.
 */
describe('wp-i2 — global setup guards against a stale/foreign dev server (minor #6)', () => {
  it('playwright.config.ts wires up a globalSetup script', () => {
    const playwrightConfig = readFileSync(
      fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)),
      'utf8'
    );
    expect(playwrightConfig).toMatch(/globalSetup:\s*['"]\.\/e2e\/global-setup(\.ts)?['"]/);
  });

  it('global-setup.ts asserts the RealmWeaver title marker before letting specs run', () => {
    const globalSetupSource = readFileSync(
      fileURLToPath(new URL('../../e2e/global-setup.ts', import.meta.url)),
      'utf8'
    );
    expect(globalSetupSource).toContain('<title>RealmWeaver</title>');
    // Must actually fetch the live server rather than just reading source text.
    expect(globalSetupSource).toMatch(/fetch\(/);
  });
});
