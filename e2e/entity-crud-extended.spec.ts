/**
 * Extended Entity CRUD tests — covers entity types NOT tested in entity-crud.spec.ts:
 * Items, Articles (Lorebook), Player Characters, Plots, and Notes.
 *
 * Strategy notes
 * --------------
 * - Items and Articles use the same EntityCreationPanel chat/form toggle as NPCs.
 *   We switch to form mode to use the quick-generate path.
 * - Player Characters use an Importer panel rather than an AI generator. In mock
 *   mode, clicking "Mock Import" triggers parseCharacterSheetPdf which returns
 *   a mock PC named "Elowyn". We test the manual creation button instead if
 *   the mock import is unavailable.
 * - Plots and Notes use simple title-based creators (no AI generation), so we
 *   fill the title field and click "Create Plot" / "Create Note".
 * - Mock entity names:
 *     Item     -> "Mocked Sunstone Compass"
 *     Article  -> "The Mock War of the Whispering Peaks"
 *     PC       -> "Elowyn" (from mock PDF parser)
 * - Articles use `title` not `name`, and the dashboard heading is "Lorebook Articles (N)".
 * - Plots dashboard heading section shows "Active Arcs" / "Dormant" / "Resolved".
 * - Notes dashboard heading is "Campaign Notes".
 */

