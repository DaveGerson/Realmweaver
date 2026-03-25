
import React from 'react';
import type { Campaign } from '../../types/index';
import type { DmStyle } from '../../types/CampaignSetting';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface CrossCampaignDashboardProps {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSwitchCampaign: (id: string) => void;
  onCreateCampaign: () => void;
  onDuplicateCampaign: (id: string) => void;
  onDeleteCampaign: (id: string) => void;
}

// --- Helpers ---

const DM_STYLE_LABELS: Record<DmStyle, string> = {
  guided: 'Guided',
  standard: 'Standard',
  power: 'Power',
};

const DM_STYLE_COLORS: Record<DmStyle, string> = {
  guided: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  standard: 'bg-amber-900/60 text-amber-300 border-amber-700',
  power: 'bg-purple-900/60 text-purple-300 border-purple-700',
};

const formatDate = (isoDate: string | undefined): string => {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

const getLastSessionDate = (campaign: Campaign): string | undefined => {
  const logs = campaign.sessionLogs ?? [];
  if (logs.length === 0) return undefined;
  // Sort completed sessions by date descending
  const completed = [...logs]
    .filter(l => l.status === 'completed' && l.sessionDate)
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  return completed[0]?.sessionDate;
};

const getActiveplotCount = (campaign: Campaign): number =>
  (campaign.plots ?? []).filter(p => p.status === 'active').length;

// --- Entity count badge ---

interface CountBadgeProps {
  label: string;
  count: number;
  colorClass: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({ label, count, colorClass }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
    {count} {label}
  </span>
);

// --- Campaign card ---

interface CampaignCardProps {
  campaign: Campaign;
  onSwitch: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSwitch, onDuplicate, onDelete }) => {
  const { confirm } = useConfirmDialog();

  const dmStyle: DmStyle = campaign.dmStyle ?? 'standard';
  const lastSessionDate = getLastSessionDate(campaign);
  const sessionCount = (campaign.sessionLogs ?? []).length;
  const activePlots = getActiveplotCount(campaign);
  const settingLabel = campaign.settingType === 'official' && campaign.officialSetting
    ? campaign.officialSetting
    : campaign.setting;

  const handleDeleteClick = async () => {
    const ok = await confirm(
      `Delete "${campaign.title}"?`,
      'This will permanently delete the campaign and all its content. This action cannot be undone.',
      { variant: 'danger', confirmLabel: 'Delete Campaign', cancelLabel: 'Cancel' }
    );
    if (ok) onDelete();
  };

  return (
    <div className="flex flex-col bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-amber-600/50 transition-colors group">
      {/* Card header */}
      <div className="p-4 pb-3 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-lg font-bold font-serif text-slate-100 group-hover:text-amber-400 transition-colors leading-tight line-clamp-2">
            {campaign.title}
          </h2>
          <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${DM_STYLE_COLORS[dmStyle]}`}>
            {DM_STYLE_LABELS[dmStyle]}
          </span>
        </div>

        {/* Setting */}
        {settingLabel && (
          <p className="text-sm text-slate-400 line-clamp-1 mb-3">{settingLabel}</p>
        )}

        {/* Entity count badges — colors derived from ENTITY_TYPE_CONFIG */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(
            [
              { key: 'npc',       count: campaign.npcs.length },
              { key: 'location',  count: campaign.locations.length },
              { key: 'faction',   count: campaign.factions.length },
              { key: 'adventure', count: campaign.adventures.length },
            ] as const
          ).map(({ key, count }) => {
            const c = ENTITY_TYPE_CONFIG[key].color;
            return (
              <CountBadge
                key={key}
                label={ENTITY_TYPE_CONFIG[key].label}
                count={count}
                colorClass={`bg-${c}-900/50 text-${c}-300 border-${c}-700/50`}
              />
            );
          })}
        </div>

        {/* Session info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {sessionCount > 0 && (
            <span className="flex items-center gap-1">
              <Icons.SessionLog className="w-3.5 h-3.5" />
              {sessionCount} session{sessionCount !== 1 ? 's' : ''}
              {lastSessionDate && (
                <span className="text-slate-500"> &middot; Last: {formatDate(lastSessionDate)}</span>
              )}
            </span>
          )}
          {activePlots > 0 && (
            <span className="flex items-center gap-1">
              <Icons.Plot className="w-3.5 h-3.5 text-amber-500" />
              {activePlots} active plot{activePlots !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Card footer — actions */}
      <div className="px-4 py-3 border-t border-slate-700 flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onSwitch}
          className="flex-1"
        >
          <Icons.Play className="w-3.5 h-3.5 mr-1.5" />
          Continue
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onDuplicate}
          title="Duplicate campaign"
          aria-label={`Duplicate ${campaign.title}`}
        >
          <Icons.Duplicate className="w-3.5 h-3.5" />
          <span className="hidden sm:inline ml-1.5">Duplicate</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleDeleteClick}
          className="text-slate-400 hover:bg-red-900/60 hover:text-red-300"
          title="Delete campaign"
          aria-label={`Delete ${campaign.title}`}
        >
          <Icons.Trash className="w-3.5 h-3.5" />
          <span className="hidden sm:inline ml-1.5">Delete</span>
        </Button>
      </div>
    </div>
  );
};

// --- "Create new" card ---

const CreateNewCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-amber-500 hover:bg-slate-800/50 transition-all group min-h-[180px]"
    aria-label="Create new campaign"
  >
    <div className="w-12 h-12 rounded-full bg-slate-700 group-hover:bg-amber-600/20 flex items-center justify-center transition-colors">
      <Icons.Plus className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
    </div>
    <span className="text-slate-400 group-hover:text-amber-400 font-medium transition-colors">
      Create New Campaign
    </span>
  </button>
);

// --- Main dashboard ---

export const CrossCampaignDashboard: React.FC<CrossCampaignDashboardProps> = ({
  campaigns,
  onSwitchCampaign,
  onCreateCampaign,
  onDuplicateCampaign,
  onDeleteCampaign,
}) => {
  // Sort: put campaigns with more recent session activity first.
  // For campaigns with no sessions, fall back to title order.
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aDate = getLastSessionDate(a);
    const bDate = getLastSessionDate(b);
    if (aDate && bDate) return new Date(bDate).getTime() - new Date(aDate).getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    // Both have no sessions — compare by total entity count (richer campaign first)
    const aCount = a.npcs.length + a.locations.length + a.factions.length + a.adventures.length;
    const bCount = b.npcs.length + b.locations.length + b.factions.length + b.adventures.length;
    return bCount - aCount;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Icons.AllCampaigns className="w-7 h-7 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">All Campaigns</h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base ml-10">
            {campaigns.length === 0
              ? 'No campaigns yet. Create your first one below.'
              : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} — select one to continue your story.`}
          </p>
        </div>

        {/* Campaign grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCampaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSwitch={() => onSwitchCampaign(campaign.id)}
              onDuplicate={() => onDuplicateCampaign(campaign.id)}
              onDelete={() => onDeleteCampaign(campaign.id)}
            />
          ))}

          {/* "Create new" always at the end */}
          <CreateNewCard onClick={onCreateCampaign} />
        </div>
      </div>
    </div>
  );
};
