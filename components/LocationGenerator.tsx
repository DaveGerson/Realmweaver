import React, { useState } from 'react';
import type { Location } from '../types';
import { generateLocation } from '../services/geminiService';
import { Icons } from './Icons';
import { Button } from './common/Button';

interface LocationGeneratorProps {
  onLocationCreated: (location: Omit<Location, 'id'>) => void;
  isMockMode: boolean;
}

export const LocationGenerator: React.FC<LocationGeneratorProps> = ({ onLocationCreated, isMockMode }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const locationData = await generateLocation(prompt, isMockMode);
      const newLocation: Omit<Location, 'id'> = {
          ...locationData,
          parentLocationId: undefined,
          subLocationIds: [],
          connections: [],
          pointsOfInterest: [],
          loot: [],
      }
      onLocationCreated(newLocation);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate location. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="relative bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10 transition-opacity duration-300 animate-in fade-in">
          <Icons.Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="mt-2 text-sm text-slate-300">Generating Location...</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-200 font-serif">Generate New Location</h3>
      </div>
      <p className="text-sm text-slate-400">
        Describe a location. (e.g., "A forgotten library hidden behind a waterfall.")
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter location prompt here..."
        rows={3}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Icons.Coach className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Icons.Locations className="w-4 h-4 mr-2" />
            Create Location
          </>
        )}
      </Button>
    </div>
  );
};