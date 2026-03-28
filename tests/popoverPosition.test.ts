import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculatePopoverPosition } from '../utils/popoverPosition';

// ---------------------------------------------------------------------------
// Mock window/document globals needed in Node environment
// ---------------------------------------------------------------------------

beforeEach(() => {

    // Provide minimal window mock
    vi.stubGlobal('window', {
        innerHeight: 800,
        innerWidth: 1200,
        scrollX: 0,
        scrollY: 0,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Helper to create a DOMRect-like object
function makeRect(top: number, left: number, width: number, height: number): DOMRect {
    return {
        top,
        left,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
    };
}

// ---------------------------------------------------------------------------
// Basic positioning — collapsed (isExpanded = false)
// ---------------------------------------------------------------------------

describe('calculatePopoverPosition — collapsed mode', () => {
    it('opens downward when space below is sufficient', () => {
        // Trigger at top of screen, plenty of space below
        const rect = makeRect(100, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // CARD_HEIGHT = 240, MARGIN = 8
        // bottom (120) + 240 + 8 = 368, well within 800
        expect(result.openUpward).toBe(false);
        expect(result.top).toBe(120 + 8); // triggerRect.bottom + scrollY + MARGIN
    });

    it('opens upward when not enough space below but enough above', () => {
        // Trigger near the bottom of the screen
        const rect = makeRect(650, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // bottom = 670, 670 + 240 + 8 = 918 > 800 (not enough below)
        // top = 650, 650 - 240 - 8 = 402 >= 0 (enough above)
        expect(result.openUpward).toBe(true);
        expect(result.top).toBe(650 - 240 - 8); // triggerRect.top + scrollY - CARD_HEIGHT - MARGIN
    });

    it('opens downward when neither direction has enough space (prefers down)', () => {
        // Trigger in the middle of a tiny viewport
        vi.stubGlobal('window', { innerHeight: 300, innerWidth: 1200, scrollX: 0, scrollY: 0 });

        const rect = makeRect(100, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // bottom = 120, 120 + 240 + 8 = 368 > 300 (not enough below)
        // top = 100, 100 - 240 - 8 = -148 < 0 (not enough above either)
        // Falls back to downward (openUpward is false because above condition fails)
        expect(result.openUpward).toBe(false);
    });

    it('aligns left with trigger rect', () => {
        const rect = makeRect(100, 300, 100, 20);
        const result = calculatePopoverPosition(rect, false);
        expect(result.left).toBe(300);
    });

    it('clamps left position to avoid overflowing right edge', () => {
        // Trigger near the right edge of viewport
        const rect = makeRect(100, 1050, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // CARD_WIDTH = 280, MARGIN = 8
        // left + 280 = 1330 > 1200 - 8 = 1192
        // clamped: 1200 - 280 - 8 = 912
        expect(result.left).toBe(912);
    });

    it('clamps left position to MARGIN when it would go negative', () => {
        // Trigger at the very left
        const rect = makeRect(100, 2, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // left = 2, but after clamping: max(MARGIN, 2) = 8 (since 2 < 8)
        expect(result.left).toBe(8);
    });
});

// ---------------------------------------------------------------------------
// Expanded mode — uses larger card dimensions
// ---------------------------------------------------------------------------

describe('calculatePopoverPosition — expanded mode', () => {
    it('uses larger CARD_HEIGHT (480) for expanded mode', () => {
        // Trigger in the middle, should need to flip upward sooner
        const rect = makeRect(400, 200, 100, 20);
        const result = calculatePopoverPosition(rect, true);

        // bottom = 420, 420 + 480 + 8 = 908 > 800 (not enough below)
        // top = 400, 400 - 480 - 8 = -88 < 0 (not enough above either)
        // Falls back to downward
        expect(result.openUpward).toBe(false);
    });

    it('flips upward when trigger is very low', () => {
        // Trigger near the bottom
        const rect = makeRect(600, 200, 100, 20);
        const result = calculatePopoverPosition(rect, true);

        // bottom = 620, 620 + 480 + 8 = 1108 > 800 (not enough below)
        // top = 600, 600 - 480 - 8 = 112 >= 0 (enough above)
        expect(result.openUpward).toBe(true);
        expect(result.top).toBe(600 - 480 - 8);
    });

    it('uses larger CARD_WIDTH (384) for right-edge clamping', () => {
        const rect = makeRect(100, 1000, 100, 20);
        const result = calculatePopoverPosition(rect, true);

        // left + 384 = 1384 > 1200 - 8 = 1192
        // clamped: 1200 - 384 - 8 = 808
        expect(result.left).toBe(808);
    });
});

// ---------------------------------------------------------------------------
// Scroll offset
// ---------------------------------------------------------------------------

describe('calculatePopoverPosition — with scroll offset', () => {
    it('accounts for vertical scroll in top calculation', () => {
        vi.stubGlobal('window', { innerHeight: 800, innerWidth: 1200, scrollX: 0, scrollY: 500 });

        const rect = makeRect(100, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // Opens downward: triggerRect.bottom + scrollY + MARGIN = 120 + 500 + 8 = 628
        expect(result.top).toBe(628);
    });

    it('accounts for horizontal scroll in left calculation', () => {
        vi.stubGlobal('window', { innerHeight: 800, innerWidth: 1200, scrollX: 300, scrollY: 0 });

        const rect = makeRect(100, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // left = triggerRect.left + scrollX = 200 + 300 = 500
        expect(result.left).toBe(500);
    });

    it('accounts for scroll when opening upward', () => {
        vi.stubGlobal('window', { innerHeight: 800, innerWidth: 1200, scrollX: 0, scrollY: 200 });

        const rect = makeRect(650, 200, 100, 20);
        const result = calculatePopoverPosition(rect, false);

        // Opens upward: triggerRect.top + scrollY - CARD_HEIGHT - MARGIN = 650 + 200 - 240 - 8 = 602
        expect(result.openUpward).toBe(true);
        expect(result.top).toBe(602);
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('calculatePopoverPosition — edge cases', () => {
    it('handles zero-size trigger rect', () => {
        const rect = makeRect(100, 100, 0, 0);
        const result = calculatePopoverPosition(rect, false);
        // Should still produce valid numbers
        expect(typeof result.top).toBe('number');
        expect(typeof result.left).toBe('number');
        expect(typeof result.openUpward).toBe('boolean');
    });

    it('handles trigger rect at origin', () => {
        const rect = makeRect(0, 0, 10, 10);
        const result = calculatePopoverPosition(rect, false);
        // Opens downward (0 - 240 - 8 < 0, so upward not possible)
        expect(result.openUpward).toBe(false);
        // Left clamped to MARGIN since 0 < 8
        expect(result.left).toBe(8);
    });

    it('handles very small viewport', () => {
        vi.stubGlobal('window', { innerHeight: 100, innerWidth: 100, scrollX: 0, scrollY: 0 });

        const rect = makeRect(50, 50, 10, 10);
        const result = calculatePopoverPosition(rect, false);
        // Should produce valid numbers without crashing
        expect(typeof result.top).toBe('number');
        expect(typeof result.left).toBe('number');
    });
});
