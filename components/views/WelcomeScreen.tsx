
import React from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
        <Icons.Campaign className="w-16 h-16 mx-auto text-indigo-500" />
        <h1 className="mt-6 text-4xl font-bold font-serif text-slate-100">Welcome to RealmWeaver</h1>
        <p className="mt-2 text-lg text-slate-400">
          Your AI-powered companion for crafting unforgettable tabletop RPG campaigns.
        </p>
        <Button onClick={onStart} size="lg" className="mt-8">
          Create Your First Campaign
        </Button>
      </div>
    </div>
  );
};
