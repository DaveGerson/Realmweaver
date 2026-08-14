/**
 * wp-j-types-utils — finding #91
 *
 * `FEATURE_LABELS` / `OVERRIDEABLE_FEATURES` expose 8 switches in
 * DmStylePanel.tsx:111, and `GUIDED_HIDDEN` claims to hide all 8 in guided
 * mode. But only five feature keys are ever passed to `isFeatureVisible` in
 * the app: 'combat-tracker', 'secrets-tracker' (SessionRunner, CampaignSidebar),
 * 'relationship-graph' (CampaignSidebar), 'continuity-checker',
 * 'keyboard-shortcuts' (Header). 'backlinks-panel', 'plot-timeline' and
 * 'advanced-context' are checked nowhere: BacklinksPanel is rendered
 * unconditionally at the bottom of all eleven editors and PlotTimeline
 * unconditionally in PlotDashboard.tsx:119. So a guided-mode DM still sees
 * both, and flipping those switches off writes a persisted override that
 * changes nothing on screen.
 *
 * Contract: every key the settings panel offers must actually gate something.
 * Either wire the missing gates, or drop the unimplemented keys from
 * FEATURE_LABELS/GUIDED_HIDDEN — this test passes under EITHER fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OVERRIDEABLE_FEATURES, FEATURE_LABELS, isFeatureVisible } from '../../utils/dmStyleUtils';

const ROOT = resolve(__dirname, '../..');
const SEARCH_DIRS = ['components', 'hooks', 'services', 'utils'];
/** The panel that renders the switches must not count as a consumer of them. */
const EXCLUDED = ['components/common/DmStylePanel.tsx', 'utils/dmStyleUtils.ts'];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const sources = [
  ...SEARCH_DIRS.flatMap(d => collectSourceFiles(join(ROOT, d))),
  join(ROOT, 'App.tsx'),
]
  .filter(f => !EXCLUDED.some(ex => f.endsWith(ex)))
  .map(f => ({ file: f.slice(ROOT.length + 1), text: readFileSync(f, 'utf8') }));

/** Files that pass this feature key to isFeatureVisible(...). */
function gateSites(feature: string): string[] {
  const re = new RegExp(`isFeatureVisible\\(\\s*['"\`]${feature}['"\`]`);
  return sources.filter(s => re.test(s.text)).map(s => s.file);
}

describe('#91 — every overrideable DM-style feature toggle actually gates something', () => {
  it.each(OVERRIDEABLE_FEATURES)('"%s" is checked by at least one isFeatureVisible call site', feature => {
    expect(gateSites(feature), `"${FEATURE_LABELS[feature]}" is offered as a switch but never consulted`).not.toHaveLength(0);
  });

  it('guided mode hides only features that are actually gated', () => {
    const hiddenInGuided = OVERRIDEABLE_FEATURES.filter(f => !isFeatureVisible(f, 'guided'));
    const ungated = hiddenInGuided.filter(f => gateSites(f).length === 0);
    expect(ungated).toEqual([]);
  });
});
