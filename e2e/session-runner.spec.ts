/**
 * Session runner tests — session prep wizard, active session runner workflow.
 *
 * Strategy notes
 * --------------
 * - The Session Manager is reached via "Session Timeline" in the sidebar.
 * - The "Prepare Session" button opens the SessionPrepWizard modal. It is
 *   disabled when a session is already live.
 * - To get into the active SessionRunner we call "Go Live" which calls
 *   campaignService.goLive(). The prep wizard routes through this after
 *   its final "Go Live" step (review). Alternatively we can click "Quick Plan"
 *   to create a session and then click "Go Live" on the card in the dashboard.
 * - The SessionRunner note input is a MentionInput rendered as a textarea-like
 *   element with placeholder "Add a quick note...". The submit button is "Add".
 * - Beats input is a plain <input> with placeholder "Add a beat..." in the
 *   left column of the runner.
 * - The runner has the session title in a heading inside the runner header.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('Session Runner', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Session Campaign',
      settingType: 'custom',
      setting: 'A world of mystery.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // -------------------------------------------------------------------------
  // 1. Session Prep Wizard opens
  // -------------------------------------------------------------------------

  test('Prepare Session button opens the Session Prep Wizard', async ({ page }) => {
    await navigateToView(page, 'Session Timeline');

    // Wait for the Session Manager heading
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    // Click "Prepare Session"
    const prepBtn = page.getByRole('button', { name: /prepare session/i });
    await expect(prepBtn).toBeVisible({ timeout: 5000 });
    await prepBtn.click();

    // The wizard modal should appear with its heading
    await expect(page.getByRole('heading', { name: /session prep wizard/i })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/session-prep-wizard-open.png' });
  });

  // -------------------------------------------------------------------------
  // 2. Session Prep Wizard can be dismissed
  // -------------------------------------------------------------------------

  test('Session Prep Wizard can be closed without starting a session', async ({ page }) => {
    await navigateToView(page, 'Session Timeline');
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /prepare session/i }).click();
    await expect(page.getByRole('heading', { name: /session prep wizard/i })).toBeVisible({ timeout: 5000 });

    // The wizard close button is a plain <button> in the modal header next to
    // the "Session Prep Wizard" heading. There is no aria-label, but it is the
    // last button in the header div. We find it relative to the heading.
    // Alternatively, click the modal header's close button using a positional
    // locator — the button appears after the heading in the header row.
    const wizardHeading = page.getByRole('heading', { name: /session prep wizard/i });
    // The close button is in the same header flex container. It follows the icon+heading div.
    const wizardCloseBtn = wizardHeading.locator('xpath=../..//button[last()]');
    await wizardCloseBtn.click({ force: true });

    // After closing, we should be back at the session manager (no wizard heading)
    await expect(page.getByRole('heading', { name: /session prep wizard/i })).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 3. Running log accepts notes in active session
  // -------------------------------------------------------------------------

  test('active session accepts notes and they appear in the running log', async ({ page }) => {
    // Step 1: Create a quick-plan session
    await navigateToView(page, 'Session Timeline');
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    // Quick Plan creates a default session and opens the editor
    await page.getByRole('button', { name: /quick plan/i }).click();

    // The session log editor should open. Wait for the "Go Live" button.
    const goLiveBtn = page.getByRole('button', { name: /go live/i });
    await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
    await goLiveBtn.click();

    // We are now in the SessionRunner view. It has an "End Session" button in its header.
    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 5000 });

    // Find the note input by its placeholder text and type a note.
    // The note input is a MentionInput (textarea) with aria-label="Session note input".
    // Submit via Enter key (onEnterSubmit) to avoid FAB interception issues.
    const noteInput = page.getByLabel(/session note input/i);
    await expect(noteInput).toBeVisible({ timeout: 5000 });
    await noteInput.click();
    await noteInput.fill('Party enters the tavern');
    await noteInput.press('Enter');

    // The note should appear in the running log section
    await expect(page.getByText('Party enters the tavern')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/session-runner-note-added.png' });
  });

  // -------------------------------------------------------------------------
  // 4. Beats can be added in an active session
  // -------------------------------------------------------------------------

  test('beats can be added and appear in the beats list', async ({ page }) => {
    // Create and go live with a session
    await navigateToView(page, 'Session Timeline');
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /quick plan/i }).click();

    const goLiveBtn = page.getByRole('button', { name: /go live/i });
    await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
    await goLiveBtn.click();

    // Wait for the SessionRunner to load
    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 5000 });

    // Find the beat input by its placeholder
    const beatInput = page.getByPlaceholder(/add a beat/i);
    await expect(beatInput).toBeVisible({ timeout: 5000 });
    await beatInput.fill('The assassination plot is revealed');
    await beatInput.press('Enter');

    // The beat should appear in the beats list
    await expect(page.getByText('The assassination plot is revealed')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/session-runner-beat-added.png' });
  });
});
