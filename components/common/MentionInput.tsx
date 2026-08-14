
import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { Icons } from '@/components/common/Icons';
import { campaignService } from '@/services/campaignService';
import type { Campaign } from '@/types/index';
import { twMerge } from 'tailwind-merge';

// --- Entity type definitions for the mention system ---

export type MentionEntityType = 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'plot';

export interface MentionCandidate {
  id: string;
  name: string;
  type: MentionEntityType;
}

// --- Visual colour tokens per entity type ---

const ENTITY_TYPE_META: Record<MentionEntityType, {
  label: string;
  badge: string;       // inline badge in the rendered text (bg + text)
  dropdownIcon: string; // icon colour in dropdown
  Icon: React.ElementType;
}> = {
  npc: {
    label: 'NPC',
    badge: 'bg-amber-500/20 text-amber-400',
    dropdownIcon: 'text-amber-400',
    Icon: Icons.NPCs,
  },
  location: {
    label: 'Location',
    badge: 'bg-emerald-500/20 text-emerald-400',
    dropdownIcon: 'text-emerald-400',
    Icon: Icons.MapPin,
  },
  faction: {
    label: 'Faction',
    badge: 'bg-violet-500/20 text-violet-400',
    dropdownIcon: 'text-violet-400',
    Icon: Icons.Factions,
  },
  item: {
    label: 'Item',
    badge: 'bg-sky-500/20 text-sky-400',
    dropdownIcon: 'text-sky-400',
    Icon: Icons.Items,
  },
  adventure: {
    label: 'Adventure',
    badge: 'bg-orange-500/20 text-orange-400',
    dropdownIcon: 'text-orange-400',
    Icon: Icons.Adventures,
  },
  article: {
    label: 'Article',
    badge: 'bg-cyan-500/20 text-cyan-400',
    dropdownIcon: 'text-cyan-400',
    Icon: Icons.Adventures, // Lorebook uses Adventures icon
  },
  plot: {
    label: 'Plot',
    badge: 'bg-yellow-500/20 text-yellow-400',
    dropdownIcon: 'text-yellow-400',
    Icon: Icons.Plot,
  },
};

// --- Helper: parse @mentions and return { text, ids } ---

export interface ParsedMentions {
  mentionedEntityIds: string[];
}

/** Escapes regex special characters so a name can be safely embedded in a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns entity IDs whose `@Name` mention is actually present in `text`, requiring
 * a word boundary after the name so e.g. `@Ann` doesn't falsely match inside `@Anna`.
 *
 * Candidates are resolved longest-name-first and matched spans are consumed
 * (mirroring services/linking/matchingEngine.ts), so a tracked name that is a
 * word-prefix of another mention — e.g. "The Guild" inside
 * "@The Guild of Blades" — is not spuriously credited (finding #101). Genuine
 * separate mentions of both names are still each credited.
 */
