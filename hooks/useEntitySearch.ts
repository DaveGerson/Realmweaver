import { useState, useMemo } from 'react';

/**
 * Case-insensitive substring search across multiple fields of an entity array.
 *
 * The generic is intentionally wide so dashboards can search on entity-specific
 * fields (e.g. `description`, `goals`, `traits`) without TypeScript complaining.
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

  const filteredEntities = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return entities;
    return entities.filter(entity => {
      return searchFields.some(field => {
        const value = entity[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(trimmed);
      });
    });
  }, [entities, searchFields, searchTerm]);

  return { filteredEntities, searchTerm, setSearchTerm };
}
