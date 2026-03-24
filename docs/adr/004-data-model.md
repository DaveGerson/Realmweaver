# ADR-004: Cloud Data Model

## Status
PENDING — requires user input

## Context
The current Campaign type is a deeply nested JSON object stored as a single localStorage entry. Moving to cloud requires deciding how to map this to a database schema.

## Options Considered

| Approach | Query Power | Migration | RLS Granularity | Performance |
|----------|-----------|-----------|----------------|------------|
| **Flat tables** (1 per entity type) | Full SQL (JOIN, WHERE, INDEX) | High effort (denormalize) | Per-entity | Best |
| **JSON column** (campaign.data JSONB) | Limited (JSONB operators) | Low effort (dump JSON) | Per-campaign only | Worst for large campaigns |
| **Hybrid** (flat top-level, JSONB nested) | Good balance | Medium | Per-entity for top-level | Good |

## Recommendation
**Hybrid: 14 flat tables + JSONB for nested sub-entities**

Top-level flat tables (each has its own editor, dashboard, and RLS need):
- `users`, `campaigns`, `npcs`, `locations`, `factions`, `items`
- `adventures`, `articles`, `session_logs`, `player_characters`
- `plots`, `notes`, `secrets`, `encounters`

JSONB columns for data that is never independently queried:
- `adventures.scenes` — Scene[] (scenes are always accessed via their adventure)
- `session_logs.structured_notes` — StructuredNote[]
- `session_logs.beats` — Beat[]
- `npcs.relationships` — EntityRelationship[]
- `npcs.history` — HistoryEntry[]
- `locations.points_of_interest` — PointOfInterest[]

### Proposed Schema (Key Tables)

```sql
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  setting text,
  setting_type text default 'custom',
  dm_style text default 'standard',
  style_profile text,
  feature_overrides jsonb default '{}',
  pinned_entities jsonb default '[]',
  active_scene_id uuid,
  active_session_id uuid,
  wizard_dismissed boolean default false,
  visible_to_players boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  description text, traits text, motivations text,
  secrets text, backstory text, example_quote text, stats text,
  faction_id uuid references factions(id) on delete set null,
  relationships jsonb default '[]',
  history jsonb default '[]',
  visible_to_players boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Similar pattern for locations, factions, items, articles, etc.
-- Each has: id, campaign_id FK, entity-specific columns,
-- visible_to_players, created_at, updated_at
```

### RLS Pattern
```sql
create policy "users_own_campaigns" on campaigns
  for all using (user_id = auth.uid());

create policy "users_own_entities" on npcs
  for all using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  );

-- Player portal: visible entities only, via share token
create policy "players_see_visible" on npcs
  for select using (
    visible_to_players = true
    and campaign_id in (select id from campaign_shares where token = current_setting('app.share_token'))
  );
```

## Decision
PENDING

## Open Questions
1. Should `scenes` be promoted to a flat table (enables "Scene Library" across adventures)?
2. Should bidirectional mirror arrays (`sub_location_ids`, `member_ids`) be eliminated in favor of JOINs?

## Consequences
If adopted: 14 migration files, StorageAdapter maps Campaign JSON to/from flat rows, RLS policies per table, `visible_to_players` on every entity
