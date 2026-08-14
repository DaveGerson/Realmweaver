import { useState, useMemo, useDeferredValue } from 'react';

/**
 * Case-insensitive substring search across multiple fields of an entity array.
 *
 * The generic is intentionally wide so dashboards can search on entity-specific
 * fields (e.g. `description`, `goals`, `traits`) without TypeScript complaining.
 *
 * `useDeferredValue` is used on the search term so that the filter computation
 * is deferred during rapid keystrokes, keeping the input responsive.
 *
 * Usage:
 *   const { filteredEntities, searchTerm, setSearchTerm } = useEntitySearch(npcs, ['name', 'description', 'traits']);
 */
export function useEntitySearch<T extends { id: string; name: string; [key: string]: any }>(
  entities: T[],
  searchFields: string[],
): {
  filteredEntities: T[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
} {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Finding #59: every call site passes an inline array literal
  // (`useEntitySearch(npcs, ['name', 'description', 'traits'])`), so a fresh
  // array is allocated on every render and the memo below never hit its
  // cache if keyed on `searchFields` identity. Key on the field NAMES
  // instead — an equal-but-new array reuses the memoised filter result.
  const fieldKey = searchFields.join(',');

  const filteredEntities = useMemo(() => {
    const trimmed = deferredSearchTerm.trim().toLowerCase();
    if (!trimmed) return entities;
    const fields = fieldKey ? fieldKey.split(',') : [];
    return entities.filter(entity => {
      return fields.some(field => {
        const value = entity[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(trimmed);
      });
    });
  }, [entities, fieldKey, deferredSearchTerm]);

  return { filteredEntities, searchTerm, setSearchTerm };
}
