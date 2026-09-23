
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Campaign, Secret, Scene } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { generateSecretBatch, type SecretDraft } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { getEntityTypeConfig } from '@/utils/entityUtils';

// --- Types ---

type SecretCategory = Secret['category'];
type CategoryFilter = 'all' | SecretCategory;

interface SecretsTrackerProps {
  campaign: Campaign;
  activeSessionId?: string;
  /**
   * R2 ("Generate ten"). Optional and defaulting to false so the two existing
   * call sites (`ViewRouter.tsx`, `session/QuickToolsPanel.tsx`) keep
   * compiling untouched — both already have the flag in scope and should pass
   * it through.
   */
  isMockMode?: boolean;
}

// --- Constants ---

const CATEGORY_CONFIG: Record<SecretCategory, {
  label: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
}> = {
  secret: {
    label: 'Secret',
    borderColor: 'border-l-red-500',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    icon: <Icons.Lock className="w-3 h-3" />,
  },
  clue: {
    label: 'Clue',
    borderColor: 'border-l-amber-500',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: <Icons.Search className="w-3 h-3" />,
  },
  revelation: {
    label: 'Revelation',
    borderColor: 'border-l-green-500',
    badgeBg: 'bg-green-500/20',
    badgeText: 'text-green-300',
    icon: <Icons.Sparkles className="w-3 h-3" />,
  },
  rumor: {
    label: 'Rumor',
    borderColor: 'border-l-violet-500',
    badgeBg: 'bg-violet-500/20',
    badgeText: 'text-violet-300',
    icon: <Icons.Chat className="w-3 h-3" />,
  },
};

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'secret', label: 'Secrets' },
  { value: 'clue', label: 'Clues' },
  { value: 'revelation', label: 'Revelations' },
  { value: 'rumor', label: 'Rumors' },
];

// --- Entity picker helpers ---

interface PickableEntity {
  id: string;
  name: string;
  type: string;
}

/**
 * R4 "here now" filter: resolves `campaign.activeSceneId` against every scene
 * of every adventure in the campaign. Returns `undefined` when there is no
 * active scene id, or it doesn't resolve (stale id, no adventures) — callers
 * treat that as "the filter control doesn't exist", not "disabled".
 */
function findActiveScene(campaign: Campaign): Scene | undefined {
  if (!campaign.activeSceneId) return undefined;
  for (const adventure of campaign.adventures || []) {
    const found = adventure.scenes.find(s => s.id === campaign.activeSceneId);
    if (found) return found;
  }
  return undefined;
}

/** Builds a flat list of all linkable entities from the campaign. */
function buildPickableEntities(campaign: Campaign): PickableEntity[] {
  const results: PickableEntity[] = [];

  campaign.npcs.forEach(e => results.push({ id: e.id, name: e.name, type: 'npc' }));
  campaign.locations.forEach(e => results.push({ id: e.id, name: e.name, type: 'location' }));
  campaign.factions.forEach(e => results.push({ id: e.id, name: e.name, type: 'faction' }));
  campaign.plots?.forEach(e => results.push({ id: e.id, name: e.title, type: 'plot' }));
  campaign.items?.forEach(e => results.push({ id: e.id, name: e.name, type: 'item' }));

  return results;
}

// --- Entity chip sub-component ---

interface EntityChipProps {
  entity: PickableEntity;
  onRemove?: (id: string) => void;
}

