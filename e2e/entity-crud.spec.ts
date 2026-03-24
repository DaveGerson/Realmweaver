/**
 * Entity CRUD tests — creation, editing, and deletion for the major entity
 * types: NPC, Location, Faction, and Adventure.
 *
 * Strategy notes
 * --------------
 * - All dashboards default to "Create via Chat" mode. The form-based
 *   generators are faster and more predictable for automation because the
 *   mock returns a deterministic payload immediately after one click. We
 *   always switch to "Switch to form" first.
 * - After entity generation the app auto-navigates to the entity editor, so
 *   every "appears in list" test navigates back to the dashboard view before
 *   asserting the card count.
 * - Entity names appear in multiple places (sidebar breadcrumb, editor title,
 *   list card). All name assertions are scoped to `main` so we avoid strict-
 *   mode violations from sidebar duplicates.
 * - The NPC name input has no `for`/`htmlFor` association. We locate it with
 *   `locator('input[name="name"]')`.
 * - Delete triggers window.confirm — Playwright accepts it automatically.
 * - Mock names returned by the mock service:
 *     NPC       → "Mocked Bjorn Ironhand"
 *     Location  → "The Mocked Whispering Falls"
 *     Faction   → "The Mocked Silent Hand"
 *     Adventure → "The Mock Adventure"
 */

import { test, expect, type Page } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

// ---------------------------------------------------------------------------
// Shared setup — a fresh campaign with mock mode ON before every test
// ---------------------------------------------------------------------------

test.describe('Entity CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Entity CRUD Campaign',
      settingType: 'custom',
      setting: 'A dark fantasy world.',
      dmStyle: 'power', // power mode shows all sidebar items
    });
    await enableMockMode(page);
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Switch a dashboard from the default "Create via Chat" mode to the form
   * (quick-generate) mode.
   */
  async function switchToFormMode(page: Page): Promise<void> {
    const switchBtn = page.getByRole('button', { name: /switch to form/i });
    await expect(switchBtn).toBeVisible({ timeout: 5000 });
    await switchBtn.click();
  }

  /**
   * Fill the quick-generate textarea and click the generate button.
   * All form generators use a plain <textarea> as their prompt field.
   */
  async function quickGenerate(
    page: Page,
    prompt: string,
    generateBtnPattern: RegExp
  ): Promise<void> {
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(prompt);

    const generateBtn = page.getByRole('button', { name: generateBtnPattern });
    await expect(generateBtn).toBeVisible({ timeout: 3000 });
    await generateBtn.click();
  }

  // -------------------------------------------------------------------------
  // 1. Generate NPC in mock mode
  // -------------------------------------------------------------------------

  test('generate NPC appears in the dashboard list', async ({ page }) => {
    await navigateToView(page, 'NPCs');
    await switchToFormMode(page);
    await quickGenerate(page, 'A gruff dwarven blacksmith', /generate npc/i);

    // After generation the app auto-navigates to the NPC editor.
    // The editor heading contains the NPC name in main content.
    // Scope to main to avoid collisions with sidebar breadcrumb text.
    await expect(
      page.locator('main').getByText('Mocked Bjorn Ironhand').first()
    ).toBeVisible({ timeout: 5000 });

    // Navigate back to the NPCs list to confirm the card appears
    await navigateToView(page, 'NPCs');
    await expect(page.getByText(/existing npcs \(1\)/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('main').getByText('Mocked Bjorn Ironhand')
    ).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 2. Edit NPC name
  // -------------------------------------------------------------------------

  test('edit NPC name persists after blur', async ({ page }) => {
    await navigateToView(page, 'NPCs');
    await switchToFormMode(page);
    await quickGenerate(page, 'A gruff dwarven blacksmith', /generate npc/i);

    // After generation the editor is already open. Find the name input by
    // its `name` attribute (the label has no htmlFor linkage).
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Mocked Bjorn Ironhand');

    // Edit and blur to trigger onBlur → onUpdate
    await nameInput.fill('Bjorn Steelbeard');
    await nameInput.press('Tab'); // triggers onBlur

    // Navigate to the NPC list to confirm the updated name appears on the card
    await navigateToView(page, 'NPCs');
    await expect(
      page.locator('main').getByText('Bjorn Steelbeard')
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 3. Delete NPC
  // -------------------------------------------------------------------------

  test('delete NPC removes it from the dashboard list', async ({ page }) => {
    await navigateToView(page, 'NPCs');
    await switchToFormMode(page);
    await quickGenerate(page, 'A guard with a secret', /generate npc/i);

    // Editor is already open after generation. Playwright auto-accepts dialogs.
    page.on('dialog', (dialog) => dialog.accept());

    const deleteBtn = page.getByRole('button', { name: /delete npc/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // After deletion the app navigates back to the NPCs dashboard (count = 0)
    await expect(
      page.getByText(/existing npcs \(0\)/i)
    ).toBeVisible({ timeout: 5000 });

    // The entity list card should be gone (empty state shown instead)
    await expect(
      page.locator('main').getByText(/every great story needs its cast/i)
    ).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 4. Generate Location
  // -------------------------------------------------------------------------

  test('generate Location appears in the dashboard list', async ({ page }) => {
    await navigateToView(page, 'Locations');
    await switchToFormMode(page);
    await quickGenerate(page, 'A haunted cave near the river', /generate location/i);

    // Editor auto-opens — confirm name is visible in main content
    await expect(
      page.locator('main').getByText('The Mocked Whispering Falls').first()
    ).toBeVisible({ timeout: 5000 });

    // Navigate back to the list
    await navigateToView(page, 'Locations');
    await expect(page.getByText(/existing locations \(1\)/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('main').getByText('The Mocked Whispering Falls')
    ).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 5. Generate Faction
  // -------------------------------------------------------------------------

  test('generate Faction appears in the dashboard list', async ({ page }) => {
    await navigateToView(page, 'Factions');
    await switchToFormMode(page);
    await quickGenerate(page, 'A shadowy thieves guild', /generate faction/i);

    await expect(
      page.locator('main').getByText('The Mocked Silent Hand').first()
    ).toBeVisible({ timeout: 5000 });

    await navigateToView(page, 'Factions');
    await expect(page.getByText(/existing factions \(1\)/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('main').getByText('The Mocked Silent Hand')
    ).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 6. Generate Adventure
  // -------------------------------------------------------------------------

  test('generate Adventure appears in the dashboard list', async ({ page }) => {
    await navigateToView(page, 'Adventures');
    await switchToFormMode(page);
    await quickGenerate(
      page,
      'A dungeon crawl to rescue a kidnapped noble',
      /generate adventure/i
    );

    // Editor auto-opens — confirm the adventure title appears in main content
    await expect(
      page.locator('main').getByText(/the mock adventure/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Navigate back to the list
    await navigateToView(page, 'Adventures');
    await expect(
      page.getByText(/existing adventures \(1\)/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('main').getByText('The Mock Adventure')
    ).toBeVisible({ timeout: 3000 });

    // Adventures include scenes — mock adventure has 1 scene
    await expect(
      page.locator('main').getByText(/1.*scene|scene.*1/i)
    ).toBeVisible({ timeout: 3000 });
  });
});
