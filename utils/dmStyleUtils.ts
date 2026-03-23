
// utils/dmStyleUtils.ts
import type { DmStyle } from '@/types/index';

/**
 * Features that are hidden in guided mode (new DMs).
 * These are the advanced tools that can overwhelm beginners.
 */
const GUIDED_HIDDEN = new Set([
  'continuity-checker',
  'relationship-graph',
  'plot-timeline',
  'backlinks-panel',
  'secrets-tracker',
  'combat-tracker',
  'keyboard-shortcuts',
  'advanced-context',
]);

/**
 * Features that are hidden by default in standard mode.
 * These are available but not surfaced prominently.
 */
const STANDARD_HIDDEN = new Set<string>([
  // plot-timeline is available but collapsed in standard — currently nothing fully hidden
]);

/**
 * Human-readable label for each hideable feature.
 * Used in the feature override settings panel.
 */
export const FEATURE_LABELS: Record<string, string> = {
  'continuity-checker': 'Continuity Checker',
  'relationship-graph': 'World Graph',
  'plot-timeline': 'Plot Timeline',
  'backlinks-panel': 'Backlinks Panel',
  'secrets-tracker': 'Secrets & Clues',
  'combat-tracker': 'Combat Tracker',
  'keyboard-shortcuts': 'Keyboard Shortcuts Help',
  'advanced-context': 'Advanced Context Options',
};

/**
 * All features that can be individually overridden.
 * Order matters — it controls display order in the settings panel.
 */
export const OVERRIDEABLE_FEATURES = Object.keys(FEATURE_LABELS);

/**
 * Returns true if a feature should be visible given the current DM style
 * and any per-feature manual overrides stored in the campaign.
 *
 * Override rules:
 *   - If featureOverrides[feature] is explicitly set, that value wins.
 *   - Otherwise, visibility is determined by the DM style defaults.
 */
export function isFeatureVisible(
  feature: string,
  style: DmStyle = 'standard',
  featureOverrides: Record<string, boolean> = {}
): boolean {
  // Manual overrides always win
  if (feature in featureOverrides) {
    return featureOverrides[feature];
  }

  if (style === 'guided') return !GUIDED_HIDDEN.has(feature);
  if (style === 'standard') return !STANDARD_HIDDEN.has(feature);
  return true; // power mode — everything visible by default
}