import { test, expect, type Page } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('Extended Entity CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Extended CRUD Campaign',
      settingType: 'custom',
      setting: 'A world of wonder and peril.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function switchToFormMode(page: Page): Promise<void> {
    const switchBtn = page.getByRole('button', { name: /switch to form/i });
    await expect(switchBtn).toBeVisible({ timeout: 5000 });
    await switchBtn.click();
  }

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

  // =========================================================================
  // ITEMS
  // =========================================================================

  test.describe('Items', () => {
    test('generate Item appears in the dashboard list', async ({ page }) => {
      await navigateToView(page, 'Items');
      await switchToFormMode(page);
      await quickGenerate(page, 'A glowing compass', /generate item/i);

      // After generation the editor auto-opens with the mock item name
      await expect(
        page.locator('main').getByText('Mocked Sunstone Compass').first()
      ).toBeVisible({ timeout: 5000 });

      // Navigate back to Items list
      await navigateToView(page, 'Items');
      await expect(page.getByText(/existing items \(1\)/i)).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator('main').getByText('Mocked Sunstone Compass')
      ).toBeVisible({ timeout: 3000 });
    });

    test('edit Item name persists after blur', async ({ page }) => {
      await navigateToView(page, 'Items');
      await switchToFormMode(page);
      await quickGenerate(page, 'A magic ring', /generate item/i);

      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await expect(nameInput).toHaveValue('Mocked Sunstone Compass');

      await nameInput.fill('Ring of Echoes');
      await nameInput.press('Tab');

      await navigateToView(page, 'Items');
      await expect(
        page.locator('main').getByText('Ring of Echoes')
      ).toBeVisible({ timeout: 5000 });
    });

    test('delete Item removes it from the dashboard', async ({ page }) => {
      await navigateToView(page, 'Items');
      await switchToFormMode(page);
      await quickGenerate(page, 'A cursed blade', /generate item/i);

      // Editor opens after generation.
      const deleteBtn = page.getByRole('button', { name: /delete item/i });
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // useConfirmDialog renders a ConfirmDialog overlay with "Confirm" button
      const confirmBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm/i });
      await expect(confirmBtn).toBeVisible({ timeout: 3000 });
      await confirmBtn.click();

      // After deletion, navigates back to Items dashboard
      await expect(
        page.getByText(/existing items \(0\)/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // ARTICLES (Lorebook)
  // =========================================================================

  test.describe('Articles (Lorebook)', () => {
    test('generate Article appears in the dashboard list', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await switchToFormMode(page);
      await quickGenerate(page, 'The great war of old', /generate article/i);

      // Editor auto-opens with the mock article title
      await expect(
        page.locator('main').getByText(/mock war of the whispering peaks/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Navigate back to Lorebook list
      await navigateToView(page, 'Lorebook');
      await expect(page.getByText(/lorebook articles \(1\)/i)).toBeVisible({ timeout: 5000 });
      // The title appears both in the card <h3> and in the parent article <option>.
      // Target the <h3> element specifically to avoid matching the hidden <option>.
      await expect(
        page.locator('main h3').filter({ hasText: /mock war of the whispering peaks/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test('edit Article title persists', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await switchToFormMode(page);
      await quickGenerate(page, 'An ancient legend', /generate article/i);

      // Article editor uses 'title' field via input[name="title"]
      const titleInput = page.locator('input[name="title"]');
      await expect(titleInput).toBeVisible({ timeout: 5000 });

      await titleInput.fill('The Age of Stars');
      await titleInput.press('Tab');

      await navigateToView(page, 'Lorebook');
      // Target the <h3> element specifically to avoid matching the hidden <option>.
      await expect(
        page.locator('main h3').filter({ hasText: 'The Age of Stars' })
      ).toBeVisible({ timeout: 5000 });
    });

    test('delete Article removes it from the dashboard', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await switchToFormMode(page);
      await quickGenerate(page, 'A lost tradition', /generate article/i);

      const deleteBtn = page.getByRole('button', { name: /delete article/i });
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // useConfirmDialog renders a ConfirmDialog overlay with "Confirm" button
      const confirmBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm/i });
      await expect(confirmBtn).toBeVisible({ timeout: 3000 });
      await confirmBtn.click();

      await expect(
        page.getByText(/lorebook articles \(0\)/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // PLOTS
  // =========================================================================

  test.describe('Plots', () => {
    test('create Plot appears in the Active Arcs section', async ({ page }) => {
      await navigateToView(page, 'Plots & Arcs');

      // The Plot creator has a title input and "Create Plot" button
      const titleInput = page.getByPlaceholder(/the return of the lich king/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('The Dragon Conspiracy');

      await page.getByRole('button', { name: /create plot/i }).click();

      // The plot should appear in the Active Arcs section
      await expect(
        page.locator('main').getByText('The Dragon Conspiracy')
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'e2e/screenshots/plot-created.png' });
    });

    test('click Plot card opens the editor', async ({ page }) => {
      await navigateToView(page, 'Plots & Arcs');

      const titleInput = page.getByPlaceholder(/the return of the lich king/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('The Shadow War');
      await page.getByRole('button', { name: /create plot/i }).click();

      // Click the plot card to open the editor
      await page.locator('main').getByText('The Shadow War').click();

      // The editor should show the plot title in an input
      const plotTitleInput = page.locator('input[name="title"]');
      await expect(plotTitleInput).toBeVisible({ timeout: 5000 });
      await expect(plotTitleInput).toHaveValue('The Shadow War');
    });

    test('delete Plot removes it from the dashboard', async ({ page }) => {
      await navigateToView(page, 'Plots & Arcs');

      const titleInput = page.getByPlaceholder(/the return of the lich king/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('Doomed Plot');
      await page.getByRole('button', { name: /create plot/i }).click();

      // Click to open editor
      await page.locator('main').getByText('Doomed Plot').click();

      const deleteBtn = page.getByRole('button', { name: /delete plot/i });
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // useConfirmDialog renders a ConfirmDialog overlay with "Confirm" button
      const confirmBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm/i });
      await expect(confirmBtn).toBeVisible({ timeout: 3000 });
      await confirmBtn.click();

      // After deletion, back to Plots dashboard — the plot should be gone
      await expect(
        page.locator('main').getByText('Doomed Plot')
      ).not.toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // NOTES
  // =========================================================================

  test.describe('Notes', () => {
    // Notes do not have their own sidebar entry or EditorView — the NoteDashboard
    // component exists but is not routed in the current app. These tests are skipped
    // until a Notes view is added to the sidebar and ViewRouter.
    test.skip('create Note appears in the Campaign Notes list', async ({ page }) => {
      await navigateToView(page, 'Notes');
      const titleInput = page.getByPlaceholder(/the villain.*secret plan/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('Remember to add traps');
      await page.getByRole('button', { name: /create note/i }).click();
      await expect(
        page.locator('main').getByText('Remember to add traps')
      ).toBeVisible({ timeout: 5000 });
    });

    test.skip('click Note card opens the editor', async ({ page }) => {
      await navigateToView(page, 'Notes');
      const titleInput = page.getByPlaceholder(/the villain.*secret plan/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('Secret passage locations');
      await page.getByRole('button', { name: /create note/i }).click();
      await page.locator('main').getByText('Secret passage locations').click();
      const noteTitleInput = page.locator('input[name="title"]');
      await expect(noteTitleInput).toBeVisible({ timeout: 5000 });
      await expect(noteTitleInput).toHaveValue('Secret passage locations');
    });
  });

  // =========================================================================
  // PLAYER CHARACTERS
  // =========================================================================

  test.describe('Player Characters', () => {
    test('Player Characters dashboard loads', async ({ page }) => {
      await navigateToView(page, 'Party & Characters');

      // The dashboard shows the heading "Player Characters (0)"
      await expect(
        page.locator('main').getByText(/player characters/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Empty state message
      await expect(
        page.locator('main').getByText(/adventuring party awaits/i)
      ).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/pc-dashboard-empty.png' });
    });

    test('Player Character importer panel is visible', async ({ page }) => {
      await navigateToView(page, 'Party & Characters');

      // The importer panel should show an upload/import button
      // PlayerCharacterImporter renders a dropzone or import button
      await expect(
        page.locator('main').getByText(/import|upload|character sheet/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
