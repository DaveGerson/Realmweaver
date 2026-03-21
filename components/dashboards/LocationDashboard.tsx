
import React, { useState } from 'react';
import type { Location, Faction } from '../../types/index';
import { LocationGenerator } from '../generators/LocationGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { LocationEditor } from '../editors/LocationEditor';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultLocation } from '../../utils/entityUtils';

const LOCATION_PROMPT_CHIPS = [
  'A haunted tavern',
  'An ancient temple',
  'A bustling marketplace',
  'A hidden cave',
];

interface LocationDashboardProps {
  locations: Location[];
  factions?: Faction[];
  onLocationCreated: (data: Omit<Location, 'id'>) => void;
  onSelectLocation: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const LocationDashboard: React.FC<LocationDashboardProps> = ({ locations, factions = [], onLocationCreated, onSelectLocation, isMockMode, isOfficialSetting, campaignContext }) => {
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>('chat');

  const handleLocationCreated = (data: any) => {
    const { id, ...locationData } = data;
    onLocationCreated({
      ...locationData,
      parentLocationId: undefined,
      subLocationIds: locationData.subLocationIds ?? [],
      connections: locationData.connections ?? [],
      pointsOfInterest: locationData.pointsOfInterest ?? [],
      loot: locationData.loot ?? [],
    });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      {/* Creation Area */}
      <div className="space-y-3">
        {/* Mode toggle header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold font-serif text-slate-100">
              {creationMode === 'chat' ? 'Create via Chat' : 'Location Generator'}
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreationMode(creationMode === 'chat' ? 'form' : 'chat')}
          >
            {creationMode === 'chat' ? (
              <>
                <Icons.FileText className="w-4 h-4 mr-2" />
                Switch to form
              </>
            ) : (
              <>
                <Icons.Chat className="w-4 h-4 mr-2" />
                Switch to chat
              </>
            )}
          </Button>
        </div>

        {/* Creation panel */}
        {creationMode === 'chat' ? (
          <div className="h-[480px] border border-slate-800 rounded-xl overflow-hidden">
            <EntityChatGenerator
              entityType="location"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={handleLocationCreated}
              initialData={createDefaultLocation()}
              promptChips={LOCATION_PROMPT_CHIPS}
              renderPreview={(data, onUpdate) => (
                <LocationEditor
                  location={{ ...data, id: 'preview' }}
                  allLocations={locations}
                  allFactions={factions}
                  onUpdate={(_, updates) => onUpdate(updates)}
                  onDelete={() => {}}
                  isMockMode={isMockMode}
                />
              )}
            />
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            <LocationGenerator
              onLocationCreated={onLocationCreated}
              isMockMode={isMockMode}
              isOfficialSetting={isOfficialSetting}
              allLocations={locations}
              factions={factions}
              campaignContext={campaignContext}
            />
          </div>
        )}
      </div>

      {/* Entity List */}
      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Locations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map(location => (
            <button
              key={location.id}
              onClick={() => onSelectLocation(location.id)}
              className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-emerald-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-emerald-400 transition-all space-y-2"
            >
              <h3 className="font-semibold text-emerald-400">{location.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2">{location.description}</p>
            </button>
          ))}
          {locations.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.Locations className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">Your world awaits -- where does the adventure begin?</p>
              <p className="text-sm text-slate-600">Use the generator to create taverns, dungeons, and forgotten ruins.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
