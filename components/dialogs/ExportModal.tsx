
import React from 'react';
import { Icons } from '../common/Icons';

interface ExportModalProps {
  onClose: () => void;
  onExportJson: () => void;
  onExportObsidian: () => void;
  campaignTitle: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExportJson, onExportObsidian, campaignTitle }) => {
  return (
    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative">
        <header className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Icons.FileDown className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-bold font-serif">Export Campaign</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" aria-label="Close">
            <Icons.X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-6 space-y-4">
            <p className="text-slate-400 text-center">Choose an export format for <span className="font-semibold text-slate-200">{campaignTitle}</span>.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ExportOption
                    icon={Icons.FileCode}
                    title="JSON Backup"
                    description="A complete backup of your campaign data. Use this to save your work or move it to another device."
                    onClick={onExportJson}
                />
                <ExportOption
                    icon={Icons.FileText}
                    title="Obsidian Markdown"
                    description="A single, formatted Markdown file compatible with Obsidian and other note-taking apps."
                    onClick={onExportObsidian}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

const ExportOption: React.FC<{ icon: React.ElementType, title: string, description: string, onClick: () => void }> = ({ icon: Icon, title, description, onClick }) => (
    <button
        onClick={onClick}
        className="p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-left transition-all hover:border-amber-500/50 hover:ring-2 hover:ring-amber-500/20"
    >
        <div className="flex items-center gap-4">
            <Icon className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
                <h3 className="font-semibold text-slate-100">{title}</h3>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
            </div>
        </div>
    </button>
);
