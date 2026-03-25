import { useState, useMemo } from 'react';

/**
 * Case-insensitive substring search across multiple fields of an entity array.
 *
 * Usage:
 *   const { filteredEntities, searchTerm, setSearchTerm } = useEntitySearch(npcs, ['name', 'description', 'traits']);
 */
export function useEntitySearch<T extends { id: string; name: string }>(
  entities: T[],
  searchFields: (keyof T)[],
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
