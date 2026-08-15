// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #59
 *
 * useEntitySearch's filter useMemo depends on the `searchFields` ARRAY
 * IDENTITY, but every call site passes an inline literal
 * (`useEntitySearch(npcs, ['name', 'description', 'traits'])`). A fresh array
 * is allocated on every render, so the memo never hits: with 400 NPCs the
 * dashboard re-filters 400 entities x 3 String() conversions on every single
 * re-render — including the two store notifications the autosave cycle emits
 * after each keystroke in an editor.
 *
 * Contract: with the same entity array and the same search term, a re-render
 * that passes an EQUAL-BUT-NEW searchFields array must reuse the memoised
 * result (same array reference back out). Hoisting the arrays at the call
 * sites alone does NOT satisfy this — the memo must key on the field NAMES
 * (e.g. `searchFields.join(',')`), which fixes every present and future call
 * site at once.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntitySearch } from '../../hooks/useEntitySearch';

const entities = [
    { id: '1', name: 'Aldric', description: 'A grizzled captain' },
    { id: '2', name: 'Mira', description: 'A quiet alchemist' },
    { id: '3', name: 'Borin', description: 'A dwarven smith' },
];

describe('wp-e-app-shell #59 — the search filter memo must survive an unrelated re-render', () => {
    it('reuses the filtered result when a new-but-equal searchFields array arrives', () => {
        const { result, rerender } = renderHook(
            ({ fields }: { fields: string[] }) => useEntitySearch(entities, fields),
            { initialProps: { fields: ['name', 'description'] } }
        );

        act(() => { result.current.setSearchTerm('al'); });

        const firstResult = result.current.filteredEntities;
        expect(firstResult.map(e => e.id)).toEqual(['1', '2']); // Aldric, alchemist
        // sanity: an actual filter ran, so identity is meaningful
        expect(firstResult).not.toBe(entities);

        // An unrelated store notification re-renders the dashboard, which passes
        // a brand-new inline array literal with identical contents.
        rerender({ fields: ['name', 'description'] });

        expect(result.current.filteredEntities).toBe(firstResult);
    });

    it('still recomputes when the fields actually change', () => {
        const { result, rerender } = renderHook(
            ({ fields }: { fields: string[] }) => useEntitySearch(entities, fields),
            { initialProps: { fields: ['name'] } }
        );

        act(() => { result.current.setSearchTerm('al'); });
        expect(result.current.filteredEntities.map(e => e.id)).toEqual(['1']);

        rerender({ fields: ['name', 'description'] });
        expect(result.current.filteredEntities.map(e => e.id)).toEqual(['1', '2']);
    });
});
