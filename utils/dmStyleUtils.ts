
// utils/dmStyleUtils.ts
import type { DmStyle } from '@/types/index';

/**
 * Features that are hidden in guided mode (new DMs).
 * These are the advanced tools that can overwhelm beginners.
 *
 * Only features that are actually consulted via `isFeatureVisible(...)`
 * somewhere in the app belong here — an entry for a feature nothing checks
 * is an inert switch: it moves in the settings panel, persists an override,
 * and changes nothing on screen. 'plot-timeline', 'backlinks-panel' and
 * 'advanced-context' were removed for this reason (see FEATURE_LABELS).
 *
 * Exported so DmStylePanel can derive its guided-mode "Hides: ..." summary
 * from this set + FEATURE_LABELS instead of a hard-coded copy that drifts.
 */
export const GUIDED_HIDDEN = new Set([
  'continuity-checker',
  'relationship-graph',
  'secrets-tracker',
  'combat-tracker',
  'keyboard-shortcuts',
]);

/**
 * Features that are hidden by default in standard mode.
 * These are available but not surfaced prominently.
 */
const STANDARD_HIDDEN = new Set<string>([
  // nothing is fully hidden in standard mode today
]);

/**
 * Human-readable label for each hideable feature.
 * Used in the feature override settings panel.
 *
 * Only features with a real `isFeatureVisible('<key>', ...)` call site are
 * listed here — otherwise the toggle in DmStylePanel is a no-op (finding #91).
 */
export const FEATURE_LABELS: Record<string, string> = {
  'continuity-checker': 'Continuity Checker',
  'relationship-graph': 'World Graph',
  'secrets-tracker': 'Secrets & Clues',
  'combat-tracker': 'Combat Tracker',
  'keyboard-shortcuts': 'Keyboard Shortcuts Help',
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
