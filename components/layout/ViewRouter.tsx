
import React, { Suspense, useCallback } from 'react';
import type { Campaign } from '@/types/Campaign';
import type { Adventure, Scene } from '@/types/index';
import type { EditorView, GeneratorType } from '@/App';
import { campaignService } from '@/services/campaignService';

import { ContentWrapper } from '@/components/layout/ContentWrapper';
import { SessionRunner } from '@/components/views/SessionRunner';
import { SceneGenerator } from '@/components/generators/SceneGenerator';
import { NpcDashboard } from '@/components/dashboards/NpcDashboard';
import { LocationDashboard } from '@/components/dashboards/LocationDashboard';
import { FactionDashboard } from '@/components/dashboards/FactionDashboard';
import { ItemDashboard } from '@/components/dashboards/ItemDashboard';
import { AdventureDashboard } from '@/components/dashboards/AdventureDashboard';
import { ArticleDashboard } from '@/components/dashboards/ArticleDashboard';
import { SessionLogDashboard } from '@/components/dashboards/SessionLogDashboard';
import { PlayerCharacterDashboard } from '@/components/dashboards/PlayerCharacterDashboard';
import { PlotDashboard } from '@/components/dashboards/PlotDashboard';
import { NpcEditor } from '@/components/editors/NpcEditor';
import { LocationEditor } from '@/components/editors/LocationEditor';
import { FactionEditor } from '@/components/editors/FactionEditor';
import { ItemEditor } from '@/components/editors/ItemEditor';
import { AdventureEditor } from '@/components/editors/AdventureEditor';
import { SceneEditor } from '@/components/editors/SceneEditor';
import { ArticleEditor } from '@/components/editors/ArticleEditor';
import { SessionLogEditor } from '@/components/editors/SessionLogEditor';
import { PlayerCharacterEditor } from '@/components/editors/PlayerCharacterEditor';
import { PlotEditor } from '@/components/editors/PlotEditor';
import { NoteEditor } from '@/components/editors/NoteEditor';
import { NoteDashboard } from '@/components/dashboards/NoteDashboard';
import { CampaignSettingEditor } from '@/components/editors/CampaignSettingEditor';
import { CombatTracker } from '@/components/tools/CombatTracker';
import { SecretsTracker } from '@/components/tools/SecretsTracker';
import { Icons } from '@/components/common/Icons';
import { TonightsTable } from '@/components/views/TonightsTable';

// Lazy-loaded RelationshipGraph — pulls in D3
const RelationshipGraph = React.lazy(() => import('@/components/visualizers/RelationshipGraph').then(m => ({ default: m.RelationshipGraph })));

const VisualizerFallback = () => (
  <div className="flex items-center justify-center p-8 text-slate-400">
    <Icons.Loader className="w-5 h-5 animate-spin mr-2" />
    Loading...
  </div>
);

export interface ViewRouterProps {
  campaign: Campaign;
  activeView: EditorView;
  activeGenerator: GeneratorType | null;
  isOfficialSetting: boolean;
  isMockMode: boolean;
  campaignContext: string | undefined;

  // Resolved selected entities
  selectedAdventure: Adventure | null;
  selectedScene: Scene | null;
  selectedNpc: Campaign['npcs'][number] | null;
  selectedLocation: Campaign['locations'][number] | null;
  selectedFaction: Campaign['factions'][number] | null;
  selectedItem: Campaign['items'][number] | null;
  selectedArticle: Campaign['articles'][number] | null;
  selectedSessionLog: NonNullable<Campaign['sessionLogs']>[number] | null;
  selectedPlayerCharacter: NonNullable<Campaign['playerCharacters']>[number] | null;
  selectedPlot: NonNullable<Campaign['plots']>[number] | null;
  selectedNote: NonNullable<Campaign['notes']>[number] | null;

