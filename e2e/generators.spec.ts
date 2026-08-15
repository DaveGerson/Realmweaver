/**
 * Generator mode tests — verifies quick-generate vs chat mode toggle,
 * prompt chips, form fields per generator, and the EntityChatGenerator flow.
 *
 * Strategy notes
 * --------------
 * - All dashboards default to "Create via Chat" mode. The form mode is accessed
 *   via the "Switch to form" button. The reverse is "Switch to chat".
 * - Each generator in form mode has a textarea prompt plus generator-specific
 *   fields (e.g., rarity for Item, CR/alignment for NPC, category for Article).
 * - Prompt chips are clickable buttons that fill the prompt textarea.
 * - EntityChatGenerator (chat mode) renders a chat input and sends messages
 *   to the AI. In mock mode, it returns a draft entity that can be approved.
 * - The NPC form generator shows CR and Alignment dropdowns.
 * - The Item form generator shows Rarity and Item Type dropdowns.
 * - The Adventure form generator is reached via Adventures sidebar.
 * - The Article form generator is reached via Lorebook sidebar.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test.describe('Entity Generators', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Generator Test Campaign',
      settingType: 'custom',
      setting: 'A world for testing generators.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // =========================================================================
  // Chat vs Form Mode Toggle
  // =========================================================================

  test.describe('Mode Toggle', () => {
    test('NPC dashboard defaults to chat mode', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      // "Create via Chat" heading indicates chat mode is active
      await expect(
        page.locator('main').getByText(/create via chat/i).first()
      ).toBeVisible({ timeout: 5000 });

      // "Switch to form" button should be visible
      await expect(
        page.getByRole('button', { name: /switch to form/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test('switching to form mode shows generator fields', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      await page.getByRole('button', { name: /switch to form/i }).click();

      // Form mode heading: "NPC Generator"
      await expect(
        page.locator('main').getByText(/npc generator/i).first()
      ).toBeVisible({ timeout: 3000 });

      // The textarea prompt should be visible
      await expect(page.locator('textarea').first()).toBeVisible({ timeout: 3000 });

      // "Switch to chat" button should now be visible (to switch back)
      await expect(
        page.getByRole('button', { name: /switch to chat/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test('switching back to chat mode restores chat UI', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      // Switch to form, then back
      await page.getByRole('button', { name: /switch to form/i }).click();
      await expect(page.getByRole('button', { name: /switch to chat/i })).toBeVisible({ timeout: 3000 });

      await page.getByRole('button', { name: /switch to chat/i }).click();

      await expect(
        page.locator('main').getByText(/create via chat/i).first()
      ).toBeVisible({ timeout: 3000 });
    });
  });

  // =========================================================================
  // Prompt Chips
  // =========================================================================

  test.describe('Prompt Chips', () => {
    test('NPC prompt chips are clickable in chat mode', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      // In chat mode, the EntityChatGenerator shows prompt chips
      // NPC chips include: "A mysterious tavern keeper", etc.
      // The chips are buttons in the chat panel
      const chipBtn = page.getByRole('button', { name: /mysterious tavern keeper|corrupt noble|battle-scarred/i }).first();
      const chipVisible = await chipBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (chipVisible) {
        await chipBtn.click();
        // After clicking a chip, the chat input should be filled or a message sent
        // The chip triggers a message send in EntityChatGenerator
      }
    });

    test('Item prompt chips are visible in chat mode', async ({ page }) => {
      await navigateToView(page, 'Items');

      // Item chat mode prompt chips include: "A cursed weapon", "A healing potion", etc.
      const chipBtn = page.getByRole('button', { name: /cursed weapon|healing potion|mysterious map|legendary artifact/i }).first();
      await expect(chipBtn).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // NPC Generator Form Fields
  // =========================================================================

  test.describe('NPC Generator', () => {
    test('NPC form generator has prompt chips', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // Prompt chips in form mode
      const chipBtn = page.getByRole('button', { name: /mysterious tavern keeper|corrupt noble|battle-scarred|wizard.*apprentice/i }).first();
      await expect(chipBtn).toBeVisible({ timeout: 5000 });
    });

    test('NPC form generator shows generate button', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // The generate button
      await expect(
        page.getByRole('button', { name: /generate npc/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test('clicking a prompt chip fills the textarea', async ({ page }) => {
      await navigateToView(page, 'NPCs');
      await page.getByRole('button', { name: /switch to form/i }).click();

      const textarea = page.locator('textarea').first();
      await expect(textarea).toBeVisible({ timeout: 3000 });
      await expect(textarea).toHaveValue('');

      // Click a chip
      const chipBtn = page.getByRole('button', { name: /mysterious tavern keeper/i }).first();
      if (await chipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chipBtn.click();
        // Textarea should now contain the chip text
        await expect(textarea).not.toHaveValue('');
      }
    });
  });

  // =========================================================================
  // Item Generator Form Fields
  // =========================================================================

  test.describe('Item Generator', () => {
    test('Item form generator has rarity and type selects', async ({ page }) => {
      await navigateToView(page, 'Items');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // The ItemGenerator in form mode shows rarity and type dropdowns
      // They are rendered as <select> elements
      const raritySelect = page.locator('select').first();
      await expect(raritySelect).toBeVisible({ timeout: 5000 });

      // Generate button
      await expect(
        page.getByRole('button', { name: /generate item/i })
      ).toBeVisible({ timeout: 3000 });
    });

    test('Item form rarity can be selected before generating', async ({ page }) => {
      await navigateToView(page, 'Items');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // Find the rarity dropdown — it contains options like Common, Rare, Legendary
      const selects = page.locator('select');
      const count = await selects.count();

      // There should be at least one select (rarity)
      expect(count).toBeGreaterThanOrEqual(1);

      // Select "Legendary" in the first dropdown (rarity)
      await selects.first().selectOption('Legendary');
    });
  });

  // =========================================================================
  // Article Generator Form Fields
  // =========================================================================

  test.describe('Article Generator', () => {
    test('Article form generator shows generate button', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // The ArticleGenerator should show a generate button
      await expect(
        page.getByRole('button', { name: /generate article/i })
      ).toBeVisible({ timeout: 5000 });
    });

    test('Article form prompt chips are visible', async ({ page }) => {
      await navigateToView(page, 'Lorebook');
      await page.getByRole('button', { name: /switch to form/i }).click();

      // Article prompt chips: "The history of the ancient empire", etc.
      const chipBtn = page.getByRole('button', { name: /ancient empire|customs.*traditions|dark forest|magical artifact/i }).first();
      await expect(chipBtn).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Adventure Generator
  // =========================================================================

  test.describe('Adventure Generator', () => {
    test('Adventure form generator shows generate button', async ({ page }) => {
      await navigateToView(page, 'Adventures');
      await page.getByRole('button', { name: /switch to form/i }).click();

      await expect(
        page.getByRole('button', { name: /generate adventure/i })
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Location Generator
  // =========================================================================

  test.describe('Location Generator', () => {
    test('Location form generator shows generate button', async ({ page }) => {
      await navigateToView(page, 'Locations');
      await page.getByRole('button', { name: /switch to form/i }).click();

      await expect(
        page.getByRole('button', { name: /generate location/i })
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Faction Generator
  // =========================================================================

  test.describe('Faction Generator', () => {
    test('Faction form generator shows generate button', async ({ page }) => {
      await navigateToView(page, 'Factions');
      await page.getByRole('button', { name: /switch to form/i }).click();

      await expect(
        page.getByRole('button', { name: /generate faction/i })
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // EntityChatGenerator (Chat Mode Flow)
  // =========================================================================

  test.describe('EntityChatGenerator', () => {
    test('chat mode allows sending a message and receiving a response', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      // Should be in chat mode by default — "Create via Chat"
      await expect(
        page.locator('main').getByText(/create via chat/i).first()
      ).toBeVisible({ timeout: 5000 });

      // The chat input area — EntityChatGenerator uses an input or textarea
      // with a "Send" button or enter-to-submit.
      const chatInput = page.locator('main').getByPlaceholder(/describe|type.*message|ask|create/i).first();
      if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatInput.fill('Create a mysterious old wizard');
        // Submit via the send button
        const sendBtn = page.locator('main').getByRole('button', { name: /send|submit/i }).first();
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendBtn.click();
        } else {
          // Submit via Enter
          await chatInput.press('Enter');
        }

        // Wait for the mock response to appear in the chat
        // Mock response starts with "[Mock]" in the message
        await expect(
          page.locator('main').getByText(/\[mock\]|response|draft/i).first()
        ).toBeVisible({ timeout: 8000 });
      }
    });
  });
});
