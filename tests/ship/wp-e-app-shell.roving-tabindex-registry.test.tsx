// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #103
 *
 * `getRovingProps` returns `ref: setRef(index)`. `setRef` is a curried factory,
 * so `setRef(index)` is a BRAND-NEW closure on every render. React therefore
 * detaches every item's ref on every commit (calling the old callback with
 * null) before attaching the new ones. The null branch pops trailing nulls, so
 * itemsRef.current is emptied and focusedIndexRef.current is reset to 0.
 *
 * Concrete failure: the GM arrows to card 12 on the NPC dashboard; the next
 * commit (the autosave cycle emits two store notifications per edit) recomputes
 * `tabIndex` with focusedIndexRef back at 0 and the Tab anchor jumps back to
 * card 1.
 *
 * Contract: the hook must hand React a STABLE per-index ref callback (a lazily
 * created, reused Map/array of callbacks) so an ordinary re-render neither
 * clears the item registry nor resets the tracked focus index. After arrowing
 * to item 2, item 2 stays the tab anchor (tabIndex 0) across re-renders.
 */

import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

afterEach(cleanup);

const ITEMS = ['Aldric', 'Mira', 'Borin', 'Kesh'];

let forceRerender: () => void;

const Grid: React.FC = () => {
    const [, setTick] = useState(0);
    forceRerender = () => setTick(t => t + 1);
    const { getRovingProps } = useRovingTabIndex({ columns: 1, direction: 'both' });
    return (
        <div>
            {ITEMS.map((label, i) => (
                <button key={label} data-testid={`item-${i}`} {...getRovingProps(i)}>
                    {label}
                </button>
            ))}
        </div>
    );
};

const item = (i: number) => screen.getByTestId(`item-${i}`) as HTMLButtonElement;

describe('wp-e-app-shell #103 — roving tabindex survives re-renders', () => {
    it('keeps the arrowed-to item as the tab anchor across subsequent renders', () => {
        render(<Grid />);

        // Arrow from item 0 down to item 2.
        fireEvent.keyDown(item(0), { key: 'ArrowDown' });
        fireEvent.keyDown(item(1), { key: 'ArrowDown' });
        expect(item(2).tabIndex).toBe(0);
        expect(item(0).tabIndex).toBe(-1);

        // Two ordinary re-renders (exactly what the autosave 'saving'/'saved'
        // store notifications cause).
        act(() => { forceRerender(); });
        act(() => { forceRerender(); });

        expect(item(2).tabIndex).toBe(0);
        expect(item(0).tabIndex).toBe(-1);
    });

    it('keeps the item registry populated so arrow keys still work after a re-render', () => {
        render(<Grid />);

        act(() => { forceRerender(); });

        fireEvent.keyDown(item(0), { key: 'End' });
        // End moves to the last registered item — if the registry was wiped and
        // only partially rebuilt, focus lands on the wrong element.
        expect(document.activeElement).toBe(item(ITEMS.length - 1));
    });
});
