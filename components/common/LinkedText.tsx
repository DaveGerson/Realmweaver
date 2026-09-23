/**
 * LinkedText — Scans text content for entity name matches and renders them
 * as inline EntityLinks with hover popovers and click-to-navigate.
 *
 * Matching is delegated to the shared linking engine
 * (`services/linking/engineRegistry` → `getMatchingEngine()`), the same engine
 * behind SceneSmartLinkBar / LinkSuggestionsPanel / autoLinker, so inline
 * links and "Detected" suggestions can never disagree on the same text
 * (roadmap L7). The engine supplies case-insensitive, Unicode-aware word
 * boundaries, longest-match-first at a shared offset, non-overlapping spans,
 * the 3-character minimum name length, and ambiguity info when several
 * entities share a name.
 *
 * Design decisions:
 * - Reads campaign data directly from campaignService so callers only need
 *   to provide text and an onNavigate callback.
 * - The candidate array is cached per campaign object in a module-level
 *   WeakMap, so every mounted LinkedText for the same campaign hands the
 *   engine the SAME array identity and hits its compiled-index cache —
 *   rendering many paragraphs costs one index build per campaign change, not
 *   one per paragraph or per keystroke.
 * - No `confidence` filtering: every engine match is rendered, exactly as
 *   before the engine unification. Ambiguous matches (two NPCs named
 *   "Marcus") link to the first candidate and get a wavy underline plus a
 *   tooltip naming every candidate.
 * - Rendered as an inline <span> so it composes naturally inside paragraphs.
 */

import React, { useMemo, useSyncExternalStore } from 'react';
import { EntityLink } from '@/components/common/EntityLink';
import { campaignService } from '@/services/campaignService';
import { getMatchingEngine } from '@/services/linking/engineRegistry';
import type {
  EntityCandidate,
  EntityMatch,
  EntityMatchCandidate,
} from '@/services/linking/matchingEngine';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import type { Campaign } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LinkedTextProps {
  /** The plain text to scan for entity name matches. */
  text: string;
  /** Called when the user navigates to a linked entity. */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Additional className applied to the root <span> wrapper. */
  className?: string;
}

type PlainSegment = { kind: 'plain'; text: string };
type LinkSegment = {
  kind: 'link';
  text: string;
  entityId: string;
  entityType: QuickCardEntityType;
  /** Other entities sharing the matched name (empty when unambiguous). */
  alternatives: EntityMatchCandidate[];
};
export type LinkedTextSegment = PlainSegment | LinkSegment;

// ─── Candidates ──────────────────────────────────────────────────────────────

/** Entity types LinkedText links, with a label for ambiguity tooltips. */
const LINKABLE_TYPE_LABEL: Partial<Record<QuickCardEntityType, string>> = {
  npc: 'NPC',
  location: 'Location',
  faction: 'Faction',
  item: 'Item',
  adventure: 'Adventure',
  article: 'Article',
  plot: 'Plot',
};

function isLinkableType(type: string): type is QuickCardEntityType {
  return Object.prototype.hasOwnProperty.call(LINKABLE_TYPE_LABEL, type);
}

const candidateCache = new WeakMap<Campaign, EntityCandidate[]>();
const NO_CANDIDATES: EntityCandidate[] = [];

/**
 * All linkable entities of a campaign as engine candidates. Cached per
 * campaign object (Immer gives the campaign a new identity on every change),
 * so all LinkedText instances share one array and one compiled engine index.
 */
