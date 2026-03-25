
/**
 * SceneResourcesPanel — collapsible inline reference panel for SceneEditor.
 *
 * Resolves NPC IDs and a location ID from campaign data and renders
 * compact detail cards so the GM has zero-click mid-session access to
 * the entities linked to the current scene.
 */

import React, { useState } from 'react';
import { Icons } from '@/components/common/Icons';
import { EntityLink } from '@/components/common/EntityLink';
import type { Campaign, NPC, Location } from '@/types/index';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SceneResourcesPanelProps {
  npcIds: string[];
  locationId?: string;
  campaign: Campaign;
  onNavigate?: (entityType: string, entityId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the first N sentences from a block of text. */
function firstSentences(text: string, count: number): string {
  if (!text) return '';
  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [];
  return sentences.slice(0, count).join(' ').trim();
}

// ─── NPC Card ─────────────────────────────────────────────────────────────────

interface NpcCardProps {
  npc: NPC;
  factionName?: string;
  factionId?: string;
  onNavigate?: (entityType: string, entityId: string) => void;
}

const NpcCard: React.FC<NpcCardProps> = ({ npc, factionName, factionId, onNavigate }) => {
  const nav = onNavigate as ((t: QuickCardEntityType, id: string) => void) | undefined;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-1.5">
      {/* Name */}
      <div className="font-semibold text-slate-100 leading-tight">
        {nav ? (
          <EntityLink
            entityType="npc"
            entityId={npc.id}
            label={npc.name}
            onNavigate={nav}
          />
        ) : (
          <span className="text-amber-400">{npc.name}</span>
        )}
      </div>

      {/* Faction badge */}
      {factionId && factionName && nav && (
        <div className="text-xs">
          <EntityLink
            entityType="faction"
            entityId={factionId}
            label={factionName}
            onNavigate={nav}
            className="bg-violet-900/40 text-violet-300 hover:text-violet-200 px-1.5 py-0.5 rounded text-xs no-underline"
          />
        </div>
      )}
      {factionId && factionName && !nav && (
        <span className="inline-block bg-violet-900/40 text-violet-300 px-1.5 py-0.5 rounded text-xs">
          {factionName}
        </span>
      )}

      {/* Traits */}
      {npc.traits && (
        <p className="text-xs text-slate-400 leading-snug line-clamp-1" title={npc.traits}>
          {npc.traits}
        </p>
      )}

      {/* Motivation */}
      {npc.motivations && (
        <p className="text-xs text-slate-500 italic leading-snug line-clamp-1" title={npc.motivations}>
          {npc.motivations}
        </p>
      )}

      {/* Example quote */}
      {npc.exampleQuote && (
        <p
          className="text-xs text-amber-300/80 italic leading-snug line-clamp-1 border-l-2 border-amber-600/50 pl-2"
          title={npc.exampleQuote}
        >
          &ldquo;{npc.exampleQuote}&rdquo;
        </p>
      )}

      {/* Stats reference */}
      {npc.stats && (
        <p
          className="text-xs text-slate-500 font-mono leading-snug line-clamp-1"
          title={npc.stats}
        >
          {npc.stats}
        </p>
      )}
    </div>
  );
};

// ─── Location Card ────────────────────────────────────────────────────────────

interface LocationCardProps {
  location: Location;
  onNavigate?: (entityType: string, entityId: string) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({ location, onNavigate }) => {
  const [secretsExpanded, setSecretsExpanded] = useState(false);
  const nav = onNavigate as ((t: QuickCardEntityType, id: string) => void) | undefined;

  const readAloudSnippet = firstSentences(location.description, 2);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
      {/* Name */}
      <div className="font-semibold text-slate-100 leading-tight">
        {nav ? (
          <EntityLink
            entityType="location"
            entityId={location.id}
            label={location.name}
            onNavigate={nav}
          />
        ) : (
          <span className="text-emerald-400">{location.name}</span>
        )}
      </div>

      {/* Read-aloud blockquote (first 2 sentences) */}
      {readAloudSnippet && (
        <blockquote className="text-xs text-amber-200/70 italic leading-relaxed border-l-2 border-amber-600/50 pl-2">
          {readAloudSnippet}
        </blockquote>
      )}

      {/* Secrets — collapsible, GM-only */}
      {location.secrets && (
        <div>
          <button
            type="button"
            onClick={() => setSecretsExpanded(prev => !prev)}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {secretsExpanded ? (
              <Icons.ChevronUp className="w-3 h-3" />
            ) : (
              <Icons.ChevronDown className="w-3 h-3" />
            )}
            GM Secrets
          </button>
          {secretsExpanded && (
            <div className="mt-1.5 bg-red-950/30 border border-red-900/40 rounded p-2">
              <p className="text-xs text-red-300/90 leading-relaxed">{location.secrets}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const SceneResourcesPanel: React.FC<SceneResourcesPanelProps> = ({
  npcIds,
  locationId,
  campaign,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Resolve entities from campaign
  const npcs = npcIds
    .map(id => campaign.npcs.find(n => n.id === id))
    .filter((n): n is NPC => n !== undefined);

  const location = locationId
    ? campaign.locations.find(l => l.id === locationId)
    : undefined;

  const hasContent = npcs.length > 0 || location !== undefined;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Panel header — always visible, toggles body */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800 hover:bg-slate-700 transition-colors text-left group"
      >
        <div className="flex items-center gap-2">
          <Icons.Scenes className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
            Scene Resources
          </span>
          {hasContent && (
            <span className="text-xs text-slate-500">
              {[npcs.length > 0 && `${npcs.length} NPC${npcs.length !== 1 ? 's' : ''}`, location && '1 location']
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </div>
        {isExpanded ? (
          <Icons.ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <Icons.ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Panel body */}
      {isExpanded && (
        <div className="bg-slate-900/50 p-4 space-y-4">
          {!hasContent && (
            <p className="text-sm text-slate-500 italic text-center py-2">
              No NPCs or location linked to this scene.
            </p>
          )}

          {/* NPC section */}
          {npcs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Icons.NPCs className="w-3.5 h-3.5" />
                NPCs Involved
              </h4>
              {/* 2-column on md+, 1-column on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {npcs.map(npc => {
                  const faction = npc.factionId
                    ? campaign.factions.find(f => f.id === npc.factionId)
                    : undefined;
                  return (
                    <NpcCard
                      key={npc.id}
                      npc={npc}
                      factionId={faction?.id}
                      factionName={faction?.name}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Location section */}
          {location && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Icons.Locations className="w-3.5 h-3.5" />
                Location
              </h4>
              <LocationCard location={location} onNavigate={onNavigate} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
