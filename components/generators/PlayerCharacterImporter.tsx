
import React, { useState, useRef } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface PlayerCharacterImporterProps {
  onImport: (file: File) => Promise<void>;
  isMockMode: boolean;
}

export const PlayerCharacterImporter: React.FC<PlayerCharacterImporterProps> = ({ onImport, isMockMode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      await onImport(file);
    } catch (err) {
      setError('Failed to import character sheet. The PDF might be in an unsupported format.');
      console.error(err);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
          <Icons.Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="mt-4 text-md text-slate-300">Reading Character Sheet...</p>
          <p className="text-xs text-slate-400">(This may take a moment)</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Icons.FileUp className="w-7 h-7 text-indigo-400" />
        <h2 className="text-2xl font-bold font-serif text-slate-100">Import Character</h2>
      </div>
      <p className="text-sm text-slate-400 flex-grow">
        Upload a character sheet PDF from D&D Beyond. The AI will parse it and add the character to your campaign.
      </p>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="application/pdf"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      <Button onClick={handleButtonClick} disabled={isLoading} size="lg" className="w-full mt-auto">
        {isLoading ? 'Importing...' : 'Import from PDF'}
      </Button>
    </div>
  );
};
