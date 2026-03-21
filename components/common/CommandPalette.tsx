
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icons } from '@/components/common/Icons';
import type { NPC, Location, Faction, Item, Adventure, Article, SessionLog, Plot, PlayerCharacter } from '@/types/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandPaletteEntityType =
  | 'npc'
  | 'location'
  | 'faction'
  | 'item'
  | 'adventure'
  | 'article'
  | 'session-log'
  | 'plot'
  | 'player-character';

export interface RecentItem {
  type: CommandPaletteEntityType;
  id: string;
  name: string;
}

interface EntityResult {
  type: CommandPaletteEntityType;
  id: string;
  name: string;
  subtitle?: string;
}

interface ActionResult {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
}

type PaletteResult =
  | { kind: 'entity'; data: EntityResult }
  | { kind: 'action'; data: ActionResult };

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Entity lists from active campaign
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  adventures: Adventure[];
  articles: Article[];
  sessionLogs: SessionLog[];
  plots: Plot[];
  playerCharacters: PlayerCharacter[];
  // Recent items (session-level, maintained by App.tsx)
  recentItems: RecentItem[];
  // Navigation callbacks
  onSelectNpc: (id: string) => void;
  onSelectLocation: (id: string) => void;
  onSelectFaction: (id: string) => void;
  onSelectItem: (id: string) => void;
  onSelectAdventure: (id: string) => void;
  onSelectArticle: (id: string) => void;
  onSelectSessionLog: (id: string) => void;
  onSelectPlot: (id: string) => void;
  onSelectPlayerCharacter: (id: string) => void;
  // Action callbacks
  onNavigateTo: (view: string) => void;
  onOpenCoach: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_CONFIG: Record<CommandPaletteEntityType, { label: string; colorClass: string; textClass: string; icon: keyof typeof Icons }> = {
  npc: { label: 'NPC', colorClass: 'bg-amber-500/10 border-amber-500/30', textClass: 'text-amber-400', icon: 'NPCs' },
  location: { label: 'Location', colorClass: 'bg-emerald-500/10 border-emerald-500/30', textClass: 'text-emerald-400', icon: 'Locations' },
  faction: { label: 'Faction', colorClass: 'bg-violet-500/10 border-violet-500/30', textClass: 'text-violet-400', icon: 'Factions' },
  item: { label: 'Item', colorClass: 'bg-sky-500/10 border-sky-500/30', textClass: 'text-sky-400', icon: 'Items' },
  adventure: { label: 'Adventure', colorClass: 'bg-orange-500/10 border-orange-500/30', textClass: 'text-orange-400', icon: 'Adventures' },
  article: { label: 'Article', colorClass: 'bg-cyan-500/10 border-cyan-500/30', textClass: 'text-cyan-400', icon: 'BookCopy' },
  'session-log': { label: 'Session', colorClass: 'bg-rose-500/10 border-rose-500/30', textClass: 'text-rose-400', icon: 'SessionLog' },
  plot: { label: 'Plot', colorClass: 'bg-yellow-500/10 border-yellow-500/30', textClass: 'text-yellow-400', icon: 'Plot' },
  'player-character': { label: 'Character', colorClass: 'bg-teal-500/10 border-teal-500/30', textClass: 'text-teal-400', icon: 'PlayerCharacters' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  // Simple substring match — fast enough for <500 entities, readable results
  return h.includes(n);
}

function getEntityName(type: CommandPaletteEntityType, entity: NPC | Location | Faction | Item | Adventure | Article | SessionLog | Plot | PlayerCharacter): string {
  if (type === 'player-character') {
    return (entity as PlayerCharacter).characterSocial?.characterName || (entity as any).name || 'Unknown Character';
  }
  if (type === 'adventure') {
    return (entity as Adventure).title;
  }
  if (type === 'article') {
    return (entity as Article).title;
  }
  if (type === 'session-log') {
    return (entity as SessionLog).title;
  }
  if (type === 'plot') {
    return (entity as Plot).title;
  }
  return (entity as any).name || '';
}

function getEntitySubtitle(type: CommandPaletteEntityType, entity: NPC | Location | Faction | Item | Adventure | Article | SessionLog | Plot | PlayerCharacter): string | undefined {
  switch (type) {
    case 'npc': return (entity as NPC).description?.slice(0, 80) || undefined;
    case 'location': return (entity as Location).description?.slice(0, 80) || undefined;
    case 'faction': return (entity as Faction).description?.slice(0, 80) || undefined;
    case 'item': return (entity as Item).description?.slice(0, 80) || undefined;
    case 'adventure': return (entity as Adventure).hook?.slice(0, 80) || undefined;
    case 'article': return (entity as Article).content?.slice(0, 80) || undefined;
    case 'session-log': return (entity as SessionLog).recap?.slice(0, 80) || undefined;
    case 'plot': return (entity as Plot).description?.slice(0, 80) || undefined;
    case 'player-character': {
      const pc = entity as PlayerCharacter;
      const classes = pc.characterStatistics?.classes?.map(c => c.className).join(', ');
      return classes || undefined;
    }
    default: return undefined;
  }
}

function getEntitySearchText(type: CommandPaletteEntityType, entity: NPC | Location | Faction | Item | Adventure | Article | SessionLog | Plot | PlayerCharacter): string {
  const name = getEntityName(type, entity);
  const subtitle = getEntitySubtitle(type, entity) || '';
  return `${name} ${subtitle}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ResultItemProps {
  result: PaletteResult;
  isActive: boolean;
  onSelect: (result: PaletteResult) => void;
  onMouseEnter: () => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ result, isActive, onSelect, onMouseEnter }) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isActive]);

  if (result.kind === 'action') {
    const { data } = result;
    return (
      <button
        ref={ref}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[44px] ${
          isActive ? 'bg-amber-600/20 text-stone-100' : 'text-stone-300 hover:bg-stone-700/50'
        }`}
        onClick={() => onSelect(result)}
        onMouseEnter={onMouseEnter}
        type="button"
      >
        <Icons.Plus className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{data.label}</div>
          {data.description && (
            <div className="text-xs text-stone-500 truncate mt-0.5">{data.description}</div>
          )}
        </div>
        <Icons.ChevronRight className={`w-4 h-4 flex-shrink-0 transition-opacity ${isActive ? 'opacity-100 text-amber-400' : 'opacity-0'}`} />
      </button>
    );
  }

  const { data } = result;
  const config = ENTITY_CONFIG[data.type];
  const EntityIcon = Icons[config.icon] as React.FC<{ className?: string }>;

  return (
    <button
      ref={ref}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[44px] ${
        isActive ? 'bg-amber-600/20 text-stone-100' : 'text-stone-300 hover:bg-stone-700/50'
      }`}
      onClick={() => onSelect(result)}
      onMouseEnter={onMouseEnter}
      type="button"
    >
      <EntityIcon className={`w-4 h-4 flex-shrink-0 ${config.textClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{data.name}</div>
        {data.subtitle && (
          <div className="text-xs text-stone-500 truncate mt-0.5">{data.subtitle}</div>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${config.colorClass} ${config.textClass}`}>
        {config.label}
      </span>
    </button>
  );
};

interface ResultGroupProps {
  label: string;
  results: PaletteResult[];
  activeIndex: number;
  globalOffset: number;
  onSelect: (result: PaletteResult) => void;
  onSetActive: (index: number) => void;
}

const ResultGroup: React.FC<ResultGroupProps> = ({ label, results, activeIndex, globalOffset, onSelect, onSetActive }) => {
  if (results.length === 0) return null;
  return (
    <div>
      <div className="px-4 py-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-900/50">
        {label}
      </div>
      {results.map((result, localIdx) => {
        const globalIdx = globalOffset + localIdx;
        return (
          <ResultItem
            key={result.kind === 'entity' ? `${result.data.type}-${result.data.id}` : result.data.id}
            result={result}
            isActive={activeIndex === globalIdx}
            onSelect={onSelect}
            onMouseEnter={() => onSetActive(globalIdx)}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  npcs,
  locations,
  factions,
  items,
  adventures,
  articles,
  sessionLogs,
  plots,
  playerCharacters,
  recentItems,
  onSelectNpc,
  onSelectLocation,
  onSelectFaction,
  onSelectItem,
  onSelectAdventure,
  onSelectArticle,
  onSelectSessionLog,
  onSelectPlot,
  onSelectPlayerCharacter,
  onNavigateTo,
  onOpenCoach,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Small delay to ensure modal is rendered before focusing
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Build action shortcuts (always available, shown when no query)
  const actions: ActionResult[] = useMemo(() => [
    { id: 'create-npc', label: 'Create NPC', description: 'Add a new character', onSelect: () => { onNavigateTo('npcs'); onClose(); } },
    { id: 'create-location', label: 'Create Location', description: 'Add a new location', onSelect: () => { onNavigateTo('locations'); onClose(); } },
    { id: 'create-faction', label: 'Create Faction', description: 'Add a new faction', onSelect: () => { onNavigateTo('factions'); onClose(); } },
    { id: 'create-item', label: 'Create Item', description: 'Add a new item', onSelect: () => { onNavigateTo('items'); onClose(); } },
    { id: 'create-adventure', label: 'Create Adventure', description: 'Add a new adventure', onSelect: () => { onNavigateTo('adventures'); onClose(); } },
    { id: 'open-coach', label: 'Open DM Coach', description: 'AI-powered in-session assistance', onSelect: () => { onOpenCoach(); onClose(); } },
    { id: 'view-relationships', label: 'World Graph', description: 'View entity relationship graph', onSelect: () => { onNavigateTo('relationships'); onClose(); } },
    { id: 'view-combat', label: 'Combat Tracker', description: 'Open the combat tracker', onSelect: () => { onNavigateTo('combat'); onClose(); } },
  ], [onNavigateTo, onOpenCoach, onClose]);

  // Build all searchable entities
  const allEntities: EntityResult[] = useMemo(() => {
    const results: EntityResult[] = [];

    const push = (type: CommandPaletteEntityType, entities: (NPC | Location | Faction | Item | Adventure | Article | SessionLog | Plot | PlayerCharacter)[]) => {
      for (const entity of entities) {
        results.push({
          type,
          id: entity.id,
          name: getEntityName(type, entity),
          subtitle: getEntitySubtitle(type, entity),
        });
      }
    };

    push('npc', npcs);
    push('location', locations);
    push('faction', factions);
    push('item', items);
    push('adventure', adventures);
    push('article', articles);
    push('session-log', sessionLogs);
    push('plot', plots);
    push('player-character', playerCharacters);

    return results;
  }, [npcs, locations, factions, items, adventures, articles, sessionLogs, plots, playerCharacters]);

  // Filter results based on query
  const { recentResults, entityResults, actionResults } = useMemo(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      // No query: show recents + quick actions
      const recentResults: PaletteResult[] = recentItems
        .slice(0, 8)
        .map(r => {
          // Find the full entity to get subtitle
          const found = allEntities.find(e => e.type === r.type && e.id === r.id);
          return {
            kind: 'entity' as const,
            data: { type: r.type, id: r.id, name: r.name, subtitle: found?.subtitle },
          };
        })
        .filter(r => r.data.name); // filter out stale items where entity was deleted

      const actionResults: PaletteResult[] = actions.map(a => ({ kind: 'action' as const, data: a }));
      return { recentResults, entityResults: [], actionResults };
    }

    // With query: search entities + actions
    const filteredEntities: EntityResult[] = allEntities.filter(e => {
      const searchText = `${e.name} ${e.subtitle || ''}`;
      return fuzzyMatch(searchText, trimmed);
    });

    // Group by type for display
    const entityResults: PaletteResult[] = filteredEntities.map(e => ({ kind: 'entity' as const, data: e }));

    const filteredActions: PaletteResult[] = actions
      .filter(a => fuzzyMatch(`${a.label} ${a.description || ''}`, trimmed))
      .map(a => ({ kind: 'action' as const, data: a }));

    return { recentResults: [], entityResults, actionResults: filteredActions };
  }, [query, allEntities, recentItems, actions]);

  // Build flat list for keyboard navigation
  const flatResults = useMemo(() => {
    return [...recentResults, ...entityResults, ...actionResults];
  }, [recentResults, entityResults, actionResults]);

  // Clamp activeIndex when result count changes
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

  const handleSelect = useCallback((result: PaletteResult) => {
    if (result.kind === 'action') {
      result.data.onSelect();
    } else {
      const { type, id } = result.data;
      switch (type) {
        case 'npc': onSelectNpc(id); break;
        case 'location': onSelectLocation(id); break;
        case 'faction': onSelectFaction(id); break;
        case 'item': onSelectItem(id); break;
        case 'adventure': onSelectAdventure(id); break;
        case 'article': onSelectArticle(id); break;
        case 'session-log': onSelectSessionLog(id); break;
        case 'plot': onSelectPlot(id); break;
        case 'player-character': onSelectPlayerCharacter(id); break;
      }
      onClose();
    }
  }, [onSelectNpc, onSelectLocation, onSelectFaction, onSelectItem, onSelectAdventure, onSelectArticle, onSelectSessionLog, onSelectPlot, onSelectPlayerCharacter, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, flatResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[activeIndex]) {
          handleSelect(flatResults[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatResults, activeIndex, handleSelect, onClose]);

  // Group entity results by type for display
  const groupedEntityResults = useMemo(() => {
    if (!entityResults.length) return [];
    const groups: Record<string, PaletteResult[]> = {};
    const order: string[] = [];
    for (const result of entityResults) {
      if (result.kind !== 'entity') continue;
      const type = result.data.type;
      if (!groups[type]) {
        groups[type] = [];
        order.push(type);
      }
      groups[type].push(result);
    }
    return order.map(type => ({
      type: type as CommandPaletteEntityType,
      label: ENTITY_CONFIG[type as CommandPaletteEntityType].label + 's',
      results: groups[type],
    }));
  }, [entityResults]);

  // Compute offsets for keyboard navigation across groups
  const groupOffsets = useMemo(() => {
    const offsets: { label: string; results: PaletteResult[]; offset: number }[] = [];
    let cursor = 0;

    if (recentResults.length > 0) {
      offsets.push({ label: 'Recent', results: recentResults, offset: cursor });
      cursor += recentResults.length;
    }

    for (const group of groupedEntityResults) {
      offsets.push({ label: group.label, results: group.results, offset: cursor });
      cursor += group.results.length;
    }

    if (actionResults.length > 0) {
      offsets.push({ label: 'Actions', results: actionResults, offset: cursor });
    }

    return offsets;
  }, [recentResults, groupedEntityResults, actionResults]);

  if (!isOpen) return null;

  const isEmpty = flatResults.length === 0;
  const hasQuery = query.trim().length > 0;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Panel */}
      <div
        className="w-full max-w-xl bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <Icons.Search className="w-5 h-5 text-stone-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search entities, type to filter..."
            className="flex-1 bg-transparent text-stone-100 placeholder-stone-500 text-base outline-none min-w-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-stone-600 text-stone-400 text-xs font-mono">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:hidden"
              type="button"
              aria-label="Close"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {isEmpty && (
            <div className="px-4 py-8 text-center text-stone-500 text-sm">
              {hasQuery ? `No results for "${query}"` : 'No recent items. Start typing to search.'}
            </div>
          )}

          {groupOffsets.map(({ label, results, offset }) => (
            <ResultGroup
              key={label}
              label={label}
              results={results}
              activeIndex={activeIndex}
              globalOffset={offset}
              onSelect={handleSelect}
              onSetActive={setActiveIndex}
            />
          ))}
        </div>

        {/* Footer hint */}
        {!isEmpty && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-stone-800 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs text-stone-500">
              <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-stone-700 text-stone-400 text-xs font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-500">
              <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-stone-700 text-stone-400 text-xs font-mono">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-500 ml-auto">
              <kbd className="inline-flex items-center px-1 py-0.5 rounded border border-stone-700 text-stone-400 text-xs font-mono">ESC</kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
