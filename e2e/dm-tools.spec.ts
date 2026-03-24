/**
 * DM Tools tests — Session Weaver (DM Coach), Continuity Checker,
 * Secrets & Clues tracker, and Keyboard Shortcuts help panel.
 *
 * Strategy notes
 * --------------
 * - "Session Weaver" (the DM Coach) is opened via the header button with
 *   aria-label="Toggle Session Weaver". It renders as an aside panel with
 *   the heading "Session Weaver".
 * - "Continuity" opens the ContinuityChecker modal. The header button has
 *   aria-label="Check campaign continuity". The modal has a heading that
 *   matches /continuity/i. Only visible in 'standard' or 'power' dmStyle
 *   (it is hidden in 'guided').
 * - "Secrets & Clues" is a sidebar nav item (visible only in power mode).
 *   Clicking it switches activeView to 'secrets' which renders
 *   <ContentWrapper title="Secrets & Clues"> in main.
 * - Keyboard shortcuts panel opens via `?` keypress (the 'help' shortcut).
 *   It renders in a fixed overlay with heading "Keyboard Shortcuts". Only
 *   visible in 'standard' or 'power' mode.
 * - All campaigns are created with dmStyle 'power' so all features are visible.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('DM Tools', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'DM Tools Campaign',
      settingType: 'custom',
      setting: 'A world of darkness.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // -------------------------------------------------------------------------
  // 1. Session Weaver (DM Coach) opens from the header
  // -------------------------------------------------------------------------

  test('Session Weaver panel opens when header button is clicked', async ({ page }) => {
    const coachBtn = page.locator('header').getByRole('button', { name: /toggle session weaver/i });
    await expect(coachBtn).toBeVisible({ timeout: 5000 });
    await coachBtn.click();

    // The panel is an <aside> containing the heading "Session Weaver"
    await expect(page.getByRole('heading', { name: /session weaver/i })).toBeVisible({ timeout: 5000 });

    // The tool tabs should be visible (Narrate, Improvise, Table, Roleplay)
    // Use exact: true to avoid matching prompt chip buttons that contain "Narrate"
    await expect(page.getByRole('button', { name: 'Narrate', exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: 'Improvise', exact: true })).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'e2e/screenshots/dm-coach-open.png' });
  });

  // -------------------------------------------------------------------------
  // 2. Session Weaver closes when header button is clicked again
  // -------------------------------------------------------------------------

  test('Session Weaver panel closes on second header button click', async ({ page }) => {
    const coachBtn = page.locator('header').getByRole('button', { name: /toggle session weaver/i });
    await expect(coachBtn).toBeVisible({ timeout: 5000 });

    // Open
    await coachBtn.click();
    await expect(page.getByRole('heading', { name: /session weaver/i })).toBeVisible({ timeout: 5000 });

    // Close
    await coachBtn.click();
    await expect(page.getByRole('heading', { name: /session weaver/i })).not.toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 3. Continuity Checker opens from the header
  // -------------------------------------------------------------------------

  test('Continuity Checker modal opens when header button is clicked', async ({ page }) => {
    const continuityBtn = page.locator('header').getByRole('button', { name: /check campaign continuity/i });
    await expect(continuityBtn).toBeVisible({ timeout: 5000 });
    await continuityBtn.click();

    // The ContinuityChecker renders as a modal overlay.
    // It contains a heading with "Continuity" in the text.
    await expect(
      page.getByRole('heading', { name: /continuity/i }).first()
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/continuity-checker-open.png' });
  });

  // -------------------------------------------------------------------------
  // 4. Secrets & Clues view loads from sidebar
  // -------------------------------------------------------------------------

  test('Secrets & Clues view loads when clicked in sidebar', async ({ page }) => {
    await navigateToView(page, 'Secrets & Clues');

    // The ContentWrapper renders a heading containing "Secrets & Clues"
    await expect(
      page.locator('main').getByRole('heading', { name: /secrets.*clues/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // The SecretsTracker should show category filter buttons
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/secrets-tracker-open.png' });
  });

  // -------------------------------------------------------------------------
  // 5. Keyboard shortcuts help panel opens on "?" keypress
  // -------------------------------------------------------------------------

  test('Keyboard Shortcuts panel opens on pressing the ? key', async ({ page }) => {
    // Press the '?' key to trigger the 'help' shortcut action
    await page.keyboard.press('?');

    // The KeyboardShortcutsHelp panel renders with this heading
    await expect(
      page.getByText(/keyboard shortcuts/i).first()
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/keyboard-shortcuts-open.png' });
  });
});
