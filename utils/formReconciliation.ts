/**
 * formReconciliation.ts
 *
 * Shared helper for editor components that mirror an entity prop into local
 * form state (`formData`) so unblurred keystrokes aren't committed on every
 * render.
 */

/**
 * Reconciles a locally-edited form state (`prev`) with a freshly-arrived entity
 * prop (`incoming`), given the last entity snapshot we reconciled against
 * (`prevSeen`).
 *
 * Naively resetting `formData` whenever the entity prop changes silently
 * discards in-progress edits: an async action (AI generation, bidirectional
 * relationship sync, etc.) can mutate the same entity elsewhere while the user
 * is still typing, producing a new prop reference before the user has blurred
 * the field.
 *
 * This merges field-by-field instead: a field is only overwritten with the
 * incoming value if it still matches what we last saw (i.e. the user hasn't
 * started editing it since); any field where the user has an uncommitted local
 * edit is preserved. Switching to a different entity (`id` changed) always
 * fully adopts the incoming entity.
 */
export function reconcileEntityFormData<T extends { id: string }>(prev: T, prevSeen: T, incoming: T): T {
  if (prevSeen.id !== incoming.id) {
    return incoming;
  }
  const merged = { ...prev };
  (Object.keys(incoming) as (keyof T)[]).forEach((key) => {
    if (prev[key] === prevSeen[key]) {
      merged[key] = incoming[key];
    }
  });
  return merged;
}
