// @vitest-environment jsdom
/**
 * Final-review finding: the editors' mention-field debounce was keyed by
 * field name only and its unmount flush captured the mount-time entity id.
 * Editors are not remounted when navigating between entities of the same
 * type, so a pending edit could be written onto the WRONG entity or be
 * silently cancelled by the first keystroke into the next entity.
 *
 * useDebouncedFieldCommit owns this now: pending edits belong to the id they
 * were typed against, are flushed when the entity changes, and unmount
 * flushes against the id current at unmount rather than mount time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedFieldCommit } from '../../hooks/useDebouncedFieldCommit';

describe('useDebouncedFieldCommit', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('commits a debounced edit against the entity it was typed on, not the current one', () => {
        const onUpdate = vi.fn();
        const { result, rerender } = renderHook(
            ({ id }) => useDebouncedFieldCommit<{ description: string }>(id, onUpdate),
            { initialProps: { id: 'npc-a' } },
        );

        act(() => result.current.commit('description', 'text for A'));
        // Entity switches before the 400ms window elapses.
        rerender({ id: 'npc-b' });

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith('npc-a', { description: 'text for A' });

        // The old timer must not fire a duplicate/misdirected write later.
        act(() => void vi.advanceTimersByTime(1000));
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('does not let a keystroke on the new entity cancel the previous entity\'s pending edit', () => {
        const onUpdate = vi.fn();
        const { result, rerender } = renderHook(
            ({ id }) => useDebouncedFieldCommit<{ description: string }>(id, onUpdate),
            { initialProps: { id: 'npc-a' } },
        );

        act(() => result.current.commit('description', 'A edit'));
        rerender({ id: 'npc-b' });
        act(() => result.current.commit('description', 'B edit'));
        act(() => void vi.advanceTimersByTime(500));

        expect(onUpdate).toHaveBeenNthCalledWith(1, 'npc-a', { description: 'A edit' });
        expect(onUpdate).toHaveBeenNthCalledWith(2, 'npc-b', { description: 'B edit' });
    });

    it('unmount flushes against the id current at unmount, not mount time', () => {
        const onUpdate = vi.fn();
        const { result, rerender, unmount } = renderHook(
            ({ id }) => useDebouncedFieldCommit<{ description: string }>(id, onUpdate),
            { initialProps: { id: 'npc-a' } },
        );

        rerender({ id: 'npc-b' });
        act(() => result.current.commit('description', 'text for B'));
        unmount();

        expect(onUpdate).toHaveBeenCalledWith('npc-b', { description: 'text for B' });
        expect(onUpdate).not.toHaveBeenCalledWith('npc-a', expect.anything());
    });

    it('batches multiple pending fields into a single flush write', () => {
        const onUpdate = vi.fn();
        const { result, unmount } = renderHook(
            () => useDebouncedFieldCommit<{ traits: string; secrets: string }>('npc-a', onUpdate),
        );

        act(() => {
            result.current.commit('traits', 'gruff');
            result.current.commit('secrets', 'is a mimic');
        });
        unmount();

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith('npc-a', { traits: 'gruff', secrets: 'is a mimic' });
    });
});