const EntityChip: React.FC<EntityChipProps> = ({ entity, onRemove }) => {
  const config = getEntityTypeConfig(entity.type);
  const color = config?.color ?? 'slate';

  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
        `bg-${color}-900/50 text-${color}-300 border border-${color}-700/50`
      )}
    >
      <span className="truncate max-w-[80px]">{entity.name}</span>
      {onRemove && (
        <button
          onClick={() => onRemove(entity.id)}
          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={`Remove ${entity.name}`}
        >
          <Icons.X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
};

// --- Entity picker popover ---

interface EntityPickerProps {
  linkedEntityIds: string[];
  allEntities: PickableEntity[];
  onToggle: (id: string) => void;
  /**
   * Called on every dismissal. `restoreFocus` is true for keyboard dismissal
   * (Escape / Done) and false for a pointer dismissal (outside mousedown), so
   * the caller can avoid stealing focus — and scrolling a panel back into
   * view — out from under an in-flight click elsewhere on the page.
   */
  onClose: (restoreFocus: boolean) => void;
  /** Ref to the trigger button that opened this picker, so outside-click detection doesn't fight the trigger's own toggle handler. */
  triggerRef: React.RefObject<HTMLElement>;
}

const EntityPicker: React.FC<EntityPickerProps> = ({
  linkedEntityIds,
  allEntities,
  onToggle,
  onClose,
  triggerRef,
}) => {
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismiss on Escape (anywhere) or on a mousedown outside the popover/trigger.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      // Pointer dismissal: don't steal focus from wherever the user clicked.
      onClose(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose, triggerRef]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? allEntities.filter(e => e.name.toLowerCase().includes(q) || e.type.includes(q)) : allEntities;
  }, [allEntities, search]);

  // Group by type for readability
  const grouped = useMemo(() => {
    const map: Record<string, PickableEntity[]> = {};
    filtered.forEach(e => {
      if (!map[e.type]) map[e.type] = [];
      map[e.type].push(e);
    });
    return map;
  }, [filtered]);

  const typeOrder = ['npc', 'location', 'faction', 'plot', 'item'];
  const orderedTypes = typeOrder.filter(t => grouped[t]?.length);

  if (allEntities.length === 0) {
    return (
      <div ref={popoverRef} className="absolute z-50 left-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs text-slate-500 italic">
        No entities in campaign yet.
        <button onClick={() => onClose(true)} className="block mt-2 text-amber-400 hover:text-amber-300">Close</button>
      </div>
    );
  }

  return (
    <div ref={popoverRef} className="absolute z-50 left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col max-h-64">
      {/* Search */}
      <div className="p-2 border-b border-slate-700 flex-shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search entities..."
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          autoFocus
        />
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 p-1">
        {orderedTypes.length === 0 && (
          <p className="text-xs text-slate-500 italic px-2 py-2">No results.</p>
        )}
        {orderedTypes.map(type => {
          const config = getEntityTypeConfig(type);
          const color = config?.color ?? 'slate';
          return (
            <div key={type} className="mb-1">
              <p className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 text-${color}-400`}>
                {config?.label ?? type}
              </p>
              {grouped[type].map(entity => {
                const isLinked = linkedEntityIds.includes(entity.id);
                return (
                  <button
                    key={entity.id}
                    onClick={() => onToggle(entity.id)}
                    className={twMerge(
                      'w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors text-left',
                      isLinked
                        ? `bg-${color}-900/30 text-${color}-300 hover:bg-${color}-900/50`
                        : 'text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    {isLinked
                      ? <Icons.Check className="w-3 h-3 flex-shrink-0" />
                      : <span className="w-3 h-3 flex-shrink-0" />
                    }
                    <span className="truncate">{entity.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 p-1.5 flex justify-end flex-shrink-0">
        <button
          onClick={() => onClose(true)}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// --- Sub-components ---

interface SecretCardProps {
  secret: Secret;
  sessionName?: string;
  activeSessionId?: string;
  allEntities: PickableEntity[];
  /** E1/E2 mystery edges: every `category: 'revelation'` secret in the campaign, for the "Supports revelation" picker. */
  revelations: Secret[];
  /** E1/E2: count of secrets whose `revealsSecretId` equals this card's id (self-reference excluded); 0 for a non-revelation. */
  inboundClueCount: number;
  onReveal: (id: string, sessionId?: string) => void;
  onUnreveal: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkEntity: (secretId: string, entityId: string) => void;
  onUnlinkEntity: (secretId: string, entityId: string) => void;
  onUpdateSecret: (id: string, updates: Partial<Secret>) => void;
}

const SecretCard: React.FC<SecretCardProps> = ({
  secret,
  sessionName,
  activeSessionId,
  allEntities,
  revelations,
  inboundClueCount,
  onReveal,
  onUnreveal,
  onDelete,
  onLinkEntity,
  onUnlinkEntity,
  onUpdateSecret,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const linkTriggerRef = useRef<HTMLButtonElement>(null);
  const { confirm } = useConfirmDialog();

  const config = CATEGORY_CONFIG[secret.category];
  const linkedIds = secret.linkedEntityIds ?? [];

  // Map linked IDs to entity objects for chip display
  const linkedEntities = useMemo(
    () => linkedIds.map(id => allEntities.find(e => e.id === id)).filter(Boolean) as PickableEntity[],
    [linkedIds, allEntities]
  );

  // E1/E2 mystery edges — documented default threshold is 3 when cluesNeeded is absent.
  const cluesNeededThreshold = secret.cluesNeeded ?? 3;

  const handleRevealsSecretChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    // The key must be PRESENT even when clearing — updateSecret is an
    // Object.assign, and an omitted key clears nothing.
    onUpdateSecret(secret.id, { revealsSecretId: value === '' ? undefined : value });
  };

  const handleVitalToggle = () => {
    onUpdateSecret(secret.id, { isVital: !secret.isVital });
  };

  const handleCluesNeededChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      // Clearing the field returns to the documented default (3) — the key
      // must be present, same reasoning as the picker's clearing option.
      onUpdateSecret(secret.id, { cluesNeeded: undefined });
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return; // refuse anything below one
    onUpdateSecret(secret.id, { cluesNeeded: n });
  };

  const handleRevealToggle = () => {
    if (secret.isRevealed) {
      onUnreveal(secret.id);
    } else {
      onReveal(secret.id, activeSessionId);
    }
  };

  const handleDeleteClick = async () => {
    const ok = await confirm(
      'Delete secret?',
      'Delete this secret? This cannot be undone.',
      { variant: 'danger', confirmLabel: 'Delete', cancelLabel: 'Cancel' }
    );
    if (ok) onDelete(secret.id);
  };

  const handlePickerToggle = (entityId: string) => {
    if (linkedIds.includes(entityId)) {
      onUnlinkEntity(secret.id, entityId);
    } else {
      onLinkEntity(secret.id, entityId);
    }
  };

  const closePicker = useCallback((restoreFocus: boolean = true) => {
    setShowPicker(false);
    // Only steal focus back to the trigger for keyboard dismissal (Escape /
    // Done); a pointer dismissal (e.g. mousedown on a different card) must
    // not yank focus away from wherever the user just clicked.
    if (restoreFocus) linkTriggerRef.current?.focus();
  }, []);

  return (
    <div
      className={twMerge(
        'bg-slate-800 border border-slate-700 rounded-lg border-l-2 pl-3 pr-3 py-3 transition-opacity',
        config.borderColor,
        secret.isRevealed && 'opacity-60'
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Category badge */}
        <span
          className={twMerge(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5',
            config.badgeBg,
            config.badgeText
          )}
        >
          {config.icon}
          {config.label}
        </span>

        {/* Title */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex-1 text-left text-sm font-semibold text-slate-100 hover:text-white transition-colors min-w-0"
        >
          {secret.title}
        </button>

        {/* E1/E2 inbound-clue badge — every revelation card, readable
            without expanding anything. "Inbound" = any secret whose
            revealsSecretId equals this card's id, whatever its own
            category; a self-reference never counts (computed by the
            parent's inboundClueCount). */}
        {secret.category === 'revelation' && (
          <span
            aria-label={`${inboundClueCount} of ${cluesNeededThreshold} clues`}
            className="flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-700/60 text-slate-400"
          >
            {inboundClueCount}/{cluesNeededThreshold}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Reveal toggle */}
          <button
            onClick={handleRevealToggle}
            title={secret.isRevealed ? 'Mark as unrevealed' : 'Reveal to players'}
            aria-label={secret.isRevealed ? 'Mark as unrevealed' : 'Reveal to players'}
            className={twMerge(
              'p-1.5 rounded-md transition-colors',
              secret.isRevealed
                ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            )}
          >
            {secret.isRevealed
              ? <Icons.Eye className="w-4 h-4" />
              : <Icons.EyeOff className="w-4 h-4" />
            }
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded
              ? <Icons.ChevronUp className="w-4 h-4" />
              : <Icons.ChevronDown className="w-4 h-4" />
            }
          </button>

          {/* Delete — uses ConfirmDialog instead of timed double-click */}
          <Button
            variant="icon"
            onClick={handleDeleteClick}
            className="text-slate-600 hover:text-red-400 hover:bg-slate-700"
            title="Delete"
            aria-label="Delete secret"
          >
            <Icons.Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Linked entity chips — always shown when links exist */}
      {linkedEntities.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {linkedEntities.map(entity => (
            <EntityChip
              key={entity.id}
              entity={entity}
              onRemove={expanded ? (id) => onUnlinkEntity(secret.id, id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Revealed status */}
      {secret.isRevealed && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-400/70">
          <Icons.Eye className="w-3 h-3" />
          <span>
            Revealed{sessionName ? ` in ${sessionName}` : ''}
          </span>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2.5 space-y-2">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {secret.content}
          </p>
          {secret.notes && (
            <div className="border-t border-slate-700 pt-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">DM Notes</p>
              <p className="text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap">
                {secret.notes}
              </p>
            </div>
          )}

          {/* Entity link section */}
          <div className="border-t border-slate-700 pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Linked Entities</p>
              <div className="relative">
                <button
                  ref={linkTriggerRef}
                  onClick={() => setShowPicker(prev => !prev)}
                  className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-700"
                >
                  <Icons.Link className="w-3 h-3" />
                  {allEntities.length > 0 ? 'Link entity' : 'No entities'}
                </button>
                {showPicker && allEntities.length > 0 && (
                  <EntityPicker
                    linkedEntityIds={linkedIds}
                    allEntities={allEntities}
                    onToggle={handlePickerToggle}
                    onClose={closePicker}
                    triggerRef={linkTriggerRef}
                  />
                )}
              </div>
            </div>

            {linkedEntities.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {linkedEntities.map(entity => (
                  <EntityChip
                    key={entity.id}
                    entity={entity}
                    onRemove={(id) => onUnlinkEntity(secret.id, id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 italic">
                No entities linked. Use "Link entity" to connect this secret to NPCs, locations, factions, or plots.
              </p>
            )}
          </div>

          {/* E1 mystery edge — "supports revelation" picker, clue cards only */}
          {secret.category === 'clue' && (
            <div className="border-t border-slate-700 pt-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Supports Revelation</p>
              {revelations.length > 0 ? (
                <select
                  aria-label="Supports revelation"
                  value={secret.revealsSecretId ?? ''}
                  onChange={handleRevealsSecretChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">— none —</option>
                  {revelations.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-slate-600 italic">
                  No revelations yet. Create one to link this clue to.
                </p>
              )}
            </div>
          )}

          {/* E1/E2 — vital toggle + clues-needed override, revelation cards only */}
          {secret.category === 'revelation' && (
            <div className="border-t border-slate-700 pt-2 flex items-center gap-3">
              <button
                onClick={handleVitalToggle}
                aria-pressed={!!secret.isVital}
                className={twMerge(
                  'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors',
                  secret.isVital
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                )}
                title="Mark this revelation vital to the mystery (enables the Three-Clue lint)"
              >
                <Icons.Sparkles className="w-3 h-3" />
                Vital
              </button>

              {secret.isVital && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Clues needed</span>
                  <input
                    type="number"
                    min={1}
                    aria-label="Clues needed"
                    value={cluesNeededThreshold}
                    onChange={handleCluesNeededChange}
                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed content preview */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1.5 text-xs text-slate-500 text-left leading-relaxed line-clamp-2 hover:text-slate-400 transition-colors w-full"
        >
          {secret.content}
        </button>
      )}
    </div>
  );
};

// --- Add Form ---

interface AddSecretFormProps {
  campaign: Campaign;
  onAdd: (data: Omit<Secret, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const AddSecretForm: React.FC<AddSecretFormProps> = ({ campaign, onAdd, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<SecretCategory>('secret');
  const [notes, setNotes] = useState('');
  const [linkedEntityIds, setLinkedEntityIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const linkTriggerRef = useRef<HTMLButtonElement>(null);

  const allEntities = useMemo(() => buildPickableEntities(campaign), [campaign]);

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    onAdd({
      title: title.trim(),
      content: content.trim(),
      category,
      isRevealed: false,
      notes: notes.trim() || undefined,
      linkedEntityIds,
    });
  };

  const toggleEntity = (id: string) => {
    setLinkedEntityIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const closePicker = useCallback((restoreFocus: boolean = true) => {
    setShowPicker(false);
    // Only steal focus back to the trigger for keyboard dismissal (Escape /
    // Done); a pointer dismissal must not yank focus away from the click.
    if (restoreFocus) linkTriggerRef.current?.focus();
  }, []);

  const linkedEntities = useMemo(
    () => linkedEntityIds.map(id => allEntities.find(e => e.id === id)).filter(Boolean) as PickableEntity[],
    [linkedEntityIds, allEntities]
  );

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2.5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Entry</p>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title..."
        className={inputClass}
        autoFocus
      />

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="The actual secret, clue, or revelation..."
        rows={3}
        className={twMerge(inputClass, 'resize-none')}
      />

      <select
        value={category}
        onChange={e => setCategory(e.target.value as SecretCategory)}
        className={inputClass}
      >
        <option value="secret">Secret</option>
        <option value="clue">Clue</option>
        <option value="revelation">Revelation</option>
        <option value="rumor">Rumor</option>
      </select>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="DM notes (optional)..."
        rows={2}
        className={twMerge(inputClass, 'resize-none')}
      />

      {/* Entity linking in add form */}
      {allEntities.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Link Entities (optional)</p>
            <div className="relative">
              <button
                ref={linkTriggerRef}
                onClick={() => setShowPicker(prev => !prev)}
                className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800"
              >
                <Icons.Link className="w-3 h-3" />
                Add
              </button>
              {showPicker && (
                <EntityPicker
                  linkedEntityIds={linkedEntityIds}
                  allEntities={allEntities}
                  onToggle={toggleEntity}
                  onClose={closePicker}
                  triggerRef={linkTriggerRef}
                />
              )}
            </div>
          </div>
          {linkedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {linkedEntities.map(entity => (
                <EntityChip
                  key={entity.id}
                  entity={entity}
                  onRemove={toggleEntity}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim()}
          className="flex-1"
        >
          <Icons.Plus className="w-4 h-4 mr-1.5" />
          Add
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

// --- R2: "Generate ten, keep what you like" -------------------------------

interface GenerateTenPanelProps {
  campaign: Campaign;
  isMockMode: boolean;
  /**
   * Reports whether the panel currently has anything of its own to show (an
   * error message, or a non-empty preview) — the caller uses this to
   * suppress the "No secrets yet." roster empty-state so the two don't stack
   * into a confusing double message when the campaign has no secrets.
   */
  onActiveChange: (active: boolean) => void;
}

const GENERATE_TEN_PROMPT = 'Propose roughly ten secrets, clues, revelations, and rumors for this campaign.';

/**
 * R2 (lazy-dm-lens.md) — one model call proposes roughly ten secrets/clues;
 * the GM keeps what they like at no cost to discarding the rest. Widens the
 * shipped `QuickNpcGenerator` generate/preview/keep-discard idiom from one
 * card to a checkable batch. Always creates via `campaignService.createSecret`
 * — nothing is persisted for an unchecked or discarded draft.
 */
const GenerateTenPanel: React.FC<GenerateTenPanelProps> = ({ campaign, isMockMode, onActiveChange }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SecretDraft[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    onActiveChange(error !== null || (drafts !== null && drafts.length > 0));
  }, [error, drafts, onActiveChange]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const campaignContext = buildCampaignContext({ variant: 'generation', campaign });
      const result = await generateSecretBatch(GENERATE_TEN_PROMPT, isMockMode, campaignContext);
      if (result.length === 0) {
        setDrafts(null);
        setError("Nothing came back — try again, or add entries by hand.");
      } else {
        setDrafts(result);
        setChecked(new Set(result.map((_, i) => i)));
      }
    } catch (err) {
      setDrafts(null);
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [campaign, isMockMode]);

  const toggleChecked = useCallback((index: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const handleKeep = useCallback(() => {
    if (!drafts) return;
    drafts.forEach((draft, i) => {
      if (!checked.has(i)) return;
      campaignService.createSecret({
        title: draft.title,
        content: draft.content,
        category: draft.category,
        isRevealed: false,
        ...(draft.notes ? { notes: draft.notes } : {}),
      });
    });
    // One-shot: dismiss immediately so the same batch cannot be kept twice.
    setDrafts(null);
    setChecked(new Set());
  }, [drafts, checked]);

  const handleDiscard = useCallback(() => {
    setDrafts(null);
    setChecked(new Set());
    setError(null);
  }, []);

  return (
    <div className="px-3 pt-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleGenerate}
        disabled={generating}
        className="w-full"
      >
        {generating ? (
          <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <Icons.Sparkles className="w-4 h-4 mr-1.5" />
        )}
        Generate ten
      </Button>

      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}

      {drafts && drafts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {drafts.map((draft, i) => {
            const config = CATEGORY_CONFIG[draft.category];
            return (
              <label
                key={`${draft.title}-${i}`}
                className={twMerge(
                  'flex items-start gap-2 bg-slate-800 border border-slate-700 rounded-lg border-l-2 pl-2.5 pr-3 py-2 cursor-pointer',
                  config.borderColor
                )}
              >
                <input
                  type="checkbox"
                  checked={checked.has(i)}
                  onChange={() => toggleChecked(i)}
                  aria-label={draft.title}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={twMerge(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
                        config.badgeBg,
                        config.badgeText
                      )}
                    >
                      {config.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{draft.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{draft.content}</p>
                  {draft.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">{draft.notes}</p>
                  )}
                </div>
              </label>
            );
          })}

          <div className="flex gap-2 pt-0.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleKeep}
              disabled={checked.size === 0}
              className="flex-1"
            >
              Keep {checked.size}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDiscard}
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export const SecretsTracker: React.FC<SecretsTrackerProps> = ({
  campaign,
  activeSessionId,
  isMockMode = false,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showRevealed, setShowRevealed] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  // R4: "here now" filter — defaults off, and only ever means anything when a
  // scene is actually live (see `activeScene` below).
  const [hereNowOnly, setHereNowOnly] = useState(false);
  // R2: true while GenerateTenPanel has an error or a non-empty preview of
  // its own to show, so the roster's "No secrets yet." empty state doesn't
  // stack with it into a confusing double message.
  const [generateTenActive, setGenerateTenActive] = useState(false);

  const secrets = campaign.secrets || [];

  const allEntities = useMemo(() => buildPickableEntities(campaign), [campaign]);

  // The live scene, resolved across every adventure. `undefined` means the
  // "here now" control is absent, not merely inactive.
  const activeScene = useMemo(() => findActiveScene(campaign), [campaign]);

  // A pressed filter must not silently survive into a *different* scene going
  // live later — reset it whenever the live scene's identity changes.
  const activeSceneId = activeScene?.id;
  React.useEffect(() => {
    setHereNowOnly(false);
  }, [activeSceneId]);

  // The set of entity ids "in the room": the scene's NPCs plus its location.
  const hereNowIds = useMemo(() => {
    if (!activeScene) return null;
    const ids = new Set<string>(activeScene.npcIds ?? []);
    if (activeScene.locationId) ids.add(activeScene.locationId);
    return ids;
  }, [activeScene]);

  // Build a session name lookup for revealed secrets
  const sessionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (campaign.sessionLogs || []).forEach(log => {
      map[log.id] = log.title;
    });
    return map;
  }, [campaign.sessionLogs]);

  const filteredSecrets = useMemo(() => {
    return secrets.filter(s => {
      if (!showRevealed && s.isRevealed) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (hereNowOnly && hereNowIds) {
        const linked = s.linkedEntityIds ?? [];
        if (!linked.some(id => hereNowIds.has(id))) return false;
      }
      return true;
    });
  }, [secrets, showRevealed, categoryFilter, hereNowOnly, hereNowIds]);

  const counts = useMemo(() => {
    const hidden = secrets.filter(s => !s.isRevealed).length;
    const revealed = secrets.filter(s => s.isRevealed).length;
    return { total: secrets.length, hidden, revealed };
  }, [secrets]);

  // E1/E2 mystery edges — the revelation roster for the "Supports revelation"
  // picker, and each revelation's inbound-clue count for its badge. Shared
  // single definition (same as continuityChecker/backlinkUtils): any secret
  // whose revealsSecretId points at S, whatever its own category; a
  // self-reference never counts.
  const revelations = useMemo(() => secrets.filter(s => s.category === 'revelation'), [secrets]);

  const inboundClueCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of secrets) {
      if (s.revealsSecretId && s.revealsSecretId !== s.id) {
        map.set(s.revealsSecretId, (map.get(s.revealsSecretId) ?? 0) + 1);
      }
    }
    return map;
  }, [secrets]);

  const handleUpdateSecret = useCallback((id: string, updates: Partial<Secret>) => {
    campaignService.updateSecret(id, updates);
  }, []);

  const handleAdd = useCallback((data: Omit<Secret, 'id' | 'createdAt'>) => {
    campaignService.createSecret(data);
    setShowAddForm(false);
  }, []);

  const handleReveal = useCallback((id: string, sessionId?: string) => {
    campaignService.revealSecret(id, sessionId);
  }, []);

  const handleUnreveal = useCallback((id: string) => {
    campaignService.updateSecret(id, { isRevealed: false, revealedInSessionId: undefined });
  }, []);

  const handleDelete = useCallback((id: string) => {
    campaignService.deleteSecret(id);
  }, []);

  const handleLinkEntity = useCallback((secretId: string, entityId: string) => {
    const secret = secrets.find(s => s.id === secretId);
    if (!secret) return;
    const current = secret.linkedEntityIds ?? [];
    if (!current.includes(entityId)) {
      campaignService.updateSecret(secretId, { linkedEntityIds: [...current, entityId] });
    }
  }, [secrets]);

  const handleUnlinkEntity = useCallback((secretId: string, entityId: string) => {
    const secret = secrets.find(s => s.id === secretId);
    if (!secret) return;
    const current = secret.linkedEntityIds ?? [];
    campaignService.updateSecret(secretId, { linkedEntityIds: current.filter(id => id !== entityId) });
  }, [secrets]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icons.Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Secrets &amp; Clues</h3>
            {counts.total > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 font-mono">
                {counts.hidden} hidden · {counts.revealed} revealed
              </span>
            )}
          </div>
          <Button
            variant="icon"
            onClick={() => setShowAddForm(prev => !prev)}
            className={showAddForm ? 'bg-amber-600/20 text-amber-400' : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700'}
            title="Add new entry"
          >
            <Icons.Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Show/hide revealed toggle + R4 "here now" scene filter */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setShowRevealed(prev => !prev)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showRevealed
              ? <Icons.Eye className="w-3 h-3" />
              : <Icons.EyeOff className="w-3 h-3" />
            }
            {showRevealed ? 'Hide revealed' : 'Show revealed'}
          </button>

          {/* Only rendered while a scene is actually live — absent, not
              disabled, otherwise. Label is constant; state rides aria-pressed. */}
          {activeScene && (
            <button
              onClick={() => setHereNowOnly(prev => !prev)}
              aria-pressed={hereNowOnly}
              className={twMerge(
                'flex items-center gap-1.5 text-xs transition-colors',
                hereNowOnly
                  ? 'text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
              title="Show only secrets linked to the active scene's NPCs or location"
            >
              <Icons.MapPin className="w-3 h-3" />
              Here now
            </button>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setCategoryFilter(f.value)}
              className={twMerge(
                'px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                categoryFilter === f.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* R2: "Generate ten, keep what you like" */}
      <div className="border-b border-slate-800 pb-2 flex-shrink-0">
        <GenerateTenPanel campaign={campaign} isMockMode={isMockMode} onActiveChange={setGenerateTenActive} />
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {/* Add form */}
        {showAddForm && (
          <AddSecretForm
            campaign={campaign}
            onAdd={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Empty state */}
        {filteredSecrets.length === 0 && !showAddForm && !generateTenActive && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icons.Lock className="w-8 h-8 text-slate-700 mb-2" />
            {secrets.length === 0 ? (
              <>
                <p className="text-sm text-slate-500">No secrets yet.</p>
                <p className="text-xs text-slate-600 mt-1 italic max-w-[200px]">
                  Every great campaign has hidden truths.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-3 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Add the first one
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500">No entries match the current filter.</p>
            )}
          </div>
        )}

        {/* Secret cards */}
        {filteredSecrets.map(secret => (
          <SecretCard
            key={secret.id}
            secret={secret}
            sessionName={secret.revealedInSessionId ? sessionNameMap[secret.revealedInSessionId] : undefined}
            activeSessionId={activeSessionId}
            allEntities={allEntities}
            revelations={revelations}
            inboundClueCount={inboundClueCounts.get(secret.id) ?? 0}
            onReveal={handleReveal}
            onUnreveal={handleUnreveal}
            onDelete={handleDelete}
            onLinkEntity={handleLinkEntity}
            onUnlinkEntity={handleUnlinkEntity}
            onUpdateSecret={handleUpdateSecret}
          />
        ))}
      </div>
    </div>
  );
};
