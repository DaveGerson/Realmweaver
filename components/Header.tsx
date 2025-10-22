import React, { useState } from 'react';
import { Icons } from './Icons';

interface HeaderProps {
  isMockMode: boolean;
  onToggleMockMode: () => void;
  onToggleCoach: () => void;
  onToggleWizard: () => void;
  onSaveCampaign: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isMockMode, onToggleMockMode, onToggleCoach, onToggleWizard, onSaveCampaign }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    onSaveCampaign();
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  return (
    <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Icons.Campaign className="w-6 h-6 text-indigo-400" />
        <h1 className="text-lg font-bold font-serif text-slate-100">RealmWeaver</h1>
      </div>
      <div className="flex items-center gap-6">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
          aria-label="Save Campaign"
        >
          <Icons.Save className={`w-5 h-5 ${saveStatus === 'saved' ? 'text-green-400' : 'text-indigo-400'}`} />
          <span>{saveStatus === 'saved' ? 'Saved!' : 'Save Campaign'}</span>
        </button>
        <button 
          onClick={onToggleWizard} 
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
          aria-label="Toggle Evocation Wizard"
        >
          <Icons.Wizard className="w-5 h-5 text-indigo-400" />
          <span>Evocation Wizard</span>
        </button>
         <button 
            onClick={onToggleCoach} 
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
            aria-label="Toggle DM Coach"
          >
          <Icons.Coach className="w-5 h-5 text-indigo-400" />
          <span>DM Coach</span>
        </button>
        <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isMockMode ? 'text-indigo-400' : 'text-slate-500'}`}>
              Mock Mode
            </span>
            <button
              onClick={onToggleMockMode}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                isMockMode ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={isMockMode}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isMockMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
        </div>
      </div>
    </header>
  );
};
