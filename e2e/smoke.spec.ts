/**
 * Smoke tests — verifies the app loads and the most basic interactions work.
 *
 * Uses shared helpers from helpers.ts for consistency across all suites.
 */

import { test, expect } from '@playwright/test';
import { gotoFresh, createCampaign, enableMockMode, navigateToView } from './helpers';

// ---------------------------------------------------------------------------
// Suite: Basic app loading
// ---------------------------------------------------------------------------

test.describe('Realmweaver Smoke Tests', () => {
  test('app loads and shows welcome screen on fresh start', async ({ page }) => {
    await gotoFresh(page);

    await expect(page).toHaveTitle(/Campaign Weaver|Realmweaver/i);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/welcome to realmweaver/i)).toBeVisible();
  });

  test('can create a new campaign from the welcome screen', async ({ page }) => {
    await gotoFresh(page);

    await createCampaign(page, {
      title: 'Smoke Test Campaign',
      settingType: 'custom',
      setting: 'A test world.',
    });

    // Sidebar confirms editing state
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside').getByRole('heading', { name: 'Smoke Test Campaign' })).toBeVisible();
  });

  test('mock mode is active by default after campaign loads', async ({ page }) => {
    await gotoFresh(page);

    await createCampaign(page, { title: 'Mock Mode Test' });

    // The toggle has role="switch"; aria-checked="true" means mock ON
    const toggle = page.locator('[role="switch"]').first();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('mock mode toggle switches state', async ({ page }) => {
    await gotoFresh(page);

    await createCampaign(page, { title: 'Toggle Test Campaign' });

    const toggle = page.locator('[role="switch"]').first();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Turn off — use force:true since on mobile the header stacking context
    // can intercept the event on the toggle button
    await toggle.click({ force: true });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Turn back on via helper
    await enableMockMode(page);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('command palette opens with Ctrl+K after campaign loads', async ({ page }) => {
    await gotoFresh(page);

    await createCampaign(page, { title: 'Command Palette Test' });

    await page.keyboard.press('Control+k');

    // Command palette renders as role="dialog"
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Campaign Navigation (requires an active campaign)
// ---------------------------------------------------------------------------

test.describe('Campaign Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);

    await createCampaign(page, {
      title: 'Nav Test Campaign',
      settingType: 'custom',
      setting: 'Navigation test world.',
      dmStyle: 'power',   // power mode ensures all nav items are visible
    });

    await enableMockMode(page);
  });

  test('sidebar navigation to NPCs view works', async ({ page }) => {
    await navigateToView(page, 'NPCs');
    await expect(page.locator('main')).toContainText(/npc|character/i, { timeout: 3000 });
  });

  test('sidebar navigation to Locations view works', async ({ page }) => {
    await navigateToView(page, 'Locations');
    await expect(page.locator('main')).toContainText(/location|place/i, { timeout: 3000 });
  });

  test('sidebar navigation to Adventures view works', async ({ page }) => {
    await navigateToView(page, 'Adventures');
    await expect(page.locator('main')).toContainText(/adventure/i, { timeout: 3000 });
  });

  test('sidebar navigation to Setting Overview works', async ({ page }) => {
    await navigateToView(page, 'Setting Overview');
    await expect(page.locator('main')).toContainText(/campaign setting|setting/i, { timeout: 3000 });
  });
});
