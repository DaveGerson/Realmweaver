# Execution Plan: Phase G — Cloud & Collaboration

> **Priority:** 4 (after Phase F, all local features complete)
> **Predecessor:** Phases A-F complete, E2E test coverage, code review pass
> **Estimated duration:** 4-6 weeks
> **Risk Level:** HIGH (architectural change, data migration, auth, external services)
> **Note:** This phase requires **design decisions before implementation**. The plan below
> includes decision points that need user input.

---

## Phase Overview

Phase G transforms Realmweaver from a local-only SPA into a cloud-synced application
with multi-device access and player sharing. This is the biggest architectural change
in the project's history.

| Step | What | Effort | Risk |
|------|------|--------|------|
| G0 | Architecture Planning & Decisions | Medium | LOW |
| G1 | Cloud Infrastructure Setup | Large | HIGH |
| G2 | User Authentication | Large | HIGH |
| G3 | Cloud Database & Sync | Large | HIGH |
| G4 | localStorage → Cloud Migration | Medium | HIGH |
| G5 | Player Portal (read-only) | Medium | MEDIUM |
| G6 | GM Secrets System | Medium | MEDIUM |
| G7 | Interactive World Map | Large | MEDIUM |

---

## Step G0: Architecture Planning & Decisions

**Agent:** architect
**Depends on:** None (this is the prerequisite for everything)
**Output:** Architecture Decision Records (ADRs) in `docs/adr/`

### DECISION 1: Cloud Provider

| Option | Pros | Cons |
|--------|------|------|
| **Supabase** | PostgreSQL (relational, good for entity refs), Row-Level Security, real-time subscriptions, generous free tier, self-hostable | Less mature than Firebase, smaller ecosystem |
| **Firebase** | Battle-tested, Firestore offline-first, Firebase Auth is excellent, huge ecosystem | NoSQL (document-based — entity relationships need denormalization), vendor lock-in, no self-hosting |
| **PocketBase** | Single binary, SQLite-based, self-hostable, simple API | Less mature, no managed hosting, smaller community |

**Recommendation:** Supabase — PostgreSQL handles entity relationships naturally (foreign keys for NPC→Faction, Scene→Location, etc.), Row-Level Security enables per-campaign access control, and real-time subscriptions enable future collaboration features.

**Needs user input:** Which provider? Any self-hosting requirement?

### DECISION 2: Offline-First Strategy

| Option | Pros | Cons |
|--------|------|------|
| **Cloud-primary, local cache** | Simple conflict resolution (server wins), always-consistent | Requires internet for changes, bad offline |
| **Local-first, sync to cloud** | Full offline support, works like current app | Complex conflict resolution, merge logic |
| **CRDT-based (Automerge/Yjs)** | Automatic conflict resolution, real-time collab | Heavy library, complex to retrofit, overkill for single-GM |

**Recommendation:** Local-first with cloud sync. The current app is fully localStorage-based and DMs run sessions offline (at tables without WiFi). Sync uses last-write-wins at the entity level (not field-level) with conflict detection UI for rare cases.

**Needs user input:** Is offline support critical? Or is cloud-primary acceptable?

### DECISION 3: Auth Flow

| Option | Pros | Cons |
|--------|------|------|
| **Email + password** | Universal, simple | Password management burden |
| **OAuth only (Google/Discord)** | No password management, TTRPG community uses Discord heavily | Requires third-party dependency |
| **Magic link (email)** | Passwordless, simple UX | Slower login, email deliverability issues |
| **All of the above** | Maximum flexibility | More implementation work |

**Recommendation:** Discord OAuth primary + Google OAuth secondary + magic link fallback. Discord is where the TTRPG community lives.

**Needs user input:** Which OAuth providers?

### DECISION 4: Data Model

**Current model (localStorage):**
```
Campaign {
  id, title, setting, npcs[], locations[], factions[], items[],
  adventures[{ scenes[] }], articles[], sessionLogs[], plots[],
  playerCharacters[], notes[], secrets[], pinnedEntities[],
  activeEncounter?, dmStyle, featureOverrides, styleProfile
}
```

**Cloud model options:**
- **Flat tables:** campaigns, npcs, locations, factions (each row has campaign_id FK). Good for queries, joins, RLS. More migration work.
- **JSON column:** campaigns table with a `data JSONB` column. Easy migration (dump localStorage JSON). Hard to query/index individual entities. Limited RLS granularity.
- **Hybrid:** Core fields as columns, nested arrays as JSONB. Balance of query-ability and simplicity.

**Recommendation:** Flat tables for top-level entities (NPCs, locations, factions, adventures, items, articles, plots, session logs, player characters, secrets). JSONB for deeply nested data (scenes within adventures, skill checks within scenes, structured notes within session logs). This enables:
- Per-entity RLS (player sees only entities GM marks as visible)
- Efficient queries ("all NPCs in faction X")
- Manageable migration (one campaign → N entity rows)

