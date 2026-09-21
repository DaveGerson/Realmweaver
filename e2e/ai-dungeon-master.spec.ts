/** Live browser journey, offline provider only: play, reload, reference search. */
import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  createCampaign,
  enableMockMode,
  navigateToView,
} from './helpers';

test('AI DM runs a sourced turn, survives reload and searches the full SRD', async ({
  page,
}, testInfo) => {
  await gotoFresh(page);
  await createCampaign(page, {
    title: 'AI DM validation',
    setting: 'A rain-soaked frontier town.',
    settingType: 'custom',
    dmStyle: 'power',
  });
  await enableMockMode(page);
  await navigateToView(page, 'AI Dungeon Master');
  await expect(
    page.getByRole('heading', { name: 'AI Dungeon Master', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start playable demo' }).click();
  await page.getByLabel('What do you do?').fill('I search the watchhouse.');
  await page.getByRole('button', { name: 'Send to DM' }).click();
  await expect(
    page.getByRole('log', { name: 'Adventure transcript' }),
  ).toContainText('perception');
  await expect(page.getByRole('log')).toContainText('vs 15');
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('realmweaver-campaigns') ?? ''),
    )
    .toContain('I search the watchhouse.');
  await page.reload();
  await navigateToView(page, 'AI Dungeon Master');
  await expect(page.getByRole('log')).toContainText('I search the watchhouse.');
  await page.screenshot({
    path: `e2e/screenshots/ai-dm-play-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'SRD reference', exact: true })
    .click();
  await page.getByLabel('Search all 364 SRD pages').fill('Exhaustion');
  await expect(
    page.getByText('Page 181 · Rules Glossary', { exact: false }),
  ).toBeVisible();
  await page.getByText('Page 181 · Rules Glossary', { exact: false }).click();
  await expect(
    page
      .locator('details')
      .filter({
        has: page.getByText('Page 181 · Rules Glossary', { exact: false }),
      })
      .locator('pre'),
  ).toContainText('2 times your Exhaustion level');
  await page.screenshot({
    path: `e2e/screenshots/ai-dm-rules-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
