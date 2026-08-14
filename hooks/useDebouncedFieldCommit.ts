import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounced per-field store commits for editors whose fields write through
 * `onUpdate(entityId, updates)` on every keystroke (MentionInput-backed
 * fields). Local component state stays immediate; the store write coalesces.
 *
 * Editors are NOT remounted when the user navigates between entities of the
 * same type (the same mounted editor receives a new entity prop), so a naive
 * field-keyed debounce loses or misdirects edits across that transition:
 * a pending write can fire with the OLD entity's id closed over, or be
 * cancelled by the first keystroke into the NEW entity. This hook owns both
 * hazards:
 *   - pending edits are committed to the id they were typed against,
 *     flushed synchronously when `entityId` changes;
 *   - unmount flushes against the id current at unmount, not mount time.
 */
export function useDebouncedFieldCommit<T>(
    entityId: string,
    onUpdate: (id: string, updates: Partial<T>) => void,
    delayMs = 400,
) {
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const pendingRef = useRef<Record<string, unknown>>({});
    const idRef = useRef(entityId);
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const flush = useCallback(() => {
        Object.values(timersRef.current).forEach(clearTimeout);
        timersRef.current = {};
        const fields = Object.entries(pendingRef.current);
        pendingRef.current = {};
        if (fields.length > 0) {
            onUpdateRef.current(idRef.current, Object.fromEntries(fields) as Partial<T>);
        }
    }, []);

    // Entity switched under the same mounted editor: commit the previous
    // entity's pending edits before any keystroke lands on the new one.
    useEffect(() => {
        if (idRef.current !== entityId) {
            flush();
            idRef.current = entityId;
        }
    }, [entityId, flush]);

    // Real unmount: flush whatever is still pending for the current entity.
    useEffect(() => () => flush(), [flush]);

    const commit = useCallback((field: string, value: unknown) => {
        pendingRef.current[field] = value;
        const timers = timersRef.current;
        if (timers[field]) clearTimeout(timers[field]);
        timers[field] = setTimeout(() => {
            delete timers[field];
            if (field in pendingRef.current) {
                delete pendingRef.current[field];
                onUpdateRef.current(idRef.current, { [field]: value } as Partial<T>);
            }
        }, delayMs);
    }, [delayMs]);

    return { commit, flush };
}