**Needs user input:** Flat vs JSONB vs hybrid?

### Deliverables
- `docs/adr/001-cloud-provider.md`
- `docs/adr/002-sync-strategy.md`
- `docs/adr/003-auth-flow.md`
- `docs/adr/004-data-model.md`
- `docs/adr/005-migration-strategy.md`
- Updated `CLAUDE.md` with cloud architecture section

---

## Step G1: Cloud Infrastructure Setup

**Agent:** devops-engineer + backend-engineer
**Depends on:** G0 (decisions made)

### Deliverables (assuming Supabase)
- Supabase project created
- Database schema designed and applied (migrations)
- Row-Level Security policies
- Environment variable configuration (`.env.local` + production)
- Supabase client SDK installed and configured
- New `services/supabaseClient.ts` — singleton client
- New `services/cloudService.ts` — CRUD operations wrapping Supabase

### Database Schema (Flat Tables)

```sql
-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  discord_id text,
  created_at timestamptz default now()
);

-- Campaigns
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  setting text,
  setting_type text default 'custom',
  official_setting text,
  dm_style text default 'standard',
  style_profile text,
  feature_overrides jsonb default '{}',
  pinned_entities jsonb default '[]',
  active_encounter jsonb,
  active_scene_id text,
  active_session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NPCs (example — same pattern for locations, factions, items, etc.)
create table npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  description text,
  traits text,
  motivations text,
  secrets text,
  backstory text,
  example_quote text,
  stats text,
  faction_id uuid references factions(id) on delete set null,
  relationships jsonb default '[]',
  history jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Adventures (scenes stored as JSONB array)
create table adventures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  hook text,
  theme text,
  scenes jsonb default '[]',  -- Scene[] stored as JSONB
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Similar tables for: locations, factions, items, articles,
-- session_logs, plots, player_characters, secrets, notes
```

### RLS Policies
```sql
-- Users can only see their own campaigns
create policy "Users see own campaigns"
  on campaigns for select using (user_id = auth.uid());

-- Users can only modify their own campaigns
create policy "Users modify own campaigns"
  on campaigns for all using (user_id = auth.uid());

-- Entities scoped to campaigns the user owns
create policy "Users see own NPCs"
  on npcs for select using (
    campaign_id in (select id from campaigns where user_id = auth.uid())
  );
```

---

## Step G2: User Authentication

**Agent:** frontend-engineer--realmweaver + security-reviewer
**Depends on:** G1

### Deliverables
- Login page component (`components/views/LoginPage.tsx`)
- Auth context/hook (`services/authService.ts`)
- Discord OAuth integration
- Google OAuth integration
- Magic link email fallback
- Session persistence (Supabase handles JWT refresh)
- Protected routes (redirect to login if not authenticated)
- Profile dropdown in header (avatar, name, logout)
- "Continue as Guest" option (localStorage-only mode for offline/demo)

---

## Step G3: Cloud Database & Sync

**Agent:** frontend-engineer--realmweaver + backend-engineer
**Depends on:** G1, G2

### Deliverables

The critical engineering challenge: making `campaignService` work with both localStorage (offline/guest) and Supabase (cloud/authenticated).

### Approach: Adapter Pattern

```typescript
interface StorageAdapter {
  loadCampaigns(): Promise<Campaign[]>;
  saveCampaign(campaign: Campaign): Promise<void>;
  deleteCampaign(id: string): Promise<void>;
  // Entity-level operations for cloud (more efficient than saving whole campaign)
  createEntity(campaignId: string, type: string, data: any): Promise<string>;
  updateEntity(campaignId: string, type: string, id: string, data: any): Promise<void>;
  deleteEntity(campaignId: string, type: string, id: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter { ... }
class SupabaseAdapter implements StorageAdapter { ... }
```

`campaignService` gets an adapter injected at startup based on auth state:
- Authenticated → SupabaseAdapter (with localStorage cache for offline)
- Guest → LocalStorageAdapter (current behavior)

### Sync Strategy
- **Online:** Writes go to Supabase immediately, update local cache
- **Offline:** Writes go to localStorage, queue for sync
- **Reconnect:** Replay queued operations, last-write-wins at entity level
- **Conflict detection:** If server entity `updated_at` > local `updated_at`, show conflict UI

---

## Step G4: localStorage → Cloud Migration

**Agent:** frontend-engineer--realmweaver
**Depends on:** G2, G3

### Deliverables
- Migration wizard shown to authenticated users with existing localStorage data
- Scans localStorage for `realmweaver-campaigns` key
- Shows list of local campaigns with entity counts
- "Migrate to Cloud" button per campaign (or "Migrate All")
- Transforms Campaign JSON → individual entity rows in Supabase
- Generates UUIDs for all entities (localStorage uses simple IDs)
- Updates internal references (factionId, locationId, etc.) to new UUIDs
- After successful migration, offers to clear localStorage
- Handles partial failures gracefully (atomic per-campaign)

