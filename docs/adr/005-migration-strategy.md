# ADR-005: localStorage → Cloud Migration Strategy

## Status
PENDING — requires user input

## Context
Existing users have campaigns in localStorage. When they create a cloud account, their local data must transfer safely. Data loss during migration is unacceptable.

## Options Considered

| Strategy | User Experience | Risk | Complexity | Rollback |
|----------|---------------|------|-----------|----------|
| **Big-bang** (migrate all at once) | Simple but slow for many campaigns | High (all-or-nothing) | Low | Hard |
| **Per-campaign** (migrate one at a time) | More control, can test with one first | Low (isolated failures) | Medium | Easy per-campaign |
| **Dual-write** (write to both for N days) | Seamless but wasteful | Low | High | Automatic |

## Recommendation
**Per-campaign with automatic pre-migration backup**

Three phases:

### Phase 1: Backup
Before any migration begins, automatically trigger a JSON export download of the full localStorage data. This is the user's safety net. The migration wizard won't proceed without a completed backup.

### Phase 2: Per-Campaign Migration
- Show all local campaigns with "Migrate to Cloud" button per campaign
- "Migrate All" button for bulk operation
- Each campaign migrated atomically:
  1. Parse Campaign JSON from localStorage
  2. Create campaign row in Supabase
  3. Insert entities in FK-dependency order:
     - Factions first (no FKs to other entities)
     - NPCs (reference factions)
     - Locations (reference factions, self-referencing parent)
     - Adventures with scenes JSONB
     - Articles, plots, session logs, player characters, secrets, notes
  4. Self-referencing tables (locations, articles) use two-pass insert:
     first pass creates all rows with null parent, second pass updates parent FKs
  5. Verify entity counts match
  6. Mark campaign as "migrated" in localStorage
- **ID preservation:** Keep existing UUIDs where possible. If localStorage IDs aren't valid UUIDs, generate new ones and remap all references.
- **Retry safety:** Idempotent upserts so a failed-and-retried migration doesn't create duplicates.

### Phase 3: Cleanup
- After successful migration, offer "Delete local copies" button
- localStorage data is NEVER deleted automatically
- User must explicitly confirm deletion
- Show "Successfully migrated N campaigns" summary

### Error Handling
- Network failure mid-migration → partial campaign in cloud is marked `migrating` status → resume picks up from last successful entity
- Validation errors (corrupt entity data) → skip that entity, log it, show to user after migration
- Quota errors (Supabase free tier limit) → stop migration, show remaining campaigns, suggest upgrade

## Decision
PENDING

## Open Questions
1. Should the pre-migration backup download be mandatory-blocking or skippable?
2. Should a campaign be accessible in both cloud and localStorage simultaneously (risk of divergence)?
3. Should migrated campaigns show a "Migrated" badge in the Cross-Campaign Dashboard?

## Consequences
If adopted: Migration wizard UI, backup download trigger, atomic per-campaign migration with FK ordering, two-pass insert for self-referencing tables, explicit cleanup confirmation
