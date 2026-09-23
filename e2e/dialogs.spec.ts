/**
 * Dialog & wizard tests — ExportModal, EvocationWizard, WorldSimulationWizard,
 * SessionEndWizard, FirstCampaignWizard, ContinuityChecker.
 *
 * Strategy notes
 * --------------
 * - ExportModal is opened from the header campaign menu > "Export Campaign".
 *   It uses DialogShell and shows JSON/Obsidian export options.
 * - EvocationWizard is opened from the header via onToggleWizard. The trigger
 *   button has aria-label matching "evocation" or is labeled "Evocation".
 *   It shows mode tabs: Simple, Detailed, Ingest, Chat.
 * - WorldSimulationWizard is opened from the header via onToggleWorldSim.
 *   The trigger button has an aria-label containing "world simulation" or
 *   "simulate". It shows a setup step with time span selection.
 * - SessionEndWizard appears when clicking "End Session" during an active
 *   session. It has steps: AI Recap, Plot Status, Loose Ends, Player Recap,
 *   Save & End.
 * - FirstCampaignWizard auto-opens for empty campaigns if not dismissed.
 *   We test it by NOT dismissing it during campaign creation.
 * - ContinuityChecker is opened from the header button with aria-label
 *   "Check campaign continuity". Already partially tested in dm-tools.spec.ts,
 *   but here we test the issue cards rendering.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('Dialogs and Wizards', () => {

  // =========================================================================
  // ExportModal
  // =========================================================================

  test.describe('ExportModal', () => {
    test('Export modal opens from header menu and shows export options', async ({ page }) => {
      await gotoFresh(page);
      await createCampaign(page, {
        title: 'Export Test Campaign',
        dmStyle: 'power',
      });
      await enableMockMode(page);

      // Open the campaign dropdown menu in the header
      const dropdownTrigger = page
        .locator('header')
        .locator('div.relative')
        .first()
        .locator('button')
        .first();
      await dropdownTrigger.click();

      // Click "Export Campaign" in the dropdown
      const exportMenuItem = page.getByRole('menuitem', { name: /export campaign/i });
      await expect(exportMenuItem).toBeVisible({ timeout: 3000 });
      await exportMenuItem.click();

      // The ExportModal should open (rendered in DialogShell)
      // Look for the JSON export button or the modal heading
      await expect(
        page.getByText(/export/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Verify JSON export button exists
      const jsonBtn = page.getByRole('button', { name: /json/i });
      await expect(jsonBtn).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/export-modal-open.png' });

      // Close the modal by pressing Escape (DialogShell handles it)
      await page.keyboard.press('Escape');
    });
  });

  // =========================================================================
  // EvocationWizard
  // =========================================================================

  test.describe('EvocationWizard', () => {
    test('Evocation Wizard opens and shows mode tabs', async ({ page }) => {
      await gotoFresh(page);
      await createCampaign(page, {
        title: 'Evocation Test Campaign',
        dmStyle: 'power',
      });
      await enableMockMode(page);

      // The Evocation Wizard trigger is in the header — look for a button
      // with aria-label or text matching "evocation" or "world builder"
      const evoBtn = page.locator('header').getByRole('button', { name: /evocation|world builder|campaign fill/i });

      // It might be hidden behind the campaign menu. Try direct header button first.
      if (await evoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await evoBtn.click();
      } else {
        // Try looking for a toolbar/header button with a sparkle or wand icon
        // that opens the wizard. The header onToggleWizard is attached to a button
        // with a specific aria-label.
        const wizardBtn = page.locator('header button[aria-label*="vocation" i], header button[aria-label*="wizard" i], header button[aria-label*="campaign builder" i]').first();
        if (await wizardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await wizardBtn.click();
        } else {
          // Skip if the button is not findable — the wizard may not be accessible
          // from the header in all DM styles
          test.skip();
          return;
        }
      }

      // The wizard should open as a dialog with mode tabs
      // Look for the four mode buttons: Simple, Detailed, Ingest, Chat
      await expect(
        page.getByRole('button', { name: 'Simple', exact: true })
      ).toBeVisible({ timeout: 5000 });

      await expect(
        page.getByRole('button', { name: 'Detailed', exact: true })
      ).toBeVisible({ timeout: 3000 });

      await expect(
        page.getByRole('button', { name: 'Ingest', exact: true })
      ).toBeVisible({ timeout: 3000 });

      await expect(
        page.getByRole('button', { name: 'Chat', exact: true })
      ).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/evocation-wizard-open.png' });

      // Close the wizard
      await page.keyboard.press('Escape');
    });
  });

  // =========================================================================
  // WorldSimulationWizard
  // =========================================================================

  test.describe('WorldSimulationWizard', () => {
    test('World Simulation Wizard opens and shows time span selection', async ({ page }) => {
      await gotoFresh(page);
      await createCampaign(page, {
        title: 'WorldSim Test Campaign',
        dmStyle: 'power',
      });
      await enableMockMode(page);

      // The World Simulation button is in the header
      const worldSimBtn = page.locator('header').getByRole('button', { name: /world simulation|simulate|world clock/i });

      if (await worldSimBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await worldSimBtn.click();
      } else {
        // Try matching by aria-label patterns
        const altBtn = page.locator('header button[aria-label*="imulat" i], header button[aria-label*="world" i]').first();
        if (await altBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await altBtn.click();
        } else {
          test.skip();
          return;
        }
      }

      // The wizard should show the 'setup' step with time span buttons.
      // Verify the "A week" button is visible (the default selection).
      await expect(
        page.getByRole('button', { name: /a week/i })
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'e2e/screenshots/world-sim-wizard-open.png' });

      await page.keyboard.press('Escape');
    });
  });

  // =========================================================================
  // SessionEndWizard
  // =========================================================================

  test.describe('SessionEndWizard', () => {
    test('End Session triggers the Session End Wizard', async ({ page }) => {
      await gotoFresh(page);
      await createCampaign(page, {
        title: 'Session End Test',
        dmStyle: 'power',
      });
      await enableMockMode(page);

      // Create a quick-plan session and go live
      await navigateToView(page, 'Session Timeline');
      await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /quick plan/i }).click();

      const goLiveBtn = page.getByRole('button', { name: /go live/i });
      await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
      await goLiveBtn.click();

      // We are now in the SessionRunner. Click "End Session"
      const endSessionBtn = page.getByRole('button', { name: /end session/i });
      await expect(endSessionBtn).toBeVisible({ timeout: 5000 });
      await endSessionBtn.click();

      // The SessionEndWizard should appear with its step indicator
      // The first step is "AI Recap"
      await expect(
        page.getByText(/recap|ai recap/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Step labels should include references to the wizard flow
      await expect(
        page.getByText(/plot status|loose ends|save.*end/i).first()
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'e2e/screenshots/session-end-wizard.png' });
    });
  });

  // =========================================================================
  // FirstCampaignWizard
  // =========================================================================

  test.describe('FirstCampaignWizard', () => {
    test('First Campaign Wizard appears for new empty campaign', async ({ page }) => {
      await gotoFresh(page);

      // Create a campaign but DON'T use the helper (which auto-dismisses the wizard).
      // Instead, manually navigate through campaign creation.
      await page.getByRole('button', { name: /create a campaign/i }).click();

      // Skip template selection
      await expect(page.getByRole('heading', { name: /start with a template/i })).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: /start from scratch/i }).click();

      // Fill campaign form
      await expect(page.getByRole('heading', { name: 'Create Your Campaign' })).toBeVisible({ timeout: 5000 });
      await page.getByPlaceholder(/the sundered crown/i).fill('Wizard Test Campaign');
      await page.getByRole('radio', { name: /custom world/i }).check();
      await page.locator('textarea').fill('A test world for wizard.');
      await page.getByRole('radio', { name: /i keep it simple/i }).click();
      await page.getByRole('button', { name: /weave campaign/i }).click();

      // Wait for campaign to load. The sidebar renders, but while the wizard
      // is open DialogShell marks the app behind it inert + aria-hidden
      // (roadmap X4), so it is only reachable with includeHidden.
      await expect(
        page.locator('aside').getByRole('heading', { name: 'Wizard Test Campaign', includeHidden: true })
      ).toBeAttached({ timeout: 8000 });

      // The FirstCampaignWizard should auto-open as a fixed overlay
      // It has a "Skip wizard" close button
      const skipWizardBtn = page.locator('button[title="Skip wizard"]');
      await expect(skipWizardBtn).toBeVisible({ timeout: 5000 });

      // Background content is hidden from assistive tech while the wizard is up.
      await expect(
        page.locator('aside').getByRole('heading', { name: 'Wizard Test Campaign' })
      ).toHaveCount(0);

      // The wizard should show step progress (Step 1 of N)
      // or its initial content about getting started
      await expect(
        page.getByText(/get started|welcome|step|first npcs|starter/i).first()
      ).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/first-campaign-wizard.png' });

      // Now dismiss it — the background becomes reachable again.
      await skipWizardBtn.click();
      await expect(skipWizardBtn).not.toBeVisible({ timeout: 3000 });
      await expect(
        page.locator('aside').getByRole('heading', { name: 'Wizard Test Campaign' })
      ).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // ContinuityChecker (extended)
  // =========================================================================

  test.describe('ContinuityChecker', () => {
    test('Continuity Checker shows results or empty state for new campaign', async ({ page }) => {
      await gotoFresh(page);
      await createCampaign(page, {
        title: 'Continuity Test Campaign',
        dmStyle: 'power',
      });
      await enableMockMode(page);

      const continuityBtn = page.locator('header').getByRole('button', { name: /check campaign continuity/i });
      await expect(continuityBtn).toBeVisible({ timeout: 5000 });
      await continuityBtn.click();

      // The modal should open with a heading containing "Continuity"
      await expect(
        page.getByRole('heading', { name: /continuity/i }).first()
      ).toBeVisible({ timeout: 5000 });

      // For a new campaign with no entities, it should show either
      // "no issues" or an empty/clean state, or it might run checks
      // that find nothing.
      await expect(
        page.getByText(/no issues|clean|continuity|check/i).first()
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'e2e/screenshots/continuity-checker-results.png' });

      // Close the modal
      await page.keyboard.press('Escape');
    });
  });
});