---

## Step G5: Player Portal (Read-Only)

**Agent:** frontend-engineer--realmweaver
**Depends on:** G2, G3

### Deliverables
- Share link generation: `/campaign/{id}/player` (or token-based URL)
- Read-only view showing only GM-approved entities
- New `visibility` field on entities: 'gm-only' | 'player-visible'
- Toggle in entity editors: "Visible to Players" switch
- Player portal layout: campaign title, visible NPCs, locations, active adventure
- No edit capabilities, no secrets, no GM notes
- Session recap visible (player-facing version)
- Works without authentication (share link = access token)

---

## Step G6: GM Secrets System

**Agent:** frontend-engineer--realmweaver
**Depends on:** G5

### Deliverables
- Extend entity visibility beyond binary (gm-only/player-visible):
  - Per-field visibility: NPC description visible but motivations hidden
  - Secret sections: collapsible "GM Only" blocks in player view
- "Reveal" action: GM can reveal a secret during play (moves to player-visible)
- Integrates with existing Secrets & Clues tracker
- Session log: player-facing recap auto-strips secrets

---

## Step G7: Interactive World Map

**Agent:** visualization-expert + frontend-engineer--realmweaver
**Depends on:** G3 (needs location data in cloud)

### Deliverables
- Map canvas component using Leaflet.js or custom SVG canvas
- Location nodes positioned by DM (drag-and-drop placement)
- Connection lines between linked locations
- Zoom/pan with touch support
- Location tooltips (EntityQuickCard on hover)
- Click-to-navigate to location editor
- Player-visible map (filtered by visibility settings)
- Optional background image upload (DM's world map)
- Map state persisted in campaign (node positions)

### Design Decision
**Canvas library:** Leaflet (tile-based, good for large maps with zoom) vs React Flow (already in project, node-based) vs custom SVG (full control, no new deps).

**Recommendation:** React Flow — it's already installed, handles node positioning, zoom/pan, and we can reuse skills from the relationship graph. Add a "Map" layout mode alongside the existing force-directed relationship layout.

---

## Execution Sequence

```
G0 (Architecture Decisions) ──── [BLOCKING — needs user input]
         ↓
G1 (Infrastructure Setup) ────── [sequential]
         ↓
G2 (Authentication) ──────────── [sequential, depends on G1]
         ↓
G3 (Database & Sync) ─────┐
G4 (Migration Wizard)     ──┤ [G3 first, then G4]
                            ↓
                     GATE 1 (core cloud works)
                            ↓
G5 (Player Portal) ──────┐
G6 (GM Secrets)           ──┤ [parallel, G6 extends G5]
                            ↓
                     GATE 2 (sharing works)
                            ↓
G7 (World Map) ────────────── [independent, last]
                            ↓
                     FINAL GATE
```

## Gate Criteria

### Gate 1 (Core Cloud)
- User can sign up, log in (Discord + Google + magic link)
- Campaigns sync to Supabase in real-time
- Offline mode works (localStorage fallback)
- Migration wizard transfers localStorage campaigns to cloud
- Existing app functionality unchanged for guest users
- RLS prevents cross-user data access

### Gate 2 (Sharing)
- Player portal renders shared campaigns read-only
- GM can toggle entity visibility
- Secrets hidden from player view
- Share links work without auth

### Final Gate
- World map renders locations with connections
- Map positions persist
- All E2E tests pass
- No regression in offline/guest mode
- Security review passes (auth, RLS, data isolation)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Data loss during migration** | Backup localStorage before migration, atomic per-campaign, rollback capability |
| **Auth token expiry** | Supabase handles JWT refresh, add retry logic in adapter |
| **Offline→online sync conflicts** | Last-write-wins with conflict detection UI for edge cases |
| **RLS bypass** | Security review after G3, penetration testing |
| **Large campaign sync performance** | Batch entity operations, pagination, optimistic UI updates |
| **Feature regression** | Full E2E suite runs before and after each step |

---

## Open Questions for User

These must be answered before G0 can produce ADRs:

1. **Cloud provider preference?** Supabase (recommended) vs Firebase vs PocketBase vs other?
2. **Is offline support critical?** Or is cloud-primary acceptable?
3. **OAuth providers?** Discord + Google (recommended) or others?
4. **Self-hosting requirement?** Will this be deployed to a managed service or self-hosted?
5. **Player sharing scope?** Read-only portal? Or eventual collaborative editing?
6. **Budget constraints?** Supabase free tier supports ~500MB database + 50K monthly active users. Sufficient for launch?
7. **World map priority?** Is G7 a must-have or nice-to-have? Could be deferred to Phase H.
