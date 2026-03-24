/**
 * Suite 1: Campaign Lifecycle
 *
 * Tests campaign creation, persistence, switching, and deletion.
 * Every test is independent: each calls gotoFresh() which sets localStorage
 * to an empty campaigns array, then reloads — landing on the Welcome screen.
 *
 * Mock mode is ON by default (App.tsx: isMockMode = true).
 * enableMockMode() is called after a campaign is loaded where needed.
 */

import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  openCampaignSelector,
  navigateToView,
  waitForAutoSave,
} from './helpers';

// ---------------------------------------------------------------------------
// Test 1: Create campaign with custom setting (standard DM style)
// ---------------------------------------------------------------------------

test('create campaign with custom setting', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Dark Fantasy Campaign',
    settingType: 'custom',
    setting: 'A grim world where gods have abandoned mortals.',
    dmStyle: 'standard',
  });

  await page.screenshot({ path: 'e2e/screenshots/campaign-create-custom.png' });

  // Sidebar heading confirms campaign is loaded
  await expect(page.locator('aside').getByRole('heading', { name: 'Dark Fantasy Campaign' })).toBeVisible();

  // App is in editing state — the aside sidebar is present
  await expect(page.locator('aside')).toBeVisible();
  await enableMockMode(page);
});

// ---------------------------------------------------------------------------
// Test 2: Create campaign with guided DM style
// ---------------------------------------------------------------------------

test('create campaign with guided DM style hides advanced features', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Guided Adventure',
    settingType: 'custom',
    setting: 'A beginner-friendly realm.',
    dmStyle: 'guided',
  });

  await page.screenshot({ path: 'e2e/screenshots/campaign-create-guided.png' });

  await expect(page.locator('aside').getByRole('heading', { name: 'Guided Adventure' })).toBeVisible();

  // Guided mode hides advanced tools — combat tracker should not appear in sidebar
  await expect(
    page.locator('aside').getByRole('button', { name: /combat tracker/i })
  ).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3: Create campaign with power DM style
// ---------------------------------------------------------------------------

test('create campaign with power DM style shows all features', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Power DM Campaign',
    settingType: 'custom',
    setting: 'All features enabled.',
    dmStyle: 'power',
  });

  await page.screenshot({ path: 'e2e/screenshots/campaign-create-power.png' });

  await expect(page.locator('aside').getByRole('heading', { name: 'Power DM Campaign' })).toBeVisible();

  // Power mode shows combat tracker in sidebar
  await expect(
    page.locator('aside').getByRole('button', { name: /combat tracker/i })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4: Create campaign with official setting
// ---------------------------------------------------------------------------

test('create campaign with official setting', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Forgotten Realms Adventure',
    settingType: 'official',
    dmStyle: 'standard',
  });

  await page.screenshot({ path: 'e2e/screenshots/campaign-create-official.png' });

  await expect(page.locator('aside').getByRole('heading', { name: 'Forgotten Realms Adventure' })).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 5: Campaign persists across page reload
// ---------------------------------------------------------------------------

test('campaign persists across page reload', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Persistent World',
    settingType: 'custom',
    setting: 'This world should survive a reload.',
  });

  await expect(page.locator('aside').getByRole('heading', { name: 'Persistent World' })).toBeVisible();

  // Wait for the debounced auto-save to write the campaign to localStorage
  // before reloading — otherwise the data won't survive the page reload.
  await waitForAutoSave(page, 'Persistent World');

  // Reload — the app restores the campaign from localStorage
  await page.reload();
  await page.waitForLoadState('networkidle');

  await page.screenshot({ path: 'e2e/screenshots/campaign-persist-reload.png' });

  // Campaign title still visible in sidebar after reload
  await expect(
    page.locator('aside').getByRole('heading', { name: 'Persistent World' })
  ).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 6: Switch between campaigns
// ---------------------------------------------------------------------------

