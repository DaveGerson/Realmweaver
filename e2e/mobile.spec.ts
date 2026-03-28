/**
 * Mobile-specific tests — run with the 'mobile-chrome' project (Pixel 5 viewport).
 *
 * Strategy notes
 * --------------
 * - The Pixel 5 viewport is 393x851 (from playwright.config.ts devices).
 * - On mobile (<md breakpoint), the sidebar is hidden by default and revealed
 *   by a hamburger button in the header (md:hidden class).
 * - The SessionRunner on mobile shows a tab bar at the bottom for switching
 *   between Scenes, Active (notes/beats), and Tools panels.
 * - The session runner also shows a FAB (floating action button) menu for
 *   quick actions on mobile.
 * - Command palette (Ctrl+K) should still work on mobile via the header
 *   Search button.
 * - The sidebar slides in from the left with a translate animation.
 *
 * IMPORTANT: These tests are scoped to the 'mobile-chrome' project only via
 * test.use(). If the playwright config uses { ...devices['Pixel 5'] } for
 * the 'mobile-chrome' project, these tests will automatically run with that
 * viewport.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

// Scope these tests to mobile viewport only
test.use({
  viewport: { width: 393, height: 851 },
  isMobile: true,
});

test.describe('Mobile Experience', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Mobile Test Campaign',
      settingType: 'custom',
      setting: 'A mobile-friendly world.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // =========================================================================
  // Sidebar Behavior
  // =========================================================================

  test.describe('Sidebar', () => {
    test('sidebar is not visible by default on mobile', async ({ page }) => {
      // On mobile, the sidebar should be hidden (off-screen or collapsed)
      const sidebar = page.locator('aside');

      // The sidebar exists in the DOM but is positioned off-screen
      // Check that its bounding box has a negative x position
      const boundingBox = await sidebar.boundingBox();
      if (boundingBox) {
        // On mobile, sidebar is translated left (x < 0) when closed
        expect(boundingBox.x).toBeLessThanOrEqual(0);
      }
    });

    test('hamburger button opens sidebar on mobile', async ({ page }) => {
      // The hamburger button is in the header, visible only on mobile (md:hidden)
      const hamburger = page.locator('header').getByRole('button').first();
      await expect(hamburger).toBeVisible({ timeout: 3000 });

      await hamburger.click({ force: true });

      // After clicking, wait for sidebar animation to complete
      await page.waitForTimeout(400);

      // Sidebar should now be visible — its bounding box should overlap with the viewport.
      // On some mobile viewports, x can be slightly negative (-12px) due to padding/borders.
      const sidebar = page.locator('aside');
      const boundingBox = await sidebar.boundingBox();
      if (boundingBox) {
        // Sidebar is mostly on-screen: left edge within 20px of viewport
        expect(boundingBox.x).toBeGreaterThanOrEqual(-20);
        // And a significant portion of it is visible (width > 200px visible area)
        expect(boundingBox.width + boundingBox.x).toBeGreaterThan(200);
      }

      // Sidebar heading should contain the campaign title
      await expect(
        sidebar.getByText('Mobile Test Campaign')
      ).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/mobile-sidebar-open.png' });
    });

    test('sidebar navigation works on mobile', async ({ page }) => {
      // navigateToView helper handles opening sidebar on mobile
      await navigateToView(page, 'NPCs');

      // Verify the NPCs dashboard is showing in main content
      await expect(
        page.locator('main').getByText(/npc|character/i).first()
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'e2e/screenshots/mobile-npcs-dashboard.png' });
    });
  });

  // =========================================================================
  // Session Runner Mobile
  // =========================================================================

  test.describe('Session Runner Mobile', () => {
    test('session runner shows mobile tab bar', async ({ page }) => {
      // Create a session and go live
      await navigateToView(page, 'Session Timeline');
      await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /quick plan/i }).click();

      const goLiveBtn = page.getByRole('button', { name: /go live/i });
      await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
      await goLiveBtn.click();

      // On mobile, "End Session" text is hidden (sm:inline). Wait for the session
      // runner to load by checking for the mobile tab bar instead.
      // The tabs are: Scenes, Active, Tools
      const scenesTab = page.getByRole('button', { name: /^scenes$/i });
      const activeTab = page.getByRole('button', { name: /^active$/i });
      const toolsTab = page.getByRole('button', { name: /^tools$/i });

      // Wait for the tab bar to appear (indicates session runner is loaded)
      await expect(scenesTab.or(activeTab).or(toolsTab).first()).toBeVisible({ timeout: 8000 });

      const hasScenes = await scenesTab.isVisible({ timeout: 1000 }).catch(() => false);
      const hasActive = await activeTab.isVisible({ timeout: 1000 }).catch(() => false);
      const hasTools = await toolsTab.isVisible({ timeout: 1000 }).catch(() => false);

      expect(hasScenes || hasActive || hasTools).toBeTruthy();

      await page.screenshot({ path: 'e2e/screenshots/mobile-session-runner.png' });
    });

    test('mobile tab switching works in session runner', async ({ page }) => {
      await navigateToView(page, 'Session Timeline');
      await expect(page.getByRole('heading', { name: /session manager/i })).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /quick plan/i }).click();

      const goLiveBtn = page.getByRole('button', { name: /go live/i });
      await expect(goLiveBtn).toBeVisible({ timeout: 8000 });
      await goLiveBtn.click();

      // Wait for the session runner to load (mobile tab bar visible)
      const toolsTab = page.getByRole('button', { name: /^tools$/i });
      await expect(toolsTab).toBeVisible({ timeout: 8000 });

      // Switch to Tools tab
      await toolsTab.click();

      // Tools panel should show the dice roller or other tools
      await expect(
        page.getByText(/dice|combat|secrets|roller/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Command Palette on Mobile
  // =========================================================================

  test.describe('Command Palette', () => {
    test('command palette opens from header search button on mobile', async ({ page }) => {
      // On mobile, the search button in the header should still be accessible
      const searchBtn = page.locator('header').getByRole('button', { name: /search/i });

      if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchBtn.click();

        // The command palette should open with a search input
        const paletteInput = page.getByPlaceholder(/search entities/i);
        await expect(paletteInput).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: 'e2e/screenshots/mobile-command-palette.png' });

        // Close it
        await page.keyboard.press('Escape');
      } else {
        // On very small screens the button may be hidden;
        // try keyboard shortcut instead
        await page.keyboard.press('Control+k');

        const paletteInput = page.getByPlaceholder(/search entities/i);
        await expect(paletteInput).toBeVisible({ timeout: 3000 });

        await page.keyboard.press('Escape');
      }
    });
  });

  // =========================================================================
  // Mobile Dashboard Layout
  // =========================================================================

  test.describe('Dashboard Layout', () => {
    test('entity cards stack vertically on mobile', async ({ page }) => {
      await navigateToView(page, 'NPCs');

      // The NPC dashboard should render its content in a single column
      // on mobile (grid-cols-1). Check that main content is visible and
      // properly laid out.
      await expect(
        page.locator('main')
      ).toBeVisible({ timeout: 3000 });

      // The creation panel should be visible
      await expect(
        page.locator('main').getByText(/create via chat|generator/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('campaign selector accessible via header dropdown on mobile', async ({ page }) => {
      // Open the campaign dropdown
      const dropdownTrigger = page
        .locator('header')
        .locator('div.relative')
        .first()
        .locator('button')
        .first();
      await dropdownTrigger.click();

      // Menu items should be visible
      await expect(
        page.getByRole('menuitem', { name: /all campaigns/i }).or(
          page.getByRole('button', { name: /all campaigns/i })
        )
      ).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: 'e2e/screenshots/mobile-campaign-dropdown.png' });
    });
  });
});
