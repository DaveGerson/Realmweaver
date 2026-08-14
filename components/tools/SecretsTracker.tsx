
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Campaign, Secret } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';

// --- Types ---

type SecretCategory = Secret['category'];
type CategoryFilter = 'all' | SecretCategory;

interface SecretsTrackerProps {
  campaign: Campaign;
  activeSessionId?: string;
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
  const config = ENTITY_TYPE_CONFIG[entity.type];
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
  onClose: () => void;
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
      if (e.key === 'Escape') onClose();
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
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
        <button onClick={onClose} className="block mt-2 text-amber-400 hover:text-amber-300">Close</button>
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
          const config = ENTITY_TYPE_CONFIG[type];
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
          onClick={onClose}
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
  onReveal: (id: string, sessionId?: string) => void;
  onUnreveal: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkEntity: (secretId: string, entityId: string) => void;
  onUnlinkEntity: (secretId: string, entityId: string) => void;
}

const SecretCard: React.FC<SecretCardProps> = ({
  secret,
  sessionName,
  activeSessionId,
  allEntities,
  onReveal,
  onUnreveal,
  onDelete,
  onLinkEntity,
  onUnlinkEntity,
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

  const closePicker = useCallback(() => {
    setShowPicker(false);
    linkTriggerRef.current?.focus();
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

  const closePicker = useCallback(() => {
    setShowPicker(false);
    linkTriggerRef.current?.focus();
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

// --- Main Component ---

export const SecretsTracker: React.FC<SecretsTrackerProps> = ({
  campaign,
  activeSessionId,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showRevealed, setShowRevealed] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const secrets = campaign.secrets || [];

  const allEntities = useMemo(() => buildPickableEntities(campaign), [campaign]);

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
      return true;
    });
  }, [secrets, showRevealed, categoryFilter]);

  const counts = useMemo(() => {
    const hidden = secrets.filter(s => !s.isRevealed).length;
    const revealed = secrets.filter(s => s.isRevealed).length;
    return { total: secrets.length, hidden, revealed };
  }, [secrets]);

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

        {/* Show/hide revealed toggle */}
        <button
          onClick={() => setShowRevealed(prev => !prev)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
        >
          {showRevealed
            ? <Icons.Eye className="w-3 h-3" />
            : <Icons.EyeOff className="w-3 h-3" />
          }
          {showRevealed ? 'Hide revealed' : 'Show revealed'}
        </button>

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
        {filteredSecrets.length === 0 && !showAddForm && (
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
            onReveal={handleReveal}
            onUnreveal={handleUnreveal}
            onDelete={handleDelete}
            onLinkEntity={handleLinkEntity}
            onUnlinkEntity={handleUnlinkEntity}
          />
        ))}
      </div>
    </div>
  );
};
