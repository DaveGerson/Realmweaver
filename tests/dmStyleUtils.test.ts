import { describe, it, expect } from 'vitest';
import {
    isFeatureVisible,
    FEATURE_LABELS,
    OVERRIDEABLE_FEATURES,
} from '../utils/dmStyleUtils';

// ---------------------------------------------------------------------------
// FEATURE_LABELS & OVERRIDEABLE_FEATURES structure
// ---------------------------------------------------------------------------

describe('FEATURE_LABELS', () => {
    it('has a label for every overrideable feature', () => {
        for (const feature of OVERRIDEABLE_FEATURES) {
            expect(FEATURE_LABELS[feature]).toBeTruthy();
        }
    });

    it('contains the expected features', () => {
        expect(FEATURE_LABELS['continuity-checker']).toBe('Continuity Checker');
        expect(FEATURE_LABELS['relationship-graph']).toBe('World Graph');
        expect(FEATURE_LABELS['combat-tracker']).toBe('Combat Tracker');
        expect(FEATURE_LABELS['keyboard-shortcuts']).toBe('Keyboard Shortcuts Help');
    });
});

describe('OVERRIDEABLE_FEATURES', () => {
    it('is derived from FEATURE_LABELS keys', () => {
        expect(OVERRIDEABLE_FEATURES).toEqual(Object.keys(FEATURE_LABELS));
    });

    it('includes all guided-hidden features', () => {
        const expected = [
            'continuity-checker',
            'relationship-graph',
            'plot-timeline',
            'backlinks-panel',
            'secrets-tracker',
            'combat-tracker',
            'keyboard-shortcuts',
            'advanced-context',
        ];
        for (const feature of expected) {
            expect(OVERRIDEABLE_FEATURES).toContain(feature);
        }
    });
});

// ---------------------------------------------------------------------------
// isFeatureVisible — guided mode
// ---------------------------------------------------------------------------

describe('isFeatureVisible — guided mode', () => {
    const GUIDED_HIDDEN = [
        'continuity-checker',
        'relationship-graph',
        'plot-timeline',
        'backlinks-panel',
        'secrets-tracker',
        'combat-tracker',
        'keyboard-shortcuts',
        'advanced-context',
    ];

    it('hides all advanced features', () => {
        for (const feature of GUIDED_HIDDEN) {
            expect(isFeatureVisible(feature, 'guided'), `${feature} should be hidden in guided mode`).toBe(false);
        }
    });

    it('shows features not in the hidden set', () => {
        expect(isFeatureVisible('some-basic-feature', 'guided')).toBe(true);
    });

    it('allows overrides to force-show a hidden feature', () => {
        expect(isFeatureVisible('combat-tracker', 'guided', { 'combat-tracker': true })).toBe(true);
    });

    it('allows overrides to force-hide a visible feature', () => {
        expect(isFeatureVisible('some-basic-feature', 'guided', { 'some-basic-feature': false })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isFeatureVisible — standard mode
// ---------------------------------------------------------------------------

describe('isFeatureVisible — standard mode', () => {
    it('shows all features by default', () => {
        // In standard mode, STANDARD_HIDDEN is empty so everything is visible
        expect(isFeatureVisible('continuity-checker', 'standard')).toBe(true);
        expect(isFeatureVisible('relationship-graph', 'standard')).toBe(true);
        expect(isFeatureVisible('combat-tracker', 'standard')).toBe(true);
        expect(isFeatureVisible('anything-else', 'standard')).toBe(true);
    });

    it('allows overrides to hide features', () => {
        expect(isFeatureVisible('combat-tracker', 'standard', { 'combat-tracker': false })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isFeatureVisible — power mode
// ---------------------------------------------------------------------------

describe('isFeatureVisible — power mode', () => {
    it('shows everything by default', () => {
        expect(isFeatureVisible('continuity-checker', 'power')).toBe(true);
        expect(isFeatureVisible('relationship-graph', 'power')).toBe(true);
        expect(isFeatureVisible('combat-tracker', 'power')).toBe(true);
        expect(isFeatureVisible('advanced-context', 'power')).toBe(true);
    });

    it('allows overrides to hide features', () => {
        expect(isFeatureVisible('combat-tracker', 'power', { 'combat-tracker': false })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isFeatureVisible — defaults
// ---------------------------------------------------------------------------

describe('isFeatureVisible — defaults', () => {
    it('defaults to standard mode when style is not provided', () => {
        // Standard mode shows everything
        expect(isFeatureVisible('combat-tracker')).toBe(true);
        expect(isFeatureVisible('continuity-checker')).toBe(true);
    });

    it('defaults to empty overrides when not provided', () => {
        expect(isFeatureVisible('combat-tracker', 'guided')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Override precedence
// ---------------------------------------------------------------------------

describe('isFeatureVisible — override precedence', () => {
    it('override always wins over style defaults', () => {
        // Power mode shows everything, but override hides it
        expect(isFeatureVisible('combat-tracker', 'power', { 'combat-tracker': false })).toBe(false);

        // Guided mode hides advanced features, but override shows it
        expect(isFeatureVisible('combat-tracker', 'guided', { 'combat-tracker': true })).toBe(true);
    });

    it('override with explicit true is respected', () => {
        expect(isFeatureVisible('plot-timeline', 'guided', { 'plot-timeline': true })).toBe(true);
    });

    it('override with explicit false is respected even for power mode', () => {
        expect(isFeatureVisible('plot-timeline', 'power', { 'plot-timeline': false })).toBe(false);
    });
});
