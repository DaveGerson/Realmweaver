
import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { DialogShell } from '../common/DialogShell';
import { useToast } from '@/hooks/useToast';

export interface ExportEntityCounts {
  npcs: number;
  locations: number;
  factions: number;
  items: number;
  adventures: number;
  articles: number;
  sessionLogs: number;
  plots: number;
  playerCharacters: number;
}

interface ExportModalProps {
  onClose: () => void;
  onExportJson: () => void;
  onExportObsidian: () => void;
  campaignTitle: string;
  entityCounts?: ExportEntityCounts;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  onClose,
  onExportJson,
  onExportObsidian,
  campaignTitle,
  entityCounts,
}) => {
  const [loadingFormat, setLoadingFormat] = useState<'json' | 'obsidian' | null>(null);
  const { addToast } = useToast();

  const handleExport = async (format: 'json' | 'obsidian') => {
    setLoadingFormat(format);
    try {
      if (format === 'json') {
        onExportJson();
        addToast(`"${campaignTitle}" exported as JSON backup.`, 'success');
      } else {
        onExportObsidian();
        addToast(`"${campaignTitle}" exported as Obsidian Markdown.`, 'success');
      }
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      addToast('Export failed. Please try again.', 'error');
    } finally {
      setLoadingFormat(null);
    }
  };

  const totalEntities = entityCounts
    ? entityCounts.npcs + entityCounts.locations + entityCounts.factions +
      entityCounts.items + entityCounts.adventures + entityCounts.articles +
      entityCounts.sessionLogs + entityCounts.plots + entityCounts.playerCharacters
    : null;

  const isLoading = loadingFormat !== null;

  return (
    <DialogShell isOpen={true} onClose={onClose} ariaLabel="Export Campaign">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative">
        <header className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Icons.FileDown className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-bold font-serif">Export Campaign</h2>
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <Icons.X className="w-5 h-5" />
          </Button>
        </header>
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-slate-400">
              Choose an export format for{' '}
              <span className="font-semibold text-slate-200">{campaignTitle}</span>.
            </p>
            {totalEntities !== null && (
              <p className="text-xs text-slate-500 mt-1">
                {totalEntities} entities will be included
                {entityCounts && (
                  <>
                    {' '}({[
                      entityCounts.npcs > 0 && `${entityCounts.npcs} NPCs`,
                      entityCounts.locations > 0 && `${entityCounts.locations} locations`,
                      entityCounts.factions > 0 && `${entityCounts.factions} factions`,
                      entityCounts.adventures > 0 && `${entityCounts.adventures} adventures`,
                      entityCounts.items > 0 && `${entityCounts.items} items`,
                      entityCounts.articles > 0 && `${entityCounts.articles} articles`,
                      entityCounts.sessionLogs > 0 && `${entityCounts.sessionLogs} session logs`,
                      entityCounts.plots > 0 && `${entityCounts.plots} plots`,
                      entityCounts.playerCharacters > 0 && `${entityCounts.playerCharacters} PCs`,
                    ].filter(Boolean).join(', ')})
                  </>
                )}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExportOption
              icon={Icons.FileCode}
              title="JSON Backup"
              description="A complete backup of your campaign data. Use this to save your work or move it to another device."
              onClick={() => handleExport('json')}
              isLoading={loadingFormat === 'json'}
              disabled={isLoading}
            />
            <ExportOption
              icon={Icons.FileText}
              title="Obsidian Markdown"
              description="A single, formatted Markdown file compatible with Obsidian and other note-taking apps."
              onClick={() => handleExport('obsidian')}
              isLoading={loadingFormat === 'obsidian'}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </DialogShell>
  );
};

interface ExportOptionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const ExportOption: React.FC<ExportOptionProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  isLoading,
  disabled,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition-all hover:border-amber-500/50 hover:ring-2 hover:ring-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50 disabled:hover:border-slate-700 disabled:hover:ring-0"
  >
    <div className="flex items-center gap-4">
      {isLoading ? (
        <Icons.Loader className="w-8 h-8 text-amber-400 flex-shrink-0 animate-spin" />
      ) : (
        <Icon className="w-8 h-8 text-amber-400 flex-shrink-0" />
      )}
      <div>
        <h3 className="font-semibold text-slate-100">{title}</h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  </button>
);
