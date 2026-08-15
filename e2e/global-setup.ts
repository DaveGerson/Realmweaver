import type { FullConfig } from '@playwright/test';

/**
 * Guards against finding #85's second failure scenario: with
 * `reuseExistingServer: !process.env.CI`, Playwright's webServer readiness
 * probe only checks that *something* answers 200 on the target port — it
 * happily reuses a stale Realmweaver dev server left running from an earlier
 * session, or an unrelated service that happens to be bound to 4200. Either
 * way `npm run test:e2e` would silently validate the wrong app/code.
 *
 * This runs once, after Playwright's webServer has confirmed *a* response,
 * and asserts the response really is Realmweaver before any spec executes.
 * It only guards the local dev path (`reuseExistingServer: true`) — CI
 * always launches a fresh server (`reuseExistingServer: false`), so this is
 * a no-op safety net there, not a redundant check.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://127.0.0.1:4200';

  const res = await fetch(baseURL);
  if (!res.ok) {
    throw new Error(
      `e2e/global-setup: GET ${baseURL} returned ${res.status}. Is the Realmweaver dev server up?`
    );
  }

  const html = await res.text();
  if (!html.includes('<title>RealmWeaver</title>')) {
    throw new Error(
      `e2e/global-setup: the server at ${baseURL} is not serving Realmweaver ` +
        `(missing "<title>RealmWeaver</title>"). A stale or unrelated process is ` +
        `likely already bound to this port — stop it and rerun "npm run test:e2e".`
    );
  }
}
