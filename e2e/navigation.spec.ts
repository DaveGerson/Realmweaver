/**
 * Navigation tests — sidebar switching, breadcrumbs, back button,
 * recent items, and command palette.
 *
 * Strategy notes
 * --------------
 * - The campaign is created with dmStyle 'power' so all sidebar items
 *   (including Secrets & Clues, World Graph) are visible.
 * - Breadcrumbs are rendered in a <nav aria-label="Breadcrumb"> element.
 *   When only one segment exists AND canGoBack is false the component
 *   returns null, so breadcrumbs only appear once we navigate into an entity.
 * - The back button (ArrowLeft) lives in the same breadcrumb nav as a button
 *   with aria-label="Go back".
 * - Command palette opens on Ctrl+K (or Meta+K on Mac); the Search button in
 *   the header also opens it. We click the header button for reliability.
 * - Recent items are session-level only; they appear in the sidebar after
 *   clicking an entity card in the dashboard.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
  openMobileSidebar,
} from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await createCampaign(page, {
      title: 'Nav Test Campaign',
      settingType: 'custom',
      setting: 'A test world.',
      dmStyle: 'power',
    });
    await enableMockMode(page);
  });

  // -------------------------------------------------------------------------
  // 1. Sidebar navigation between views
  // -------------------------------------------------------------------------

  test('sidebar navigation switches between NPC and Location dashboards', async ({ page }) => {
    // Navigate to NPCs dashboard
    await navigateToView(page, 'NPCs');

    // Wait for main content to reflect the NPCs dashboard
    await expect(page.locator('main').getByRole('heading', { name: /npcs/i }).first()).toBeVisible({ timeout: 5000 });

    // Navigate to Locations dashboard
    await navigateToView(page, 'Locations');

    // The Locations dashboard heading should now be visible
    await expect(page.locator('main').getByRole('heading', { name: /locations/i }).first()).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 2. Breadcrumbs show path when an NPC is selected
  // -------------------------------------------------------------------------

  test('breadcrumbs show campaign > NPCs > NPC name after generating an NPC', async ({ page }) => {
    await navigateToView(page, 'NPCs');

    // Switch to form mode and generate a mock NPC
    const switchBtn = page.getByRole('button', { name: /switch to form/i });
    await expect(switchBtn).toBeVisible({ timeout: 5000 });
    await switchBtn.click();

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('A dwarven blacksmith');
    await page.getByRole('button', { name: /generate npc/i }).click();

    // After generation the NPC editor opens automatically.
    // Breadcrumbs should now contain: Campaign > NPCs > <npc name>
    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible({ timeout: 8000 });

    // The second segment should be "NPCs"
    await expect(breadcrumbNav.getByRole('button', { name: /npcs/i })).toBeVisible({ timeout: 5000 });

    // The last segment should contain the mocked NPC name (non-clickable span)
    await expect(breadcrumbNav.getByText(/mocked bjorn ironhand/i)).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 3. Back button returns to previous view
  // -------------------------------------------------------------------------

  test('back button returns to previous view after navigating via sidebar entity', async ({ page }) => {
    // Generate a mock NPC so there is an entity in the sidebar list
    await navigateToView(page, 'NPCs');
    const switchBtn = page.getByRole('button', { name: /switch to form/i });
    await expect(switchBtn).toBeVisible({ timeout: 5000 });
    await switchBtn.click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('A city guard');
    await page.getByRole('button', { name: /generate npc/i }).click();

    // Wait for editor to auto-open after generation
    await expect(
      page.locator('main').getByText('Mocked Bjorn Ironhand').first()
    ).toBeVisible({ timeout: 8000 });

    // Navigate to Locations view
    await navigateToView(page, 'Locations');

    // Use the sidebar filter to show the NPC — when a filter is active, all entity
    // groups are expanded regardless of their toggle state.
    const sidebar = page.locator('aside');
    const filterInput = sidebar.getByPlaceholder(/filter entities/i);
    await expect(filterInput).toBeVisible({ timeout: 3000 });
    await filterInput.fill('Mocked Bjorn');

    // The NPC entry should appear in the filtered sidebar list
    const npcEntry = sidebar.getByRole('button', { name: 'Mocked Bjorn Ironhand' });
    await expect(npcEntry).toBeVisible({ timeout: 5000 });
    // Click the NPC entry — this calls handleSelect → pushNavStack
    await openMobileSidebar(page);
    await npcEntry.click();

    // Clear the filter
    await filterInput.fill('');

    // Editor should open with breadcrumbs that include the back button
    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible({ timeout: 5000 });
    const backBtn = breadcrumbNav.getByRole('button', { name: /go back/i });
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    // After going back we should no longer see the NPC name in the breadcrumb
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).not.toContainText('Mocked Bjorn Ironhand', { timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 4. Recent items appear in sidebar after visiting entities via sidebar filter
  // -------------------------------------------------------------------------

  test('recently visited NPC appears in sidebar Recent section', async ({ page }) => {
    // Generate a mock NPC so there is an entity in the sidebar list
    await navigateToView(page, 'NPCs');
    const switchBtn = page.getByRole('button', { name: /switch to form/i });
    await expect(switchBtn).toBeVisible({ timeout: 5000 });
    await switchBtn.click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('A gruff merchant');
    await page.getByRole('button', { name: /generate npc/i }).click();

    // Wait for editor to open after generation
    await expect(
      page.locator('main').getByText('Mocked Bjorn Ironhand').first()
    ).toBeVisible({ timeout: 8000 });

    // Navigate away — the NPC stays in the campaign but selection is cleared
    await navigateToView(page, 'Locations');

    // Use the sidebar filter to reveal the NPC entity button (filter expands all groups)
    const sidebar = page.locator('aside');
    const filterInput = sidebar.getByPlaceholder(/filter entities/i);
    await expect(filterInput).toBeVisible({ timeout: 3000 });
    await filterInput.fill('Mocked Bjorn');

    // Click the NPC entry — this calls handleSelect → trackRecentItem
    const npcEntry = sidebar.getByRole('button', { name: 'Mocked Bjorn Ironhand' });
    await expect(npcEntry).toBeVisible({ timeout: 5000 });
    await openMobileSidebar(page);
    await npcEntry.click();

    // Clear the filter so the Recent section becomes visible
    await filterInput.fill('');

    // Navigate away so we're not on the NPC editor
    await navigateToView(page, 'Factions');

    // The sidebar "Recent" heading and the NPC name should now be visible
    await expect(sidebar.getByText(/recent/i).first()).toBeVisible({ timeout: 5000 });
    await expect(sidebar.getByText('Mocked Bjorn Ironhand')).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 5. Command palette opens via header Search button
  // -------------------------------------------------------------------------

  test('command palette opens when Search button is clicked', async ({ page }) => {
    // The Search button in the header opens the command palette
    // It is labeled "Search (Ctrl+K)" with aria-label containing "Search"
    const searchBtn = page.locator('header').getByRole('button', { name: /search/i });
    await expect(searchBtn).toBeVisible({ timeout: 5000 });
    await searchBtn.click();

    // The command palette renders as a modal-like overlay with a search input
    // The input has placeholder "Search entities and actions..."
    const paletteInput = page.getByPlaceholder(/search entities/i);
    await expect(paletteInput).toBeVisible({ timeout: 5000 });
  });
});
