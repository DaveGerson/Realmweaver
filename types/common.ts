
// types/common.ts
// Shared interfaces used across multiple entity types.

export type HistoryReferenceType = 'session' | 'article' | 'manual';

export interface HistoryEntry {
  id: string;
  summary: string;
  referenceType: HistoryReferenceType;
  referenceId?: string;
}
