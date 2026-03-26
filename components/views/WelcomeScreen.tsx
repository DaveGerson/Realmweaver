
import React, { useRef } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface WelcomeScreenProps {
  onStart: () => void;
  onImportCampaign?: (file: File) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onImportCampaign }) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportCampaign) {
      onImportCampaign(file);
    }
    // Reset so the same file can be re-imported if needed
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
        <Icons.Campaign className="w-16 h-16 mx-auto text-amber-500" />
        <h1 className="mt-6 text-4xl font-bold font-serif text-slate-100">Welcome to RealmWeaver</h1>
        <p className="mt-2 text-lg text-slate-400">
          Your AI-powered companion for crafting unforgettable tabletop RPG campaigns.
        </p>
        <Button onClick={onStart} size="lg" className="mt-8">
          Create a Campaign
        </Button>
        {onImportCampaign && (
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              className="hidden"
              aria-hidden="true"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={handleImportClick}
              className="mt-4 underline underline-offset-4 text-slate-400 hover:text-amber-400"
            >
              Import an existing campaign
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
