import { Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Genuinely wait for a locator to become visible within `timeout`, resolving
 * to `true`/`false` instead of throwing.
 *
 * Playwright documents `isVisible`'s timeout option as ignored — that call
 * does not wait for the element to become visible and returns immediately,
 * so using it as a boolean probe is a race: the element may appear a moment
 * later and the probe still reports false.
 */
async function isVisibleWithin(locator: import('@playwright/test').Locator, timeout: number): Promise<boolean> {
  return locator.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false
  );
}

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
    page.getByRole('button', { name: /create a campaign/i })
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
 */
export async function enableMockMode(page: Page): Promise<void> {
  const toggle = page.locator('[role="switch"]').first();
  if (!(await isVisibleWithin(toggle, 2000))) {
    return;
  }
  const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
  if (!isChecked) {
    await toggle.click();
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
 *
 * Flow (Phase F): Welcome → CampaignCreator (template-select step) →
 *   click "Start From Scratch" → campaign-form step → fill form → submit.
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

  // Navigate to the creator if not already there.
  // The template-select step shows "Start With a Template?" heading.
  // The campaign-form step shows "Create Your Campaign" heading.
  const templateSelectHeading = page.getByRole('heading', { name: /start with a template/i });
  const creatorHeading = page.getByRole('heading', { name: 'Create Your Campaign' });

  const isOnTemplateSelect = await isVisibleWithin(templateSelectHeading, 500);
  const isOnCreatorForm = await isVisibleWithin(creatorHeading, 500);

  if (!isOnTemplateSelect && !isOnCreatorForm) {
    // Welcome screen path — button text unchanged
    const createFirstBtn = page.getByRole('button', { name: /create a campaign/i });
    // CrossCampaignDashboard path — the "Create new campaign" dashed card
    const selectorCreateBtn = page.getByRole('button', { name: /create new campaign/i });

    if (await isVisibleWithin(createFirstBtn, 1500)) {
      await createFirstBtn.click();
    } else if (await isVisibleWithin(selectorCreateBtn, 1500)) {
      await selectorCreateBtn.click();
    } else {
      // Already in editing mode — use header to start a new campaign
      await openCampaignDropdown(page);
      await page.getByRole('button', { name: /create new campaign/i }).click();
    }
  }

  // After any of the above paths we land on the template-select step.
  // Skip it by clicking "Start From Scratch" unless we're already on the form.
  if (!isOnCreatorForm) {
    await expect(templateSelectHeading).toBeVisible({ timeout: 5000 });
    // The skip link is a plain <button> with text "Start From Scratch — I'll build my own world"
    // Use the button role scoped to the exact button text to avoid matching the
    // descriptive paragraph that also contains "from scratch".
    await page.getByRole('button', { name: /start from scratch/i }).click();
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

  // DM Style card radios (role="radio" with aria-checked)
  const styleLabels: Record<DmStyleOption, RegExp> = {
    guided: /i'm new to dming/i,
    standard: /i keep it simple/i,
    power: /give me everything/i,
  };
  await page.getByRole('radio', { name: styleLabels[dmStyle] }).click();

  // Submit
  await page.getByRole('button', { name: /weave campaign/i }).click();

  // Wait for the editing state — aside heading confirms campaign loaded
  await expect(
    page.locator('aside').getByRole('heading', { name: title })
  ).toBeVisible({ timeout: 8000 });

  // Dismiss the FirstCampaignWizard if it auto-opened for the empty campaign.
  // It renders as a fixed full-screen overlay with a close button titled "Skip wizard".
  // FirstCampaignWizard auto-opens from a React effect after the campaign
  // transitions to 'editing', so we must genuinely wait for it rather than
  // probe instantly — an instant check can lose that race and leave the
  // overlay covering every later action in the test.
  const skipWizardBtn = page.locator('button[title="Skip wizard"]');
  if (await isVisibleWithin(skipWizardBtn, 2000)) {
    await skipWizardBtn.click();
    // Wait for the overlay to disappear
    await expect(skipWizardBtn).not.toBeVisible({ timeout: 3000 });
  }
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
    await hamburger.click();
    // Wait for the slide-in transition to actually finish instead of a fixed
    // sleep: poll the sidebar's bounding box until it has slid on-screen.
    await expect(async () => {
      const box = await sidebar.boundingBox();
      expect(box && box.x >= 0).toBe(true);
    }).toPass({ timeout: 2000 });
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
  await btn.click();
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
 * Navigate to the campaign selector (CrossCampaignDashboard) via the header
 * campaign dropdown. Phase F replaced CampaignSelector with CrossCampaignDashboard;
 * the heading is now "All Campaigns".
 */
export async function openCampaignSelector(page: Page): Promise<void> {
  await openCampaignDropdown(page);
  // The dropdown has both "All Campaigns" and "Switch Campaign" (both call the same action).
  // Use exact match on "All Campaigns" to avoid strict-mode violation.
  // The dropdown items use role="menuitem", not role="button".
  await page.getByRole('menuitem', { name: 'All Campaigns', exact: true }).click();
  await expect(page.getByRole('heading', { name: /all campaigns|your campaigns/i })).toBeVisible({ timeout: 3000 });
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
