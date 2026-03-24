
import React, { useState, useMemo, useCallback } from 'react';
import type { Campaign, Secret } from '../../types/index';
import { Icons } from '../common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';

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

// --- Sub-components ---

interface SecretCardProps {
  secret: Secret;
  sessionName?: string;
  activeSessionId?: string;
  onReveal: (id: string, sessionId?: string) => void;
  onUnreveal: (id: string) => void;
  onDelete: (id: string) => void;
}

const SecretCard: React.FC<SecretCardProps> = ({
  secret,
  sessionName,
  activeSessionId,
  onReveal,
  onUnreveal,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const config = CATEGORY_CONFIG[secret.category];

  const handleRevealToggle = () => {
    if (secret.isRevealed) {
      onUnreveal(secret.id);
    } else {
      onReveal(secret.id, activeSessionId);
    }
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(secret.id);
    } else {
      setConfirmDelete(true);
      // Auto-cancel confirm after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

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

          {/* Delete */}
          <button
            onClick={handleDeleteClick}
            className={twMerge(
              'p-1.5 rounded-md transition-colors text-xs',
              confirmDelete
                ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30'
                : 'text-slate-600 hover:text-red-400 hover:bg-slate-700'
            )}
            title={confirmDelete ? 'Click again to confirm delete' : 'Delete'}
          >
            {confirmDelete
              ? <span className="font-bold text-[10px]">Sure?</span>
              : <Icons.Trash className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

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
  onAdd: (data: Omit<Secret, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const AddSecretForm: React.FC<AddSecretFormProps> = ({ onAdd, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<SecretCategory>('secret');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    onAdd({
      title: title.trim(),
      content: content.trim(),
      category,
      isRevealed: false,
      notes: notes.trim() || undefined,
      linkedEntityIds: [],
    });
  };

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

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          <Icons.Plus className="w-4 h-4" />
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
        >
          Cancel
        </button>
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icons.Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Secrets & Clues</h3>
            {counts.total > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 font-mono">
                {counts.hidden} hidden · {counts.revealed} revealed
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className={twMerge(
              'p-1.5 rounded-md transition-colors',
              showAddForm
                ? 'bg-amber-600/20 text-amber-400'
                : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700'
            )}
            title="Add new entry"
          >
            <Icons.Plus className="w-4 h-4" />
          </button>
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
            onReveal={handleReveal}
            onUnreveal={handleUnreveal}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};
