/**
 * wp-i2-build-test-infra — finding #122
 *
 * `utils/demoTemplates.ts` is a 39KB / 618-line module whose entire payload — 8 NPCs,
 * 3 factions, 7 locations, 5 items, a 10-scene adventure, 2 plots, 2 articles — lives
 * inside the body of `getWintersDaughterTemplate()`. Because the data is produced by a
 * called function rather than separately-exported constants, Rollup cannot tree-shake
 * it, and the payload ends up in the main entry chunk. Its only consumer is
 * `FirstCampaignWizard.tsx:560`, which reads `getWintersDaughterTemplate().setting` —
 * one paragraph of prose.
 *
 * Contract: the eagerly-imported module must no longer embed the demo entity payload.
 * Either route (extract the sample prose into its own small export and delete the
 * body, or move the campaign to `data/templates/winters-daughter.json` behind the
 * existing dynamic-import path) satisfies the assertions below.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const demoTemplatesSource = readFileSync(
  fileURLToPath(new URL('../../utils/demoTemplates.ts', import.meta.url)),
  'utf8'
);

describe('wp-i2 — demo campaign payload (finding #122)', () => {
  it('does not statically embed the Winter’s Daughter entity payload', () => {
    // Markers that appear only inside the demo NPC/location/item roster.
    const payloadMarkers = ['Whything', 'Butter-for-Bones', 'Snowfall-at-Dusk'];
    const present = payloadMarkers.filter((marker) => demoTemplatesSource.includes(marker));

    expect(present).toEqual([]);
  });

  it('stays a small module rather than a 39KB literal in the entry chunk', () => {
    expect(demoTemplatesSource.length).toBeLessThan(12_000);
  });
});
