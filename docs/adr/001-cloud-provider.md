# ADR-001: Cloud Provider Selection

## Status
PENDING — requires user input

## Context
Phase G requires a cloud backend for auth, data persistence, real-time sync, and sharing. The provider choice affects every subsequent implementation decision.

## Options Considered

| Provider | Data Model | Auth | Offline | Self-Host | Pricing | Maturity |
|----------|-----------|------|---------|-----------|---------|----------|
| **Supabase** | PostgreSQL (relational, FK, JOIN) | Native Discord OAuth, Google, magic link | Via client-side cache + queue | Yes (Docker) | Free: 500MB, 50K MAU | Mature, growing fast |
| **Firebase** | Firestore (document/NoSQL) | Excellent auth SDK, Discord via custom | Built-in offline persistence | No | Free: 1GB, generous reads | Battle-tested, huge ecosystem |
| **PocketBase** | SQLite | Basic OAuth | Manual | Yes (single binary) | Free (self-hosted) | Early, small community |

## Recommendation
**Supabase** — PostgreSQL's relational model fits Realmweaver's entity relationships naturally (NPC→Faction FK, Scene→Location FK, etc.). Table-level Row-Level Security enables per-campaign access control and the Player Portal visibility filter. Native Discord OAuth aligns with the TTRPG community. Self-hosting option provides an escape hatch.

Firebase's better offline SDK is the meaningful concession. PocketBase is rejected for lack of managed hosting.

## Decision
PENDING

## Open Questions
1. Managed Supabase or self-hosted?
2. Budget for paid tier (Pro = $25/mo for 8GB, 100K MAU)?
3. Is Firebase still viable if Discord OAuth requires a workaround (custom auth)?

## Consequences
If adopted: PostgreSQL schema, Supabase client SDK, RLS policies, Supabase Auth
