# ADR-003: Authentication Flow

## Status
PENDING — requires user input

## Context
The TTRPG community is heavily centered on Discord. Auth must be low-friction for this demographic while supporting users who don't have Discord.

## Options Considered

| Method | Friction | Security | Community Fit | Implementation |
|--------|---------|----------|--------------|---------------|
| **Email + password** | High (password management) | Good | Neutral | Simple |
| **Discord OAuth** | Low (most DMs have Discord) | Good | Excellent | Supabase native |
| **Google OAuth** | Low | Good | Good | Supabase native |
| **Magic link (email)** | Medium (check inbox) | Good | Neutral | Supabase native |
| **All of the above** | Lowest (user choice) | Good | Best | More UI work |

## Recommendation
**Discord OAuth primary + Google OAuth secondary + Magic link fallback**

- Discord: the TTRPG community's home platform, lowest friction
- Google: universal fallback for non-Discord users
- Magic link: passwordless, covers edge cases (no social accounts)
- "Continue as Guest": permanently available, routes to localStorage-only mode

Email+password explicitly rejected — too much friction for this demographic.

## Decision
PENDING

## Open Questions
1. Discord + Google + magic link confirmed, or different provider set?
2. Is "Continue as Guest" a permanent option or just for onboarding?
3. Should guest campaigns be migrateable to cloud after login?

## Consequences
If adopted: Supabase Auth with 3 providers, login page component, auth context, "Continue as Guest" route, profile dropdown in header
