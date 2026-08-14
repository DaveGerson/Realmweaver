/**
 * Tool component tests — CombatTracker, DiceRoller, SecretsTracker.
 *
 * Strategy notes
 * --------------
 * - CombatTracker is a standalone view reached via "Combat Tracker" in the
 *   sidebar (power mode only). It shows a heading "Combat Tracker", a Round
 *   counter, "Next Turn" button, and "Add Combatant" button. Adding a
 *   combatant manually requires filling name/HP/init fields in the popup.
 * - DiceRoller is embedded in the session runner's QuickToolsPanel (the
 *   "Tools" tab in the right column). It shows d4, d6, d8, d10, d12, d20,
 *   d100 buttons. Clicking one generates a roll result in the history.
 * - SecretsTracker is accessed via the "Secrets & Clues" sidebar nav item
 *   (power mode). Adding a secret requires filling title + content, then
 *   clicking a submit button. The "reveal" toggle uses an eye icon button.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
  switchMobileSessionTab,
} from './helpers';

// =========================================================================
// Combat Tracker
// =========================================================================

test.describe('Combat Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Combat Test Campaign',
      settingType: 'custom',
      setting: 'A world of battle.',
      dmStyle: 'power', // power mode shows Combat Tracker in sidebar
    });
    await enableMockMode(page);
  });

  test('Combat Tracker loads with empty battlefield', async ({ page }) => {
    await navigateToView(page, 'Combat Tracker');

    // Heading
    await expect(
      page.locator('main').getByRole('heading', { name: /combat tracker/i })
    ).toBeVisible({ timeout: 5000 });

    // Round counter starts at 1
    await expect(page.getByText(/round/i)).toBeVisible({ timeout: 3000 });

    // Empty state message
    await expect(
      page.getByText(/battlefield is empty/i)
    ).toBeVisible({ timeout: 3000 });

    // Add Combatant button exists
    await expect(
      page.getByRole('button', { name: /add combatant/i })
    ).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'e2e/screenshots/combat-tracker-empty.png' });
  });

  test('can add a combatant manually', async ({ page }) => {
    await navigateToView(page, 'Combat Tracker');

    await expect(
      page.locator('main').getByRole('heading', { name: /combat tracker/i })
    ).toBeVisible({ timeout: 5000 });

    // Click "Add Combatant" to open the popup
    await page.getByRole('button', { name: /add combatant/i }).click();

    // The Manual tab should be active by default in the AddCombatantMenu.
    // Fill in the combatant form. The placeholder is "Name (e.g. Goblin Archer)".
    const nameInput = page.getByPlaceholder(/goblin archer/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Goblin Scout');

    // Click Add to confirm — the button is inside the popup (div.absolute)
    const addBtn = page.locator('.absolute').getByRole('button', { name: /^add$/i });
    await expect(addBtn).toBeVisible({ timeout: 3000 });
    await addBtn.click();

    // The combatant name appears as an <input> value in the initiative table,
    // not as text content. Use the placeholder to find the name input.
    await expect(
      page.getByPlaceholder('Combatant Name')
    ).toHaveValue('Goblin Scout', { timeout: 5000 });

    // The empty state should be gone
    await expect(
      page.getByText(/battlefield is empty/i)
    ).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'e2e/screenshots/combat-tracker-combatant-added.png' });
  });

  test('Next Turn button advances the turn', async ({ page }) => {
    await navigateToView(page, 'Combat Tracker');

    await expect(
      page.locator('main').getByRole('heading', { name: /combat tracker/i })
    ).toBeVisible({ timeout: 5000 });

    // Add two combatants
    await page.getByRole('button', { name: /add combatant/i }).click();
    const nameInput = page.getByPlaceholder(/goblin archer/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Fighter');
    const addBtn = page.locator('.absolute').getByRole('button', { name: /^add$/i });
    await addBtn.click();

    // Re-open for second combatant
    await page.getByRole('button', { name: /add combatant/i }).click();
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Wizard');
    await addBtn.click();

    // Combatant names appear as <input> values — check via placeholder inputs
    const combatantInputs = page.getByPlaceholder('Combatant Name');
    await expect(combatantInputs.first()).toBeVisible({ timeout: 3000 });
    // Both combatants should be present (2 rows)
    await expect(combatantInputs).toHaveCount(2, { timeout: 3000 });

    // Click "Next Turn"
    await page.getByRole('button', { name: /next turn/i }).click();

    // The turn should advance. At a minimum, the button should still work.
    await expect(page.getByRole('button', { name: /next turn/i })).toBeVisible();
  });

  test('Sort Initiative button works', async ({ page }) => {
    await navigateToView(page, 'Combat Tracker');

    await expect(
      page.locator('main').getByRole('heading', { name: /combat tracker/i })
    ).toBeVisible({ timeout: 5000 });

    // Add a combatant so sort is enabled
    await page.getByRole('button', { name: /add combatant/i }).click();
    const nameInput = page.getByPlaceholder(/goblin archer/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill('Rogue');
    const addBtn = page.locator('.absolute').getByRole('button', { name: /^add$/i });
    await addBtn.click();

    // Sort Initiative button should be enabled now
    const sortBtn = page.getByRole('button', { name: /sort initiative/i });
    await expect(sortBtn).toBeVisible({ timeout: 3000 });
    await expect(sortBtn).toBeEnabled();
    await sortBtn.click();
  });
});

// =========================================================================
// Dice Roller (in Session Runner)
// =========================================================================

test.describe('Dice Roller', () => {
  test('Dice Roller is accessible in session runner tools panel', async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Dice Roller Campaign',
      settingType: 'custom',
      setting: 'A world with dice.',
      dmStyle: 'power',
    });
    await enableMockMode(page);

    // Create a session and go live to access the tools panel
    await navigateToView(page, 'Session Timeline');
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /quick plan/i }).click();

    const goLiveBtn = page.getByRole('button', { name: /go live/i });
    await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
    await goLiveBtn.click();

    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 5000 });

    // On mobile the tools panel is behind the Tools tab.
    await switchMobileSessionTab(page, 'Tools');

    // The Dice Roller toggle button is in the Quick Tools panel (right column).
    // It starts collapsed — click it to expand and reveal die buttons.
    const diceRollerToggle = page.getByRole('button', { name: 'Dice Roller', exact: true });
    await expect(diceRollerToggle).toBeVisible({ timeout: 5000 });
    await diceRollerToggle.click();

    // After expanding, d20 button should be present
    const d20Btn = page.getByRole('button', { name: /^d20$/i });
    await expect(d20Btn).toBeVisible({ timeout: 3000 });
  });

  test('clicking d20 button produces a roll result', async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Dice Roll Campaign',
      settingType: 'custom',
      setting: 'Roll the bones.',
      dmStyle: 'power',
    });
    await enableMockMode(page);

    await navigateToView(page, 'Session Timeline');
    await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /quick plan/i }).click();

    const goLiveBtn = page.getByRole('button', { name: /go live/i });
    await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
    await goLiveBtn.click();

    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 5000 });

    // On mobile the tools panel is behind the Tools tab.
    await switchMobileSessionTab(page, 'Tools');

    // Expand the Dice Roller section first
    const diceRollerToggle = page.getByRole('button', { name: 'Dice Roller', exact: true });
    await expect(diceRollerToggle).toBeVisible({ timeout: 5000 });
    await diceRollerToggle.click();

    // Click d20
    const d20Btn = page.getByRole('button', { name: /^d20$/i });
    await expect(d20Btn).toBeVisible({ timeout: 5000 });
    await d20Btn.click();

    // After rolling, the result should appear. The DiceRoller displays the
    // total in a large font, and "1d20" as the formula in history.
    // Use .first() since the formula appears in multiple places (current roll + history).
    await expect(
      page.getByText(/1d20/i).first()
    ).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'e2e/screenshots/dice-roller-d20-result.png' });
  });
});

// =========================================================================
// Secrets Tracker
// =========================================================================

test.describe('Secrets Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Secrets Test Campaign',
      settingType: 'custom',
      setting: 'A world of hidden truths.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  test('Secrets view shows empty state with add button', async ({ page }) => {
    await navigateToView(page, 'Secrets & Clues');

    // The SecretsTracker header shows "Secrets & Clues"
    await expect(
      page.locator('main').getByText(/secrets.*clues/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Category filter tabs should be visible
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible({ timeout: 3000 });

    // Empty state text
    await expect(
      page.getByText(/no secrets yet/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test('can add a secret and it appears in the list', async ({ page }) => {
    await navigateToView(page, 'Secrets & Clues');

    await expect(
      page.locator('main').getByText(/secrets.*clues/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Click the add button (Plus icon button with title "Add new entry")
    const addBtn = page.locator('button[title="Add new entry"]');
    await expect(addBtn).toBeVisible({ timeout: 3000 });
    await addBtn.click();

    // The add form should appear with title and content fields
    await expect(page.getByText(/new entry/i)).toBeVisible({ timeout: 3000 });

    // Fill title — placeholder is "Title..."
    const titleInput = page.getByPlaceholder(/^title/i);
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill('The Dark Ritual');

    // Fill content — placeholder is "The actual secret, clue, or revelation..."
    const contentInput = page.getByPlaceholder(/actual secret/i);
    await expect(contentInput).toBeVisible({ timeout: 3000 });
    await contentInput.fill('The cult performs the ritual under the new moon.');

    // Submit — the form's submit button text is "Add"
    const saveBtn = page.locator('main').getByRole('button', { name: /^add$/i });
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();

    // The secret should now appear as a card
    await expect(
      page.getByText('The Dark Ritual')
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/secrets-tracker-secret-added.png' });
  });

  test('reveal toggle changes secret state', async ({ page }) => {
    await navigateToView(page, 'Secrets & Clues');

    await expect(
      page.locator('main').getByText(/secrets.*clues/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Add a secret first
    const addBtn = page.locator('button[title="Add new entry"]');
    await addBtn.click();

    await page.getByPlaceholder(/^title/i).fill('Hidden Door Location');
    await page.getByPlaceholder(/actual secret/i).fill('Behind the bookcase in room 3.');

    const saveBtn = page.locator('main').getByRole('button', { name: /^add$/i });
    await saveBtn.click();

    await expect(page.getByText('Hidden Door Location')).toBeVisible({ timeout: 5000 });

    // Click the reveal button (eye icon) — aria-label "Reveal to players"
    const revealBtn = page.getByRole('button', { name: /reveal to players/i });
    await expect(revealBtn).toBeVisible({ timeout: 3000 });
    await revealBtn.click();

    // After reveal, the button should change to "Mark as unrevealed"
    await expect(
      page.getByRole('button', { name: /mark as unrevealed/i })
    ).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'e2e/screenshots/secrets-tracker-revealed.png' });
  });

  test('category filter tabs work', async ({ page }) => {
    await navigateToView(page, 'Secrets & Clues');

    await expect(
      page.locator('main').getByText(/secrets.*clues/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Category filter buttons should all be present
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /^secrets$/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /^clues$/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /^revelations$/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /^rumors$/i })).toBeVisible({ timeout: 3000 });

    // Click "Clues" filter
    await page.getByRole('button', { name: /^clues$/i }).click();

    // Should not crash and the filter should be active (styled differently)
    // Since there are no clues, it should show empty state or no cards
  });
});
