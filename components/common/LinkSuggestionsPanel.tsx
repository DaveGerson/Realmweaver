
import React, { useMemo, useState } from 'react';
import { Icons } from '@/components/common/Icons';
import { getMatchingEngine } from '@/services/linking/engineRegistry';
import type { EntityCandidate } from '@/services/linking/matchingEngine';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import type { QuickCardEntityType } from './EntityQuickCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  entityId: string;
  entityType: string;
  entityName: string;
  actionLabel: string;
}

export interface LinkSuggestionsPanelProps {
  textFields: string[];
  linkedNpcIds?: string[];
  linkedLocationId?: string | null;
  linkedFactionId?: string | null;
  mentionedEntityIds?: string[];
  allCandidates: EntityCandidate[];
  onAccept: (entityId: string, action: string) => void;
  onDismiss?: (entityId: string) => void;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
  dismissedIds?: Set<string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.5;

function getActionLabel(entityType: string): string {
  switch (entityType) {
    case 'npc':      return 'Add NPC';
    case 'location': return 'Set Location';
    case 'faction':  return 'Link Faction';
    default:         return 'Link';
  }
}

function getEntityTypeColor(entityType: string): string {
  const config = ENTITY_TYPE_CONFIG[entityType];
  return config ? config.color : 'slate';
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LinkSuggestionsPanel: React.FC<LinkSuggestionsPanelProps> = ({
  textFields,
  linkedNpcIds = [],
  linkedLocationId = null,
  linkedFactionId = null,
  mentionedEntityIds = [],
  allCandidates,
  onAccept,
  onDismiss,
  onNavigate: _onNavigate,
  dismissedIds = new Set(),
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const suggestions = useMemo<Suggestion[]>(() => {
    const combinedText = textFields.filter(Boolean).join(' ');
    if (!combinedText.trim() || allCandidates.length === 0) return [];

    const engine = getMatchingEngine();
    const matches = engine.findMatches(combinedText, allCandidates);

    const seen = new Set<string>();
    const results: Suggestion[] = [];

    for (const match of matches) {
      if (match.confidence < CONFIDENCE_THRESHOLD) continue;
      if (seen.has(match.entityId)) continue;
      if (dismissedIds.has(match.entityId)) continue;

      // Filter out already-linked entities
      if (match.entityType === 'npc' && linkedNpcIds.includes(match.entityId)) continue;
      if (match.entityType === 'location' && linkedLocationId === match.entityId) continue;
      if (match.entityType === 'faction' && linkedFactionId === match.entityId) continue;
      if (mentionedEntityIds.includes(match.entityId)) continue;

      seen.add(match.entityId);
      results.push({
        entityId: match.entityId,
        entityType: match.entityType,
        entityName: match.entityName,
        actionLabel: getActionLabel(match.entityType),
      });
    }

    return results;
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    textFields.join('\x00'),
    allCandidates,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    linkedNpcIds.join(','),
    linkedLocationId,
    linkedFactionId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    mentionedEntityIds.join(','),
    dismissedIds,
  ]);

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-700/50 overflow-hidden">
      {/* ── Collapsible Header ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls="link-suggestions-body"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <Icons.Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Link Suggestions
        </span>
        <span className="flex items-center gap-2">
          <span className="bg-amber-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
            {suggestions.length}
          </span>
          <Icons.ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <div id="link-suggestions-body" className="bg-slate-900/50 p-3 space-y-2">
          {suggestions.map(suggestion => {
            const color = getEntityTypeColor(suggestion.entityType);
            return (
              <div
                key={suggestion.entityId}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className={`font-medium text-${color}-300 truncate`}>
                  {suggestion.entityName}
                  <span className="ml-1.5 text-slate-500 font-normal">
                    ({suggestion.actionLabel})
                  </span>
                </span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onAccept(suggestion.entityId, suggestion.actionLabel)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs rounded px-2 py-0.5 transition-colors"
                    aria-label={`${suggestion.actionLabel}: ${suggestion.entityName}`}
                  >
                    +Add
                  </button>
                  {onDismiss && (
                    <button
                      type="button"
                      onClick={() => onDismiss(suggestion.entityId)}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors px-1 py-0.5"
                      aria-label={`Dismiss suggestion: ${suggestion.entityName}`}
                    >
                      Dismiss
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