export function findMentionedIdsInText(text: string, candidates: { id: string; name: string }[]): string[] {
  const ids: string[] = [];
  const consumed: Array<[number, number]> = [];
  const sorted = candidates.slice().sort((a, b) => b.name.length - a.name.length);

  for (const { id, name } of sorted) {
    // Unicode-aware boundary (matches services/linking/matchingEngine.ts) so a
    // name isn't treated as "ended" by an accented letter (e.g. `@Ann` in `@Annë`).
    const pattern = new RegExp(`@${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'gu');
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      const overlapsConsumed = consumed.some(([cs, ce]) => start < ce && end > cs);
      if (!overlapsConsumed) {
        consumed.push([start, end]);
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}

/** Returns entity IDs currently mentioned in the text, based on the tracked map. */
function extractMentionedIds(text: string, mentionMap: Map<string, string>): string[] {
  const candidates = Array.from(mentionMap.entries()).map(([name, id]) => ({ id, name }));
  return findMentionedIdsInText(text, candidates);
}

/** Builds the flat list of all mentionable entities in the active campaign. */
function buildAllMentionCandidates(campaign: Campaign): MentionCandidate[] {
  return [
    ...campaign.npcs.map(e => ({ id: e.id, name: e.name, type: 'npc' as MentionEntityType })),
    ...campaign.locations.map(e => ({ id: e.id, name: e.name, type: 'location' as MentionEntityType })),
    ...campaign.factions.map(e => ({ id: e.id, name: e.name, type: 'faction' as MentionEntityType })),
    ...campaign.items.map(e => ({ id: e.id, name: e.name, type: 'item' as MentionEntityType })),
    ...campaign.adventures.map(e => ({ id: e.id, name: e.title, type: 'adventure' as MentionEntityType })),
    ...campaign.articles.map(e => ({ id: e.id, name: e.title, type: 'article' as MentionEntityType })),
    ...campaign.plots.map(e => ({ id: e.id, name: e.title, type: 'plot' as MentionEntityType })),
  ];
}

/**
 * Resolves a list of previously-persisted `mentionedEntityIds` back into
 * `{ id, name, type }` candidates, so callers can hydrate a MentionInput's
 * `initialMentions` prop (and reconstruct which fields they came from) when an
 * editor re-opens, instead of losing track of mentions from prior sessions.
 */
export function resolveMentionCandidates(
  campaign: Campaign | undefined,
  ids: string[] | undefined,
): MentionCandidate[] {
  if (!campaign || !ids || ids.length === 0) return [];
  const idSet = new Set(ids);
  return buildAllMentionCandidates(campaign).filter(c => idSet.has(c.id));
}

// --- MentionInput Props ---

export interface MentionInputProps {
  /** Current text value (controlled). */
  value: string;
  /** Called whenever text changes. */
  onChange: (value: string) => void;
  /** Called whenever the set of mentioned entity IDs changes. */
  onMentionedIdsChange?: (ids: string[]) => void;
  /**
   * Entities already known to be mentioned in `value` (e.g. resolved from a
   * persisted `mentionedEntityIds` array via `resolveMentionCandidates`).
   * Seeds the internal name→ID map on mount so previously tracked mentions
   * keep being recognised (and reported via `onMentionedIdsChange`) after the
   * editor re-opens, instead of only working for mentions selected in this session.
   */
  initialMentions?: MentionCandidate[];
  /** Placeholder text shown when input is empty. */
  placeholder?: string;
  /** Number of visible rows (textarea). Defaults to 3. */
  rows?: number;
  /** Extra className applied to the outer wrapper. */
  className?: string;
  /** Extra className applied to the textarea. */
  textareaClassName?: string;
  /** If true, the textarea is disabled. */
  disabled?: boolean;
  /** Called when Enter is pressed without Shift (for single-line submit UX). */
  onEnterSubmit?: () => void;
  /** If true, renders as a single-line input instead of textarea. */
  singleLine?: boolean;
  /** aria-label for the textarea. */
  'aria-label'?: string;
}

const MAX_RESULTS = 8;

/**
 * MentionInput — a textarea (or single-line input) that intercepts `@` to
 * show an entity autocomplete dropdown. Selections insert `@EntityName` into
 * the text and track the associated entity ID separately via
 * `onMentionedIdsChange`.
 *
 * Props follow a controlled-input pattern: callers own `value` and `onChange`.
 */
export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onMentionedIdsChange,
  initialMentions,
  placeholder = 'Type @ to mention an entity...',
  rows = 3,
  className,
  textareaClassName,
  disabled = false,
  onEnterSubmit,
  singleLine = false,
  'aria-label': ariaLabel,
}) => {
  // --- Dropdown state ---
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // dropdownAbove: true when the dropdown should render above the input (mobile near bottom)
  const [dropdownAbove, setDropdownAbove] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Stable id for the listbox, so the input can point aria-controls /
  // aria-activedescendant at it and its options (finding #51).
  const listboxId = useId();
  const getOptionId = useCallback(
    (candidateId: string) => `${listboxId}-option-${candidateId}`,
    [listboxId],
  );

  // Maps entity name (as inserted) → entity ID, so we can report IDs later.
  // Seeded from `initialMentions` (if provided) so mentions tracked in a prior
  // session are still recognised after the component remounts.
  const mentionMapRef = useRef<Map<string, string>>(
    new Map(initialMentions?.map(c => [c.name, c.id])),
  );

  // Snapshot of the entity IDs seeded via `initialMentions`. If an entity is
  // renamed after prose that still reads its OLD name (`@Bob`) was written,
  // nothing rewrites that prose — findMentionedIdsInText can never re-derive
  // the ID by matching the entity's CURRENT name against stale text. Union
  // this snapshot into every reported ID set so a rename doesn't silently
  // drop the mention/backlink on the next edit (finding #18). The accepted
  // trade-off: removing a mention purely by deleting the prose no longer
  // un-tracks it — that needs an explicit affordance elsewhere.
  const seededIdsRef = useRef<Set<string>>(
    new Set(initialMentions?.map(c => c.id) ?? []),
  );

  /** Reports the union of freshly-parsed mention IDs and the seeded set. */
  const reportMentionedIds = useCallback((text: string) => {
    if (!onMentionedIdsChange) return;
    const parsed = extractMentionedIds(text, mentionMapRef.current);
    const union = new Set<string>(parsed);
    for (const id of seededIdsRef.current) union.add(id);
    onMentionedIdsChange(Array.from(union));
  }, [onMentionedIdsChange]);

  // Candidate snapshot is refreshed whenever the dropdown opens or query changes,
  // ensuring newly created entities are available without a full page reload.
  const [candidateSnapshot, setCandidateSnapshot] = useState<MentionCandidate[]>([]);

  useEffect(() => {
    if (isOpen) {
      const state = campaignService.getState();
      const campaign = state.campaigns.find(c => c.id === state.activeCampaignId);
      if (!campaign) { setCandidateSnapshot([]); return; }

      setCandidateSnapshot(buildAllMentionCandidates(campaign));
    }
  }, [isOpen, query]);

  // --- Filter candidates by query ---
  const filtered = useMemo<MentionCandidate[]>(() => {
    if (!query) return candidateSnapshot.slice(0, MAX_RESULTS);
    const q = query.toLowerCase();
    return candidateSnapshot
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, candidateSnapshot]);

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  // --- Determine caret position and whether dropdown should open ---
  const getAtMentionQuery = useCallback((text: string, caretPos: number): string | null => {
    const textBefore = text.slice(0, caretPos);
    // Find the last `@` before the caret that isn't preceded by a word character
    const match = textBefore.match(/@([^@\s]*)$/);
    if (!match) return null;
    return match[1]; // The text typed after @
  }, []);

  // --- Dropdown position helper ---
  const updateDropdownPosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Show above if the dropdown would go off screen (less than 250px below the input)
    setDropdownAbove(viewportHeight - rect.bottom < 250);
  }, []);

  // --- Handle text change ---
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const caretPos = e.target.selectionStart ?? newValue.length;
    const mentionQuery = getAtMentionQuery(newValue, caretPos);

    if (mentionQuery !== null) {
      setQuery(mentionQuery);
      setIsOpen(true);
      updateDropdownPosition();
    } else {
      setIsOpen(false);
      setQuery('');
    }

    // Notify parent of current mentioned IDs
    reportMentionedIds(newValue);
  }, [onChange, reportMentionedIds, getAtMentionQuery, updateDropdownPosition]);

  // --- Select an entity from the dropdown ---
  const selectEntity = useCallback((candidate: MentionCandidate) => {
    const el = textareaRef.current;
    if (!el) return;

    const caretPos = el.selectionStart ?? value.length;
    const textBefore = value.slice(0, caretPos);
    const textAfter = value.slice(caretPos);

    // Replace the partial @query with @EntityName
    const matchBefore = textBefore.match(/(.*?)@([^@\s]*)$/s);
    if (!matchBefore) return;

    const prefix = matchBefore[1];
    const replacement = `@${candidate.name}`;
    const newValue = `${prefix}${replacement} ${textAfter}`;

    // Store the name→id mapping
    mentionMapRef.current.set(candidate.name, candidate.id);

    onChange(newValue);
    reportMentionedIds(newValue);

    setIsOpen(false);
    setQuery('');

    // Restore focus and move caret after inserted text
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const newCaretPos = prefix.length + replacement.length + 1; // +1 for space
        el.setSelectionRange(newCaretPos, newCaretPos);
      }
    });
  }, [value, onChange, reportMentionedIds]);

  // --- Keyboard navigation ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          selectEntity(filtered[activeIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // Stop the event reaching a host's own Escape handling (e.g. DmCoach's
        // document-level keydown listener, or a wrapping DialogShell) — this
        // keystroke should close only the suggestion dropdown (finding #52).
        e.stopPropagation();
        setIsOpen(false);
        return;
      }
    } else {
      // When dropdown is closed, Enter can submit (if caller provides handler)
      if (e.key === 'Enter' && !e.shiftKey && onEnterSubmit) {
        e.preventDefault();
        onEnterSubmit();
      }
    }
  }, [isOpen, filtered, activeIndex, selectEntity, onEnterSubmit]);

  // --- Close dropdown when clicking outside ---
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // --- Scroll active dropdown item into view ---
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const active = dropdownRef.current.querySelector<HTMLElement>('[data-active="true"]');
    // Guard against environments (e.g. jsdom) that don't implement
    // scrollIntoView at all, rather than crashing the whole effect.
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const activeOptionId = isOpen && filtered[activeIndex]
    ? getOptionId(filtered[activeIndex].id)
    : undefined;

  const inputProps = {
    ref: textareaRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    'aria-label': ariaLabel,
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox' as const,
    'aria-controls': isOpen ? listboxId : undefined,
    'aria-activedescendant': activeOptionId,
    className: twMerge(
      'w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm',
      'focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 outline-none',
      'placeholder:text-slate-600 text-slate-100',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      textareaClassName,
    ),
  };

  return (
    <div ref={wrapperRef} className={twMerge('relative', className)}>
      {/* The actual input */}
      {singleLine ? (
        <input
          type="text"
          {...inputProps}
          className={twMerge(inputProps.className, 'h-11')}
        />
      ) : (
        <textarea
          {...inputProps}
          rows={rows}
          className={twMerge(inputProps.className, 'resize-y')}
        />
      )}

      {/* @mention badge hint */}
      <div className="absolute right-2 top-2 pointer-events-none">
        <Icons.AtSign className="w-3.5 h-3.5 text-slate-600" />
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label="Entity mentions"
          className={twMerge(
            'absolute z-50 w-full min-w-[240px] max-h-60 overflow-y-auto',
            'bg-slate-800 border border-slate-600 rounded-lg shadow-lg',
            dropdownAbove ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {/* Group by entity type */}
          {groupByType(filtered).map(({ type, items }) => {
            const meta = ENTITY_TYPE_META[type];
            const TypeIcon = meta.Icon;
            return (
              <div key={type} role="group" aria-label={meta.label}>
                {/* Group header (decorative — the accessible name comes from
                    the group's aria-label above) */}
                <div aria-hidden="true" className="px-3 py-1 flex items-center gap-1.5 bg-slate-900/60 border-b border-slate-700">
                  <TypeIcon className={twMerge('w-3 h-3', meta.dropdownIcon)} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {meta.label}
                  </span>
                </div>
                {/* Items */}
                {items.map(candidate => {
                  const globalIndex = filtered.indexOf(candidate);
                  const isActive = globalIndex === activeIndex;
                  return (
                    <button
                      key={candidate.id}
                      id={getOptionId(candidate.id)}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onPointerDown={(e) => {
                        // Use pointerdown so we fire before blur
                        e.preventDefault();
                        selectEntity(candidate);
                      }}
                      className={twMerge(
                        'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors',
                        'min-h-[44px]', // touch target
                        isActive
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-300 hover:bg-slate-700/60',
                      )}
                    >
                      <span
                        className={twMerge(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                          meta.badge,
                        )}
                      >
                        @
                      </span>
                      <span className="truncate">{candidate.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when @ is typed but no matches */}
      {isOpen && filtered.length === 0 && query.length > 0 && (
        <div
          className={twMerge(
            'absolute z-50 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-lg px-4 py-3',
            dropdownAbove ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <p className="text-sm text-slate-500 italic">No entities match "{query}"</p>
        </div>
      )}
    </div>
  );
};

// --- Inline badge renderer ---

/**
 * Renders text containing @EntityName patterns as inline coloured badges.
 * Pass the mentionMap so we can look up entity type per name.
 */
export const renderMentionedText = (
  text: string,
  mentionMap: Map<string, MentionEntityType>,
): React.ReactNode => {
  const parts = text.split(/(@\S+)/);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1);
      const type = mentionMap.get(name);
      if (type) {
        const meta = ENTITY_TYPE_META[type];
        return (
          <span
            key={i}
            className={twMerge(
              'inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold mx-0.5',
              meta.badge,
            )}
          >
            {part}
          </span>
        );
      }
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

// --- Utility: build entity context string for AI from mentioned IDs ---

export function buildMentionedEntityContext(mentionedEntityIds: string[]): string {
  if (mentionedEntityIds.length === 0) return '';

  const state = campaignService.getState();
  const campaign = state.campaigns.find(c => c.id === state.activeCampaignId);
  if (!campaign) return '';

  const sections: string[] = [];

  for (const id of mentionedEntityIds) {
    const npc = campaign.npcs.find(e => e.id === id);
    if (npc) {
      sections.push(
        `[NPC: ${npc.name}]\n` +
        (npc.description ? `Description: ${npc.description}\n` : '') +
        (npc.traits ? `Traits: ${npc.traits}\n` : '') +
        (npc.motivations ? `Motivations: ${npc.motivations}\n` : '') +
        (npc.secrets ? `Secrets: ${npc.secrets}\n` : ''),
      );
      continue;
    }

    const location = campaign.locations.find(e => e.id === id);
    if (location) {
      sections.push(
        `[Location: ${location.name}]\n` +
        (location.description ? `Description: ${location.description}\n` : '') +
        (location.secrets ? `Secrets: ${location.secrets}\n` : ''),
      );
      continue;
    }

    const faction = campaign.factions.find(e => e.id === id);
    if (faction) {
      sections.push(
        `[Faction: ${faction.name}]\n` +
        (faction.description ? `Description: ${faction.description}\n` : '') +
        (faction.goals ? `Goals: ${faction.goals}\n` : ''),
      );
      continue;
    }

    const item = campaign.items.find(e => e.id === id);
    if (item) {
      sections.push(
        `[Item: ${item.name}]\n` +
        (item.description ? `Description: ${item.description}\n` : ''),
      );
      continue;
    }

    const adventure = campaign.adventures.find(e => e.id === id);
    if (adventure) {
      sections.push(
        `[Adventure: ${adventure.title}]\n` +
        (adventure.hook ? `Hook: ${adventure.hook}\n` : '') +
        (adventure.theme ? `Theme: ${adventure.theme}\n` : ''),
      );
      continue;
    }

    const article = campaign.articles.find(e => e.id === id);
    if (article) {
      sections.push(
        `[Article: ${article.title}]\n` +
        (article.content ? `Content: ${article.content.slice(0, 500)}\n` : ''),
      );
      continue;
    }

    const plot = campaign.plots.find(e => e.id === id);
    if (plot) {
      sections.push(
        `[Plot: ${plot.title}]\n` +
        (plot.description ? `Description: ${plot.description}\n` : ''),
      );
      continue;
    }
  }

  if (sections.length === 0) return '';
  return '\n\n--- Referenced Entities ---\n' + sections.join('\n');
}

// --- Local helper: group flat list by entity type preserving order ---

function groupByType(
  candidates: MentionCandidate[],
): { type: MentionEntityType; items: MentionCandidate[] }[] {
  const map = new Map<MentionEntityType, MentionCandidate[]>();
  for (const c of candidates) {
    if (!map.has(c.type)) map.set(c.type, []);
    map.get(c.type)!.push(c);
  }
  return Array.from(map.entries()).map(([type, items]) => ({ type, items }));
}
