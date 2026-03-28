/**
 * Editor tests — verify tab navigation, field editing, and dropdown interactions
 * across all entity editors.
 *
 * Strategy notes
 * --------------
 * - Each test generates an entity in mock mode, which auto-opens the editor.
 * - NPC Editor tabs: Identity, Personality, Stats & Combat, Connections.
 *   Uses TabLayout with <button role="tab"> semantics.
 * - Location/Faction/Adventure/Article editors may also use tabs.
 * - Item Editor has rarity and type dropdowns (select[name="rarity"],
 *   select[name="type"]).
 * - Plot Editor has a status dropdown (select[name="status"]) and a title input.
 * - Session Log Editor has a "Go Live" button.
 * - All editors use input[name="name"] or input[name="title"] for the primary
 *   name field, and save on blur.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('Entity Editors', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Editor Test Campaign',
      settingType: 'custom',
      setting: 'A world for testing editors.',
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
  // NPC Editor
  // =========================================================================

  test.describe('NPC Editor', () => {
    test('NPC Editor shows all tabs', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await switchToFormMode(page);
      await quickGenerate(page, 'A noble knight', /generate npc/i);

      // Wait for editor to load
      await expect(page.locator('main').getByText('Mocked Bjorn Ironhand').first()).toBeVisible({ timeout: 5000 });

      // Verify all four tabs are visible
      await expect(page.getByRole('tab', { name: /identity/i })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole('tab', { name: /personality/i })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole('tab', { name: /stats.*combat/i })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole('tab', { name: /connections/i })).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/npc-editor-tabs.png' });
    });

    test('NPC Editor tab switching shows different content', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await switchToFormMode(page);
      await quickGenerate(page, 'A bard with secrets', /generate npc/i);

      await expect(page.locator('main').getByText('Mocked Bjorn Ironhand').first()).toBeVisible({ timeout: 5000 });

      // Start on Identity tab (default) — name input should be visible
      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible({ timeout: 3000 });

      // Switch to Personality tab
      await page.getByRole('tab', { name: /personality/i }).click();

      // Personality tab should show traits-related fields
      // Look for the traits textarea or a label containing "traits"
      await expect(
        page.locator('main').getByText(/traits|personality|quote/i).first()
      ).toBeVisible({ timeout: 3000 });

      // Switch to Stats & Combat tab
      await page.getByRole('tab', { name: /stats.*combat/i }).click();
      await expect(
        page.locator('main').getByText(/stats|combat|abilities/i).first()
      ).toBeVisible({ timeout: 3000 });

      // Switch to Connections tab
      await page.getByRole('tab', { name: /connections/i }).click();
      await expect(
        page.locator('main').getByText(/faction|relationship|connection/i).first()
      ).toBeVisible({ timeout: 3000 });
    });

    test('NPC faction dropdown is available on Identity tab', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await switchToFormMode(page);
      await quickGenerate(page, 'A spy', /generate npc/i);

      await expect(page.locator('main').getByText('Mocked Bjorn Ironhand').first()).toBeVisible({ timeout: 5000 });

      // The faction dropdown is on the Identity tab (the default tab)
      // No need to switch tabs — it's already visible alongside the name input.
      const factionSelect = page.locator('select[name="factionId"]');
      await expect(factionSelect).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // Location Editor
  // =========================================================================

  test.describe('Location Editor', () => {
    test('Location Editor loads with name input', async ({ page }) => {
      await navigateToView(page, 'Locations');
      await switchToFormMode(page);
      await quickGenerate(page, 'A dark forest', /generate location/i);

      await expect(
        page.locator('main').getByText('The Mocked Whispering Falls').first()
      ).toBeVisible({ timeout: 5000 });

      // Name input should be populated
      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await expect(nameInput).toHaveValue('The Mocked Whispering Falls');
    });

    test('Location Editor has parent location dropdown', async ({ page }) => {
      await navigateToView(page, 'Locations');
      await switchToFormMode(page);
      await quickGenerate(page, 'A tower', /generate location/i);

      await expect(
        page.locator('main').getByText('The Mocked Whispering Falls').first()
      ).toBeVisible({ timeout: 5000 });

      // Parent location dropdown is on the Connections tab
      await page.getByRole('tab', { name: /connections/i }).click();

      const parentSelect = page.locator('select[name="parentLocationId"]');
      await expect(parentSelect).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // Faction Editor
  // =========================================================================

  test.describe('Faction Editor', () => {
    test('Faction Editor loads with name and goals fields', async ({ page }) => {
      await navigateToView(page, 'Factions');
      await switchToFormMode(page);
      await quickGenerate(page, 'A merchant guild', /generate faction/i);

      await expect(
        page.locator('main').getByText('The Mocked Silent Hand').first()
      ).toBeVisible({ timeout: 5000 });

      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toBeVisible({ timeout: 3000 });
      await expect(nameInput).toHaveValue('The Mocked Silent Hand');

      // Goals field should be present (textarea or input)
      await expect(
        page.locator('main').getByText(/goals/i).first()
      ).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // Item Editor
  // =========================================================================

  test.describe('Item Editor', () => {
    test('Item Editor has rarity and type dropdowns', async ({ page }) => {
      await navigateToView(page, 'Items');
      await switchToFormMode(page);
      await quickGenerate(page, 'A shimmering orb', /generate item/i);

      await expect(
        page.locator('main').getByText('Mocked Sunstone Compass').first()
      ).toBeVisible({ timeout: 5000 });

      // Rarity dropdown — has name="rarity"
      const raritySelect = page.locator('select[name="rarity"]');
      await expect(raritySelect).toBeVisible({ timeout: 3000 });

      // Item Type dropdown — no name attribute, find by its label text "Item Type"
      const typeLabel = page.locator('label').filter({ hasText: /item type/i });
      const typeSelect = typeLabel.locator('..').locator('select');
      await expect(typeSelect).toBeVisible({ timeout: 3000 });
    });

    test('Item Editor rarity can be changed', async ({ page }) => {
      await navigateToView(page, 'Items');
      await switchToFormMode(page);
      await quickGenerate(page, 'A wand', /generate item/i);

      await expect(
        page.locator('main').getByText('Mocked Sunstone Compass').first()
      ).toBeVisible({ timeout: 5000 });

      const raritySelect = page.locator('select[name="rarity"]');
      await expect(raritySelect).toBeVisible({ timeout: 3000 });

      // Change rarity to "legendary"
      await raritySelect.selectOption('legendary');

      // Verify the selection persisted in the dropdown
      await expect(raritySelect).toHaveValue('legendary');
    });
  });

  // =========================================================================
  // Adventure Editor
  // =========================================================================

  test.describe('Adventure Editor', () => {
    test('Adventure Editor loads with title and scene list', async ({ page }) => {
      await navigateToView(page, 'Adventures');
      await switchToFormMode(page);
      await quickGenerate(page, 'A rescue mission', /generate adventure/i);

      await expect(
        page.locator('main').getByText(/the mock adventure/i).first()
      ).toBeVisible({ timeout: 5000 });

      // The mock adventure includes 1 scene — look for scene-related content
      await expect(
        page.locator('main').getByText(/scene|a mock scene/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('Adventure Editor has tabs', async ({ page }) => {
      await navigateToView(page, 'Adventures');
      await switchToFormMode(page);
      await quickGenerate(page, 'A dungeon crawl', /generate adventure/i);

      await expect(
        page.locator('main').getByText(/the mock adventure/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Look for Overview, Scenes, and/or Prep Doc tabs
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      const scenesTab = page.getByRole('tab', { name: /scenes/i });

      // At least one tab system should be present
      const hasOverview = await overviewTab.isVisible({ timeout: 2000 }).catch(() => false);
      const hasScenes = await scenesTab.isVisible({ timeout: 2000 }).catch(() => false);

      // The adventure editor should show some tab navigation
      expect(hasOverview || hasScenes).toBeTruthy();
    });
  });

  // =========================================================================
  // Article Editor
  // =========================================================================

  test.describe('Article Editor', () => {
    test('Article Editor loads with title and category', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await switchToFormMode(page);
      await quickGenerate(page, 'An ancient war', /generate article/i);

      await expect(
        page.locator('main').getByText(/mock war of the whispering peaks/i).first()
      ).toBeVisible({ timeout: 5000 });

      // Title input
      const titleInput = page.locator('input[name="title"]');
      await expect(titleInput).toBeVisible({ timeout: 3000 });

      // Category — the mock article has category "history". Verify the <select name="category">
      // has the correct value rather than looking for visible text (which matches hidden <option>).
      const categorySelect = page.locator('select[name="category"]');
      await expect(categorySelect).toBeVisible({ timeout: 3000 });
      await expect(categorySelect).toHaveValue('history');
    });
  });

  // =========================================================================
  // Plot Editor
  // =========================================================================

  test.describe('Plot Editor', () => {
    test('Plot Editor shows status dropdown and title input', async ({ page }) => {
      await navigateToView(page, 'Plots & Arcs');

      // Create a plot first
      const titleInput = page.getByPlaceholder(/the return of the lich king/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('The Rising Darkness');
      await page.getByRole('button', { name: /create plot/i }).click();

      // Click the plot card to open editor
      await page.locator('main').getByText('The Rising Darkness').click();

      // Title input in editor
      const plotTitle = page.locator('input[name="title"]');
      await expect(plotTitle).toBeVisible({ timeout: 5000 });
      await expect(plotTitle).toHaveValue('The Rising Darkness');

      // Status dropdown
      const statusSelect = page.locator('select[name="status"]');
      await expect(statusSelect).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/plot-editor.png' });
    });

    test('Plot Editor status can be changed', async ({ page }) => {
      await navigateToView(page, 'Plots & Arcs');

      const titleInput = page.getByPlaceholder(/the return of the lich king/i);
      await expect(titleInput).toBeVisible({ timeout: 5000 });
      await titleInput.fill('Dormant Arc');
      await page.getByRole('button', { name: /create plot/i }).click();

      await page.locator('main').getByText('Dormant Arc').click();

      const statusSelect = page.locator('select[name="status"]');
      await expect(statusSelect).toBeVisible({ timeout: 5000 });

      // Change status from 'active' to 'dormant'
      await statusSelect.selectOption('dormant');
      await statusSelect.dispatchEvent('change');

      // Navigate back and verify it moved to the Dormant section
      await navigateToView(page, 'Plots & Arcs');
      // The dormant section heading includes "Dormant / Backburner"
      await expect(
        page.locator('main').getByText(/dormant.*backburner/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Session Log Editor
  // =========================================================================

  test.describe('Session Log Editor', () => {
    test('Session Log Editor has Go Live button', async ({ page }) => {
      await navigateToView(page, 'Session Timeline');

      // Create a quick plan session
      await page.getByRole('button', { name: /quick plan/i }).click();

      // The session log editor should show with a "Go Live" button
      const goLiveBtn = page.getByRole('button', { name: /go live/i });
      await expect(goLiveBtn).toBeVisible({ timeout: 8000 });

      await page.screenshot({ path: 'e2e/screenshots/session-log-editor-go-live.png' });
    });
  });
});