export function getCampaignLinkCandidates(campaign: Campaign | undefined): EntityCandidate[] {
  if (!campaign) return NO_CANDIDATES;
  const cached = candidateCache.get(campaign);
  if (cached) return cached;

  const out: EntityCandidate[] = [];
  for (const e of campaign.npcs ?? []) out.push({ id: e.id, name: e.name, type: 'npc' });
  for (const e of campaign.locations ?? []) out.push({ id: e.id, name: e.name, type: 'location' });
  for (const e of campaign.factions ?? []) out.push({ id: e.id, name: e.name, type: 'faction' });
  for (const e of campaign.items ?? []) out.push({ id: e.id, name: e.name, type: 'item' });
  for (const e of campaign.adventures ?? []) out.push({ id: e.id, name: e.title, type: 'adventure' });
  for (const e of campaign.articles ?? []) out.push({ id: e.id, name: e.title, type: 'article' });
  for (const e of campaign.plots ?? []) out.push({ id: e.id, name: e.title, type: 'plot' });

  candidateCache.set(campaign, out);
  return out;
}

// ─── Segmentation ────────────────────────────────────────────────────────────

/**
 * Convert engine matches into plain/link segments covering all of `text`.
 * Defensive against custom engines: spans are sorted, overlapping or
 * out-of-range spans are dropped, and unknown entity types stay plain text.
 */
export function segmentsFromMatches(text: string, matches: EntityMatch[]): LinkedTextSegment[] {
  const sorted = [...matches].sort((a, b) => a.matchSpan[0] - b.matchSpan[0]);
  const segments: LinkedTextSegment[] = [];
  let cursor = 0;

  for (const m of sorted) {
    const [start, end] = m.matchSpan;
    if (start < cursor || end <= start || end > text.length) continue;
    if (!isLinkableType(m.entityType)) continue;

    if (start > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, start) });
    segments.push({
      kind: 'link',
      text: text.slice(start, end), // original casing from the source text
      entityId: m.entityId,
      entityType: m.entityType,
      alternatives: m.ambiguous
        ? (m.candidates ?? []).filter(c => c.entityId !== m.entityId)
        : [],
    });
    cursor = end;
  }

  if (cursor < text.length) segments.push({ kind: 'plain', text: text.slice(cursor) });
  return segments;
}

function describeCandidate(c: { entityName: string; entityType: string }): string {
  const label = isLinkableType(c.entityType) ? LINKABLE_TYPE_LABEL[c.entityType] : c.entityType;
  return `${c.entityName} (${label})`;
}

function ambiguityTitle(seg: LinkSegment): string {
  const others = seg.alternatives.map(describeCandidate).join(', ');
  return `Ambiguous: ${seg.alternatives.length + 1} entities are named "${seg.text}". ` +
    `Linked to the first; also: ${others}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkedText: React.FC<LinkedTextProps> = ({ text, onNavigate, className = '' }) => {
  // Subscribe to campaign state so links stay current when entities are
  // renamed or deleted (Fix A-1).
  const state = useSyncExternalStore(campaignService.subscribe, campaignService.getState);
  const campaign = state.campaigns.find(c => c.id === state.activeCampaignId);

  const candidates = getCampaignLinkCandidates(campaign);

  const segments = useMemo<LinkedTextSegment[]>(() => {
    if (!text) return [];
    if (candidates.length === 0) return [{ kind: 'plain', text }];
    return segmentsFromMatches(text, getMatchingEngine().findMatches(text, candidates));
  }, [text, candidates]);

  if (!text) return null;

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === 'plain') {
          return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        }
        if (seg.alternatives.length === 0) {
          return (
            <EntityLink
              key={i}
              entityType={seg.entityType}
              entityId={seg.entityId}
              label={seg.text}
              onNavigate={onNavigate}
            />
          );
        }
        // Ambiguous: wavy underline (EntityLink's is dotted) + a tooltip
        // naming every entity that shares the name. No extra text, so the
        // rendered textContent still equals `text`.
        return (
          <span key={i} data-ambiguous="true" title={ambiguityTitle(seg)}>
            <EntityLink
              entityType={seg.entityType}
              entityId={seg.entityId}
              label={seg.text}
              onNavigate={onNavigate}
              className="decoration-wavy decoration-slate-400"
            />
          </span>
        );
      })}
    </span>
  );
};
