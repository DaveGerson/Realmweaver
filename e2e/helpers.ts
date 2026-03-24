import { Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/**
 * Reset Realmweaver localStorage to a clean "no campaigns" state, then
 * reload so the app re-initialises from scratch.
 *
 * Sets 'realmweaver-campaigns' to '[]' instead of removing the key.
 * When the key is absent, campaignService.init() creates the demo "Winter's
 * Daughter" campaign and jumps to 'editing'. An empty array sends it to the
 * 'welcome' state instead.
 */
export async function gotoFresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('realmweaver'))
      .forEach((k) => localStorage.removeItem(k));
    // Empty array -> campaignService.init() -> appStatus = 'welcome'
    localStorage.setItem('realmweaver-campaigns', '[]');
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: /create your first campaign/i })
  ).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Mock Mode
// ---------------------------------------------------------------------------

/**
 * Ensure mock mode is ON.
 *
 * The toggle is a <button role="switch" aria-checked={isMockMode}>. It only
 * appears in the header once a campaign is active. Mock mode defaults to true
 * in App.tsx, so this is mainly needed after toggling it off.
 *
 * On mobile the button can be partially obscured by the fixed sidebar stacking
 * context; we use { force: true } to reliably dispatch the click.
 */
export async function enableMockMode(page: Page): Promise<void> {
  const toggle = page.locator('[role="switch"]').first();
  if (!(await toggle.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }
  const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
  if (!isChecked) {
    await toggle.click({ force: true });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
}

// ---------------------------------------------------------------------------
// Campaign creation
// ---------------------------------------------------------------------------

type DmStyleOption = 'guided' | 'standard' | 'power';

interface CreateCampaignOptions {
  title?: string;
  dmStyle?: DmStyleOption;
  settingType?: 'official' | 'custom';
  setting?: string;
}

/**
 * Create a campaign starting from any pre-campaign screen or from within an
 * active campaign via the header dropdown.
 *
 * After submission, waits for the sidebar to show the new campaign's title.
 */
export async function createCampaign(
  page: Page,
  options: CreateCampaignOptions = {}
): Promise<void> {
  const {
    title = 'Test Campaign',
    dmStyle = 'standard',
    settingType = 'custom',
    setting = 'A dark fantasy world full of danger and mystery.',
  } = options;

  // Navigate to the creator form if not already on it
  const creatorHeading = page.getByRole('heading', { name: 'Create Your Campaign' });
  const isOnCreator = await creatorHeading.isVisible({ timeout: 500 }).catch(() => false);

  if (!isOnCreator) {
    // Welcome screen path
    const createFirstBtn = page.getByRole('button', { name: /create your first campaign/i });
    // Selector screen path
    const selectorCreateBtn = page.getByRole('button', { name: /create new campaign/i });

    if (await createFirstBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await createFirstBtn.click();
    } else if (await selectorCreateBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await selectorCreateBtn.click();
    } else {
      // Already in editing mode — open the campaign dropdown in the header
      await openCampaignDropdown(page);
      await page.getByRole('button', { name: /create new campaign/i }).click();
    }

    await expect(creatorHeading).toBeVisible({ timeout: 5000 });
  }

  // Fill campaign title — the input has no 'for' attribute, match by placeholder
  await page.getByPlaceholder(/the sundered crown/i).fill(title);

  // Setting type (radios ARE wrapped in <label> tags with text)
  if (settingType === 'custom') {
    await page.getByRole('radio', { name: /custom world/i }).check();
    if (setting) {
      await page.locator('textarea').fill(setting);
    }
  } else {
    await page.getByRole('radio', { name: /official setting/i }).check();
  }

  // DM Style card buttons
  const styleLabels: Record<DmStyleOption, RegExp> = {
    guided: /i'm new to dming/i,
    standard: /i keep it simple/i,
    power: /give me everything/i,
  };
  await page.getByRole('button', { name: styleLabels[dmStyle] }).click();

  // Submit
  await page.getByRole('button', { name: /weave campaign/i }).click();

  // Wait for the editing state — aside heading confirms campaign loaded
  await expect(
    page.locator('aside').getByRole('heading', { name: title })
  ).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * On mobile, the sidebar is a hidden drawer. Open it by clicking the
 * hamburger button in the header (md:hidden class means desktop doesn't show it).
 */
async function openMobileSidebar(page: Page): Promise<void> {
  // The hamburger button sits before the logo in the header — it's md:hidden
  const hamburger = page.locator('header').getByRole('button').first();
  // Only click it if the sidebar is not currently visible in the viewport
  const sidebar = page.locator('aside');
  const sidebarBox = await sidebar.boundingBox();
  // On mobile, sidebar is translated -100% left so x is negative
  if (sidebarBox && sidebarBox.x < 0) {
    await hamburger.click({ force: true });
    // Wait for sidebar to slide into view
    await page.waitForTimeout(300);
  }
}

/**
 * Click a sidebar navigation button by its visible label text.
 *
 * On mobile, opens the sidebar drawer first (if needed).
 *
 * Common sidebar labels:
 *   "Session Timeline", "Party & Characters", "Combat Tracker",
 *   "Plots & Arcs", "World Graph", "Secrets & Clues",
 *   "Adventures", "Setting Overview", "Lorebook",
 *   "NPCs", "Locations", "Factions", "Items"
 */
export async function navigateToView(page: Page, label: string): Promise<void> {
  await openMobileSidebar(page);
  const btn = page.locator('aside').getByRole('button', { name: new RegExp(label, 'i') }).first();
  await btn.click({ force: true });
}

/** Wait for the main content area to be rendered. */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.locator('main')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Campaign selector helpers
// ---------------------------------------------------------------------------

/**
 * Open the campaign dropdown in the header.
 *
 * The trigger is a button inside `header > div > div.relative` that contains
 * the campaign title as text.
 */
async function openCampaignDropdown(page: Page): Promise<void> {
  const dropdownTrigger = page
    .locator('header')
    .locator('div.relative')
    .first()
    .locator('button')
    .first();
  await dropdownTrigger.click();
}

/**
 * Navigate to the campaign selector via the header campaign dropdown.
 */
export async function openCampaignSelector(page: Page): Promise<void> {
  await openCampaignDropdown(page);
  await page.getByRole('button', { name: /switch campaign/i }).click();
  await expect(page.getByRole('heading', { name: 'Your Campaigns' })).toBeVisible({ timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Auto-save helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the campaign auto-save to complete.
 *
 * The save indicator shows "Saved" text in the header — but this element
 * is hidden on small screens (hidden sm:flex). Instead, we wait for the
 * localStorage to be written, which happens within ~2.5s of the last change.
 *
 * Approach: wait until 'realmweaver-campaigns' in localStorage contains the
 * expected campaign title (meaning the debounced save fired).
 */
export async function waitForAutoSave(page: Page, expectedTitle: string): Promise<void> {
  await page.waitForFunction(
    (title: string) => {
      const saved = localStorage.getItem('realmweaver-campaigns');
      if (!saved) return false;
      return saved.includes(title);
    },
    expectedTitle,
    { timeout: 8000, polling: 200 }
  );
}
