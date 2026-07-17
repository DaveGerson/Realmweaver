
import React from 'react';
import type { Location, Faction } from '../../types/index';
import { LocationGenerator } from '../generators/LocationGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { LocationEditor } from '../editors/LocationEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
import { createDefaultLocation } from '../../utils/entityUtils';
import { useEntitySearch } from '../../hooks/useEntitySearch';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

const LOCATION_PROMPT_CHIPS = [
  'A haunted tavern',
  'An ancient temple',
  'A bustling marketplace',
  'A hidden cave',
];

interface LocationCardProps {
  location: Location;
  parent?: Location;
  index: number;
  onSelectLocation: (id: string) => void;
  getRovingProps: (index: number) => Record<string, unknown>;
}

const LocationCard = React.memo(function LocationCard({ location, parent, index, onSelectLocation, getRovingProps }: LocationCardProps) {
  const connectionCount = location.connections?.length ?? 0;
  const descSnippet = location.description ? location.description.slice(0, 80) + (location.description.length > 80 ? '…' : '') : '';
  return (
    <button
      onClick={() => onSelectLocation(location.id)}
      className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-emerald-500 text-left hover:border-slate-700 hover:border-l-emerald-400 transition-all space-y-2"
      {...getRovingProps(index)}
    >
      <h3 className="font-semibold text-emerald-400 leading-tight">{location.name}</h3>
      {descSnippet && (
        <p className="text-xs text-slate-400 leading-relaxed">{descSnippet}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {connectionCount > 0 && (
          <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">
            {connectionCount} {connectionCount === 1 ? 'connection' : 'connections'}
          </span>
        )}
        {parent && (
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Icons.ChevronRight className="w-3 h-3" />{parent.name}
          </span>
        )}
      </div>
    </button>
  );
});

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
  const { filteredEntities: filteredLocations, searchTerm, setSearchTerm } = useEntitySearch(locations, ['name', 'description', 'secrets']);
  const { getRovingProps } = useRovingTabIndex({ direction: 'both', columns: { base: 1, md: 2, xl: 3 } });
  const locationsById = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

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
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <EntityCreationPanel
        entityLabel="Location"
        chatPanel={
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
        }
        formPanel={
          <LocationGenerator
            onLocationCreated={onLocationCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            allLocations={locations}
            factions={factions}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Existing Locations ({locations.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search locations..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLocations.map((location, index) => {
            const parent = location.parentLocationId ? locationsById.get(location.parentLocationId) : undefined;
            return (
              <LocationCard
                key={location.id}
                location={location}
                parent={parent}
                index={index}
                onSelectLocation={onSelectLocation}
                getRovingProps={getRovingProps}
              />
            );
          })}
          {filteredLocations.length === 0 && locations.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No locations match "{searchTerm}"</p>
            </div>
          )}
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