  // Callbacks
  onEndSession: () => void;
  onOpenCoach: () => void;
  onNavigate: (entityType: string, entityId: string) => void;
  onResetSelections: () => void;
  onSetActiveView: (view: EditorView) => void;
  onSetActiveGenerator: (type: GeneratorType | null) => void;
  onSetSelectedAdventureId: (id: string | null) => void;
  onSetSelectedSceneId: (id: string | null) => void;
  onSetSelectedNpcId: (id: string | null) => void;
  onSetSelectedLocationId: (id: string | null) => void;
  onSetSelectedFactionId: (id: string | null) => void;
  onSetSelectedItemId: (id: string | null) => void;
  onSetSelectedArticleId: (id: string | null) => void;
  onSetSelectedSessionLogId: (id: string | null) => void;
  onSetSelectedPlayerCharacterId: (id: string | null) => void;
  onSetSelectedPlotId: (id: string | null) => void;
  onSetSelectedNoteId: (id: string | null) => void;
  onGoLive: (sessionLogId: string) => void;
  /** The near-zero-prep on-ramp: start a freeform session with no wizard (unstructured play). */
  onQuickStart?: () => void;
  onImportPC: (file: File) => Promise<string>;
  onAddToast: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

export const ViewRouter: React.FC<ViewRouterProps> = ({
  campaign,
  activeView,
  activeGenerator,
  isOfficialSetting,
  isMockMode,
  campaignContext,
  selectedAdventure,
  selectedScene,
  selectedNpc,
  selectedLocation,
  selectedFaction,
  selectedItem,
  selectedArticle,
  selectedSessionLog,
  selectedPlayerCharacter,
  selectedPlot,
  selectedNote,
  onEndSession,
  onOpenCoach,
  onNavigate,
  onResetSelections,
  onSetActiveView,
  onSetActiveGenerator,
  onSetSelectedAdventureId,
  onSetSelectedSceneId,
  onSetSelectedNpcId,
  onSetSelectedLocationId,
  onSetSelectedFactionId,
  onSetSelectedItemId,
  onSetSelectedArticleId,
  onSetSelectedSessionLogId,
  onSetSelectedPlayerCharacterId,
  onSetSelectedPlotId,
  onSetSelectedNoteId,
  onGoLive,
  onQuickStart,
  onImportPC,
  onAddToast,
}) => {
  // Stable identity so RelationshipGraph's D3 mount effect (which depends on this
  // callback) doesn't tear down and rebuild the whole graph on every unrelated
  // ViewRouter re-render (e.g. autosave ticks, RealmChat-driven entity updates).
  const handleGraphNodeSelect = useCallback(
    (type: string, id: string) => onNavigate(type, id),
    [onNavigate]
  );

  // Session Runner takes priority when active
  if (activeView === 'session-runner' && campaign.activeSessionId) {
    const activeSessionLog = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
    if (activeSessionLog) {
      return (
        <SessionRunner
          campaign={campaign}
          sessionLog={activeSessionLog}
          isMockMode={isMockMode}
          onEndSession={onEndSession}
          onOpenCoach={onOpenCoach}
          onNavigate={onNavigate}
        />
      );
    }
  }

  // Tonight's Table — the story-first campaign home. Sits below the live
  // Session Runner (which always wins, above) and above every editor branch
  // (nothing is selected when a GM navigates here via the sidebar).
  if (activeView === 'tonight') {
    return <TonightsTable campaign={campaign} onNavigate={onNavigate} onGoLive={onGoLive} onQuickStart={onQuickStart} isMockMode={isMockMode} />;
  }

  // Render Generators
  if (activeGenerator === 'scene' && selectedAdventure) {
    return (
      <ContentWrapper title="Create New Scene" icon="Scenes">
        <SceneGenerator
          onSceneCreated={(s) => campaignService.createScene(selectedAdventure.id, s)}
          isMockMode={isMockMode}
          isOfficialSetting={isOfficialSetting}
          campaignContext={campaignContext}
        />
      </ContentWrapper>
    );
  }

  // Editors — take priority when an entity is selected
  if (selectedPlayerCharacter) {
    return (
      <PlayerCharacterEditor
        pc={selectedPlayerCharacter}
        onUpdate={campaignService.updatePlayerCharacter}
        onDelete={(id) => { campaignService.deletePlayerCharacter(id); onResetSelections(); }}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedSessionLog) {
    return (
      <SessionLogEditor
        log={selectedSessionLog}
        campaign={campaign}
        onUpdate={campaignService.updateSessionLog}
        onDelete={(id) => { campaignService.deleteSessionLog(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onGoLive={onGoLive}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedPlot) {
    return (
      <PlotEditor
        plot={selectedPlot}
        campaign={campaign}
        onUpdate={campaignService.updatePlot}
        onDelete={(id) => { campaignService.deletePlot(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedNote) {
    return (
      <NoteEditor
        note={selectedNote}
        onUpdate={campaignService.updateNote}
        onDelete={(id) => { campaignService.deleteNote(id); onResetSelections(); }}
        isMockMode={isMockMode}
        campaignContext={campaignContext}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedScene && selectedAdventure) {
    return (
      <SceneEditor
        scene={selectedScene}
        allNpcs={campaign.npcs}
        allLocations={campaign.locations}
        campaign={campaign}
        onUpdate={(id, data) => campaignService.updateScene(selectedAdventure.id, id, data)}
        onDelete={(id) => { campaignService.deleteScene(selectedAdventure.id, id); onSetSelectedSceneId(null); }}
        isMockMode={isMockMode}
        isActiveScene={campaign.activeSceneId === selectedScene.id}
        onSetActive={campaignService.setActiveScene}
        onNavigate={onNavigate}
        campaignContext={campaignContext}
      />
    );
  }

  if (selectedAdventure) {
    return (
      <AdventureEditor
        adventure={selectedAdventure}
        campaign={campaign}
        onUpdate={campaignService.updateAdventure}
        onDelete={(id) => { campaignService.deleteAdventure(id); onResetSelections(); }}
        onNavigate={onNavigate}
        isMockMode={isMockMode}
        campaignContext={campaignContext}
      />
    );
  }

  if (selectedArticle) {
    return (
      <ArticleEditor
        article={selectedArticle}
        allArticles={campaign.articles}
        campaign={campaign}
        onUpdate={campaignService.updateArticle}
        onDelete={(id) => { campaignService.deleteArticle(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedNpc) {
    return (
      <NpcEditor
        npc={selectedNpc}
        factions={campaign.factions}
        allNpcs={campaign.npcs}
        playerCharacters={campaign.playerCharacters}
        campaign={campaign}
        onUpdate={campaignService.updateNpc}
        onDelete={(id) => { campaignService.deleteNpc(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedLocation) {
    return (
      <LocationEditor
        location={selectedLocation}
        allLocations={campaign.locations}
        allFactions={campaign.factions}
        campaign={campaign}
        onUpdate={campaignService.updateLocation}
        onDelete={(id) => { campaignService.deleteLocation(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedFaction) {
    return (
      <FactionEditor
        faction={selectedFaction}
        allNpcs={campaign.npcs}
        allLocations={campaign.locations}
        campaign={campaign}
        onUpdate={campaignService.updateFaction}
        onDelete={(id) => { campaignService.deleteFaction(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  if (selectedItem) {
    return (
      <ItemEditor
        item={selectedItem}
        onUpdate={campaignService.updateItem}
        onDelete={(id) => { campaignService.deleteItem(id); onResetSelections(); }}
        isMockMode={isMockMode}
        onNavigate={onNavigate}
      />
    );
  }

  // Dashboards — shown when no entity is selected
  if (activeView === 'adventures') {
    return (
      <AdventureDashboard
        adventures={campaign.adventures}
        onAdventureCreated={(advData) => {
          const newId = campaignService.createFullAdventure(advData);
          onSetSelectedAdventureId(newId);
          onSetActiveGenerator(null);
        }}
        onSelectAdventure={(id) => {
          onResetSelections();
          onSetActiveView('adventures');
          onSetSelectedAdventureId(id);
        }}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'player-characters') {
    return (
      <PlayerCharacterDashboard
        playerCharacters={campaign.playerCharacters || []}
        onImport={async (file) => {
          try {
            const newId = await onImportPC(file);
            onResetSelections();
            onSetActiveView('player-characters');
            onSetSelectedPlayerCharacterId(newId);
          } catch (error) {
            console.error('PC Import failed:', error);
            onAddToast(
              `Failed to import character sheet: ${error instanceof Error ? error.message : 'Unknown error'}`,
              'error'
            );
          }
        }}
        onPlayerCharacterCreated={(pc) => {
          campaignService.createPlayerCharacter(pc);
          onResetSelections();
          onSetActiveView('player-characters');
          onSetSelectedPlayerCharacterId(pc.id);
        }}
        onSelectPlayerCharacter={(id) => {
          onResetSelections();
          onSetActiveView('player-characters');
          onSetSelectedPlayerCharacterId(id);
        }}
        isMockMode={isMockMode}
      />
    );
  }

  if (activeView === 'session-logs') {
    return (
      <SessionLogDashboard
        campaign={campaign}
        sessionLogs={campaign.sessionLogs || []}
        onSessionLogCreated={(logData) => {
          const newId = campaignService.createSessionLog(logData);
          onSetActiveView('session-logs');
          onSetSelectedSessionLogId(newId);
        }}
        onSelectSessionLog={(id) => {
          onSetSelectedSessionLogId(id);
          if (campaign.activeSessionId === id) {
            onSetActiveView('session-runner');
          }
        }}
        onGoLive={onGoLive}
        onQuickStart={onQuickStart}
        isMockMode={isMockMode}
      />
    );
  }

  if (activeView === 'plots') {
    return (
      <PlotDashboard
        plots={campaign.plots || []}
        sessionLogs={campaign.sessionLogs || []}
        onPlotCreated={(noteData) => {
          const newId = campaignService.createPlot(noteData);
          onSetActiveView('plots');
          onSetSelectedPlotId(newId);
        }}
        onSelectPlot={onSetSelectedPlotId}
        onSelectSession={(id) => {
          onSetSelectedSessionLogId(id);
          onSetActiveView('session-logs');
        }}
      />
    );
  }

  if (activeView === 'notes') {
    return (
      <NoteDashboard
        notes={campaign.notes || []}
        onNoteCreated={(noteData) => {
          const newId = campaignService.createNote(noteData);
          onSetActiveView('notes');
          onSetSelectedNoteId(newId);
        }}
        onSelectNote={onSetSelectedNoteId}
      />
    );
  }

  if (activeView === 'npcs') {
    return (
      <NpcDashboard
        npcs={campaign.npcs}
        factions={campaign.factions}
        onNpcCreated={(npcData) => {
          const newId = campaignService.createNpc(npcData);
          onSetActiveView('npcs');
          onSetSelectedNpcId(newId);
        }}
        onSelectNpc={onSetSelectedNpcId}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'locations') {
    return (
      <LocationDashboard
        locations={campaign.locations}
        factions={campaign.factions}
        onLocationCreated={(locData) => {
          const newId = campaignService.createLocation(locData);
          onSetActiveView('locations');
          onSetSelectedLocationId(newId);
        }}
        onSelectLocation={onSetSelectedLocationId}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'factions') {
    return (
      <FactionDashboard
        factions={campaign.factions}
        npcs={campaign.npcs}
        locations={campaign.locations}
        onFactionCreated={(facData) => {
          const newId = campaignService.createFaction(facData);
          onSetActiveView('factions');
          onSetSelectedFactionId(newId);
        }}
        onSelectFaction={onSetSelectedFactionId}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'items') {
    return (
      <ItemDashboard
        items={campaign.items}
        onItemCreated={(itemData) => {
          const newId = campaignService.createItem(itemData);
          onSetActiveView('items');
          onSetSelectedItemId(newId);
        }}
        onSelectItem={onSetSelectedItemId}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'lorebook') {
    return (
      <ArticleDashboard
        articles={campaign.articles}
        npcs={campaign.npcs}
        locations={campaign.locations}
        factions={campaign.factions}
        onArticleCreated={(artData) => {
          const newId = campaignService.createArticle(artData);
          onSetActiveView('lorebook');
          onSetSelectedArticleId(newId);
        }}
        onSelectArticle={onSetSelectedArticleId}
        isMockMode={isMockMode}
        isOfficialSetting={isOfficialSetting}
        campaignContext={campaignContext}
      />
    );
  }

  if (activeView === 'combat') {
    return (
      <CombatTracker
        encounter={campaign.activeEncounter || { id: 'default', round: 1, turnIndex: 0, combatants: [] }}
        onUpdate={campaignService.updateEncounter}
        campaignNpcs={campaign.npcs}
        campaignPcs={campaign.playerCharacters || []}
      />
    );
  }

  if (activeView === 'relationships') {
    return (
      <Suspense fallback={<VisualizerFallback />}>
        <RelationshipGraph
          campaign={campaign}
          onNodeSelect={handleGraphNodeSelect}
        />
      </Suspense>
    );
  }

  if (activeView === 'secrets') {
    return (
      <ContentWrapper title="Secrets & Clues" icon="Lock">
        <SecretsTracker campaign={campaign} isMockMode={isMockMode} />
      </ContentWrapper>
    );
  }

  // Default: Campaign Setting Editor
  return (
    <ContentWrapper title="Campaign Setting" icon="Setting">
      <CampaignSettingEditor
        campaign={campaign}
        onUpdate={campaignService.updateCampaign}
        isMockMode={isMockMode}
        campaignContext={campaignContext}
        onSetStyleProfile={campaignService.setStyleProfile}
        onClearStyleProfile={campaignService.clearStyleProfile}
      />
    </ContentWrapper>
  );
};
