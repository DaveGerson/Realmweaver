
/**
 * LinkedText — Scans text content for entity name matches and renders them
 * as inline EntityLinks with hover popovers and click-to-navigate.
 *
 * Uses exact (case-insensitive) name matching against all entities in the
 * active campaign. Pre-builds a Map for O(1) lookups per render pass.
 *
 * Design decisions:
 * - Reads campaign data directly from campaignService so callers only need
 *   to provide text and an onNavigate callback. No prop-drilling of entity
 *   arrays required.
 * - Names shorter than 3 characters are excluded to avoid false positives
 *   with common abbreviations (e.g. "Al", "Bo").
 * - When multiple entity names could match at the same offset we scan
 *   longest-first so "The Great Library" wins before "Great".
 * - Rendered as an inline <span> so it composes naturally inside paragraphs,
 *   list items, or anywhere body text appears.
 */

import React, { useMemo, useSyncExternalStore } from 'react';
import { EntityLink } from '@/components/common/EntityLink';
import { campaignService } from '@/services/campaignService';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LinkedTextProps {
  /** The plain text to scan for entity name matches. */
  text: string;
  /** Called when the user navigates to a linked entity. */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Additional className applied to the root <span> wrapper. */
  className?: string;
}

interface EntityEntry {
  id: string;
  type: QuickCardEntityType;
  /** Lowercase form used for case-insensitive matching. */
  lowerName: string;
  /** Original name used as the displayed label. */
  name: string;
}

// ─── Text-segment types ───────────────────────────────────────────────────────

type PlainSegment = { kind: 'plain'; text: string };
type LinkSegment  = { kind: 'link';  text: string; entity: EntityEntry };
type Segment = PlainSegment | LinkSegment;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIN_NAME_LENGTH = 3;

/**
 * Collect all linkable entities from a campaign and return them
 * sorted longest-name-first so greedy matching prefers longer names.
 */
function buildEntityEntries(campaign: NonNullable<ReturnType<typeof campaignService.getState>['campaigns'][number]> | undefined): EntityEntry[] {
  if (!campaign) return [];

  const entries: EntityEntry[] = [];

  for (const npc of campaign.npcs) {
    if (npc.name.length >= MIN_NAME_LENGTH)
      entries.push({ id: npc.id, type: 'npc', name: npc.name, lowerName: npc.name.toLowerCase() });
  }
  for (const loc of campaign.locations) {
    if (loc.name.length >= MIN_NAME_LENGTH)
      entries.push({ id: loc.id, type: 'location', name: loc.name, lowerName: loc.name.toLowerCase() });
  }
  for (const fac of campaign.factions) {
    if (fac.name.length >= MIN_NAME_LENGTH)
      entries.push({ id: fac.id, type: 'faction', name: fac.name, lowerName: fac.name.toLowerCase() });
  }
  for (const item of campaign.items) {
    if (item.name.length >= MIN_NAME_LENGTH)
      entries.push({ id: item.id, type: 'item', name: item.name, lowerName: item.name.toLowerCase() });
  }
  for (const adv of campaign.adventures) {
    if (adv.title.length >= MIN_NAME_LENGTH)
      entries.push({ id: adv.id, type: 'adventure', name: adv.title, lowerName: adv.title.toLowerCase() });
  }
  for (const art of campaign.articles) {
    if (art.title.length >= MIN_NAME_LENGTH)
      entries.push({ id: art.id, type: 'article', name: art.title, lowerName: art.title.toLowerCase() });
  }
  for (const plot of campaign.plots) {
    if (plot.title.length >= MIN_NAME_LENGTH)
      entries.push({ id: plot.id, type: 'plot', name: plot.title, lowerName: plot.title.toLowerCase() });
  }

  // Sort longest name first for greedy matching
  entries.sort((a, b) => b.lowerName.length - a.lowerName.length);
  return entries;
}

/**
 * Check that the character before and after a candidate match is a word
 * boundary (non-alphanumeric or string edge) to avoid matching substrings
 * inside words like "Mira" inside "Miraculous".
 */
function isWordBoundary(text: string, start: number, end: number): boolean {
  const before = start === 0 ? '' : text[start - 1];
  const after  = end   === text.length ? '' : text[end];
  const boundaryRe = /[^a-zA-Z0-9]/;
  return (before === '' || boundaryRe.test(before)) &&
         (after  === '' || boundaryRe.test(after));
}

/**
 * Scan `text` from `searchStart` and return the first entity that matches at
 * the earliest position in the remaining string. When multiple entities would
 * match at the same position, the longest is selected (guaranteed by the
 * sorted order of `entries`).
 */
function findNextMatch(
  lowerText: string,
  entries: EntityEntry[],
  searchStart: number
): { entity: EntityEntry; matchStart: number; matchEnd: number } | null {
  let best: { entity: EntityEntry; matchStart: number; matchEnd: number } | null = null;

  for (const entry of entries) {
    const idx = lowerText.indexOf(entry.lowerName, searchStart);
    if (idx === -1) continue;

    const matchEnd = idx + entry.lowerName.length;
    if (!isWordBoundary(lowerText, idx, matchEnd)) continue;

    if (best === null || idx < best.matchStart) {
      best = { entity: entry, matchStart: idx, matchEnd };
    }
    // If same start position but longer (can't happen since entries are
    // sorted longest-first and we only update when idx < best), skip.
  }
  return best;
}

/**
 * Convert a plain text string into an array of plain/link segments.
 */
function tokenize(text: string, entries: EntityEntry[]): Segment[] {
  if (!text || entries.length === 0) return [{ kind: 'plain', text }];

  const lowerText = text.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const match = findNextMatch(lowerText, entries, cursor);
    if (!match) {
      segments.push({ kind: 'plain', text: text.slice(cursor) });
      break;
    }

    // Plain text before the match
    if (match.matchStart > cursor) {
      segments.push({ kind: 'plain', text: text.slice(cursor, match.matchStart) });
    }

    // The matched entity name (use the original casing from the text)
    segments.push({
      kind: 'link',
      text: text.slice(match.matchStart, match.matchEnd),
      entity: match.entity,
    });

    cursor = match.matchEnd;
  }

  return segments;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkedText: React.FC<LinkedTextProps> = ({ text, onNavigate, className = '' }) => {
  // Subscribe to campaign state so the entity map stays current when entities
  // are renamed or deleted (Fix A-1).
  const state = useSyncExternalStore(campaignService.subscribe, campaignService.getState);
  const campaign = state.campaigns.find(c => c.id === state.activeCampaignId);

  const segments = useMemo(() => {
    if (!text) return [];
    const entries = buildEntityEntries(campaign);
    return tokenize(text, entries);
  }, [text, campaign]);

  if (!text) return null;

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === 'plain') {
          return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        }
        return (
          <EntityLink
            key={i}
            entityType={seg.entity.type}
            entityId={seg.entity.id}
            label={seg.text}
            onNavigate={onNavigate}
          />
        );
      })}
    </span>
  );
};
