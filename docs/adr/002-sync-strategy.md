# ADR-002: Sync Strategy

## Status
PENDING — requires user input

## Context
DMs run sessions at tables that may not have reliable WiFi. The current app is fully localStorage-based. The sync strategy determines whether the cloud is the source of truth or a backup.

## Options Considered

| Strategy | Offline Support | Conflict Resolution | Complexity | Migration Effort |
|----------|----------------|-------------------|-----------|-----------------|
| **Cloud-primary, local cache** | Degraded (read-only offline) | Simple (server wins) | Low | Medium |
| **Local-first, cloud sync** | Full (read/write offline) | Medium (last-write-wins + conflict UI) | Medium | Low (preserve current localStorage) |
| **CRDT-based (Automerge/Yjs)** | Full + real-time collab | Automatic | High | High (retrofit entire state layer) |

## Recommendation
**Local-first with cloud sync** — Preserves the current `campaignService.ts` localStorage path entirely. Cloud sync is additive via a `StorageAdapter` interface:

```typescript
interface StorageAdapter {
  loadCampaigns(): Promise<Campaign[]>;
  saveCampaign(campaign: Campaign): Promise<void>;
  createEntity(campaignId, type, data): Promise<string>;
  updateEntity(campaignId, type, id, data): Promise<void>;
  deleteEntity(campaignId, type, id): Promise<void>;
}
```

- `LocalStorageAdapter` — current behavior, zero changes
- `SupabaseAdapter` — cloud operations with IndexedDB offline queue
- Guest users get `LocalStorageAdapter`, authenticated users get `SupabaseAdapter`

Conflict resolution: last-write-wins at entity level (not field-level). Conflict detection when server `updated_at` > local `updated_at`, with a simple "Keep mine / Keep theirs / View diff" UI for rare cases.

## Decision
PENDING

## Open Questions
1. **Is offline support critical?** If DMs always have internet, cloud-primary is simpler.
2. Should a campaign be accessible in both guest and cloud mode simultaneously?

## Consequences
If adopted: StorageAdapter interface, IndexedDB for offline queue, conflict detection UI, `campaignService` refactored to use adapter pattern
