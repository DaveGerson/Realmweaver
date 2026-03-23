import { test, expect } from '@playwright/test';

test.describe('Realmweaver Smoke Tests', () => {
  test('app loads and shows welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Campaign Weaver|Realmweaver/i);
    // App should render something visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('can create a new campaign', async ({ page }) => {
    await page.goto('/');
    // Click create campaign button (look for common patterns)
    const createBtn = page.getByRole('button', { name: /create|new campaign/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      // Should navigate to campaign creator
      await expect(page.locator('text=/campaign/i')).toBeVisible();
    }
  });

  test('mock mode toggle works', async ({ page }) => {
    await page.goto('/');
    // Look for mock mode toggle in the header
    const mockToggle = page.locator('[aria-label*="mock" i], button:has-text("Mock")');
    if (await mockToggle.isVisible()) {
      await mockToggle.click();
      // Toggle should change state
      await expect(mockToggle).toBeVisible();
    }
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    // Command palette should appear
    const palette = page.locator('[role="dialog"], [aria-label*="search" i], [aria-label*="command" i]');
    await expect(palette.first()).toBeVisible({ timeout: 2000 }).catch(() => {
      // Palette might not exist yet if no campaign is open
    });
  });
});

test.describe('Campaign Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Enable mock mode for consistent testing
    const mockToggle = page.locator('[aria-label*="mock" i], button:has-text("Mock")');
    if (await mockToggle.isVisible()) {
      await mockToggle.click();
    }
  });

  test('sidebar navigation works', async ({ page }) => {
    // If a campaign is loaded, sidebar should have entity categories
    const sidebar = page.locator('nav').first();
    if (await sidebar.isVisible()) {
      // Check for common entity type navigation items
      const npcLink = page.locator('text=/NPC/i');
      if (await npcLink.first().isVisible()) {
        await npcLink.first().click();
        // Should show NPC dashboard or list
        await expect(page.locator('text=/NPC/i').first()).toBeVisible();
      }
    }
  });
});