test('switch between campaigns shows correct data', async ({ page }) => {
  await gotoFresh(page);

  // Create first campaign
  await createCampaign(page, {
    title: 'Campaign Alpha',
    settingType: 'custom',
    setting: 'The first world.',
  });
  await expect(page.locator('aside').getByRole('heading', { name: 'Campaign Alpha' })).toBeVisible();

  // Open header dropdown and create a second campaign
  await openCampaignSelector(page);
  // Now on the campaign selector — click "Create New Campaign" in the selector
  await page.getByRole('button', { name: /create new campaign/i }).click();

  await createCampaign(page, {
    title: 'Campaign Beta',
    settingType: 'custom',
    setting: 'The second world.',
  });
  await expect(page.locator('aside').getByRole('heading', { name: 'Campaign Beta' })).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/campaign-switch-beta-loaded.png' });

  // Switch back to Campaign Alpha via the selector
  await openCampaignSelector(page);

  // Both campaigns appear in the selector list
  await expect(page.getByRole('heading', { name: 'Your Campaigns' })).toBeVisible();
  await expect(page.getByText('Campaign Alpha')).toBeVisible();
  await expect(page.getByText('Campaign Beta')).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/campaign-selector-both.png' });

  // Click Campaign Alpha's name to load it
  await page.getByText('Campaign Alpha').first().click();
  await expect(
    page.locator('aside').getByRole('heading', { name: 'Campaign Alpha' })
  ).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'e2e/screenshots/campaign-switch-alpha-restored.png' });
});

// ---------------------------------------------------------------------------
// Test 7: Delete campaign removes it from the selector
// ---------------------------------------------------------------------------

test('delete campaign removes it from selector', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Doomed Campaign',
    settingType: 'custom',
    setting: 'This campaign is destined to be deleted.',
  });
  await expect(page.locator('aside').getByRole('heading', { name: 'Doomed Campaign' })).toBeVisible();

  // Navigate to selector
  await openCampaignSelector(page);
  await expect(page.getByText('Doomed Campaign')).toBeVisible();

  // deleteCampaign() calls window.confirm() — auto-accept it before clicking
  page.once('dialog', (dialog) => dialog.accept());

  // Delete button has aria-label "Delete campaign {title}"
  const deleteBtn = page.getByRole('button', { name: /delete campaign doomed campaign/i });
  await deleteBtn.click();

  await page.screenshot({ path: 'e2e/screenshots/campaign-deleted.png' });

  // Campaign no longer in the list
  await expect(page.getByText('Doomed Campaign')).not.toBeVisible({ timeout: 5000 });

  // With no campaigns, selector shows empty state OR app returns to welcome
  const emptyState = page.getByText(/haven't created any campaigns/i);
  const welcomeHeading = page.getByText(/welcome to realmweaver/i);
  await expect(emptyState.or(welcomeHeading)).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 8: Campaign creator requires a title
// ---------------------------------------------------------------------------

test('campaign creator requires a title before submitting', async ({ page }) => {
  await gotoFresh(page);

  // Navigate to the creator
  await page.getByRole('button', { name: /create your first campaign/i }).click();
  await expect(page.getByRole('heading', { name: 'Create Your Campaign' })).toBeVisible();

  // Click submit with an empty title — HTML required attribute prevents submission
  await page.getByRole('button', { name: /weave campaign/i }).click();

  // The creator form stays visible (browser native validation stops it)
  await expect(page.getByRole('heading', { name: 'Create Your Campaign' })).toBeVisible();

  // The sidebar (editing state) must NOT have appeared
  await expect(page.locator('aside')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 9: Sidebar navigation works after campaign creation
// ---------------------------------------------------------------------------

test('sidebar nav items are clickable after campaign creation', async ({ page }) => {
  await gotoFresh(page);

  await createCampaign(page, {
    title: 'Navigation Test Campaign',
    dmStyle: 'power',   // power mode shows all nav items
  });

  await enableMockMode(page);

  // Navigate through several sidebar sections
  await navigateToView(page, 'NPCs');
  await expect(page.locator('main')).toContainText(/npc|character/i, { timeout: 3000 });

  await navigateToView(page, 'Locations');
  await expect(page.locator('main')).toContainText(/location|place/i, { timeout: 3000 });

  await navigateToView(page, 'Adventures');
  await expect(page.locator('main')).toContainText(/adventure/i, { timeout: 3000 });

  await navigateToView(page, 'Setting Overview');
  await expect(page.locator('main')).toContainText(/campaign setting|setting/i, { timeout: 3000 });

  await page.screenshot({ path: 'e2e/screenshots/campaign-nav-setting.png' });
});
