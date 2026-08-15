
import { useState, useMemo, useCallback } from 'react';
import type { Campaign } from '@/types/Campaign';
import type { BreadcrumbSegment } from '@/components/common/Breadcrumbs';
import type { RecentItem, CommandPaletteEntityType } from '@/components/common/CommandPalette';
import type { EditorView, GeneratorType, NavStackEntry } from '@/App';
export interface EntitySelectionState {
  // Selected entity IDs
  selectedAdventureId: string | null;
  selectedSceneId: string | null;
  selectedNpcId: string | null;
  selectedLocationId: string | null;
  selectedFactionId: string | null;
  selectedItemId: string | null;
  selectedArticleId: string | null;
  selectedSessionLogId: string | null;
  selectedPlayerCharacterId: string | null;
  selectedPlotId: string | null;
  selectedNoteId: string | null;

  // Navigation
  navStack: NavStackEntry[];
  activeView: EditorView;
  activeGenerator: GeneratorType | null;
  recentItems: RecentItem[];

  // Resolved entities
  selectedAdventure: Campaign['adventures'][number] | null;
  selectedScene: Campaign['adventures'][number]['scenes'][number] | null;
  selectedNpc: Campaign['npcs'][number] | null;
  selectedLocation: Campaign['locations'][number] | null;
  selectedFaction: Campaign['factions'][number] | null;
  selectedItem: Campaign['items'][number] | null;
  selectedArticle: Campaign['articles'][number] | null;
  selectedSessionLog: NonNullable<Campaign['sessionLogs']>[number] | null;
  selectedPlayerCharacter: NonNullable<Campaign['playerCharacters']>[number] | null;
  selectedPlot: NonNullable<Campaign['plots']>[number] | null;
  selectedNote: NonNullable<Campaign['notes']>[number] | null;

  // Breadcrumbs
  breadcrumbSegments: BreadcrumbSegment[];

  // Handlers
  handleSelect: (
    type: 'adventure' | 'scene' | 'npc' | 'location' | 'faction' | 'item' | 'article' | 'session-log' | 'player-character' | 'plot' | 'note',
    id: string
  ) => void;
  handleSelectView: (view: EditorView) => void;
  handleGoBack: () => void;
  handleEntityNavigate: (entityType: string, entityId: string) => void;
  pushNavStack: (label: string) => void;
  resetSelections: () => void;
  trackRecentItem: (type: CommandPaletteEntityType, id: string, name: string) => void;
  setActiveGenerator: (type: GeneratorType | null) => void;
  setSelectedAdventureId: (id: string | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  setSelectedNpcId: (id: string | null) => void;
  setSelectedLocationId: (id: string | null) => void;
  setSelectedFactionId: (id: string | null) => void;
  setSelectedItemId: (id: string | null) => void;
  setSelectedArticleId: (id: string | null) => void;
  setSelectedSessionLogId: (id: string | null) => void;
  setSelectedPlayerCharacterId: (id: string | null) => void;
  setSelectedPlotId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setActiveView: (view: EditorView) => void;
}

interface UseEntitySelectionOptions {
  activeCampaign: Campaign | undefined;
  onSidebarClose: () => void;
}

export function useEntitySelection({ activeCampaign, onSidebarClose }: UseEntitySelectionOptions): EntitySelectionState {
  const [activeView, setActiveView] = useState<EditorView>('setting');
  const [activeGenerator, setActiveGenerator] = useState<GeneratorType | null>(null);

  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedSessionLogId, setSelectedSessionLogId] = useState<string | null>(null);
  const [selectedPlayerCharacterId, setSelectedPlayerCharacterId] = useState<string | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [navStack, setNavStack] = useState<NavStackEntry[]>([]);

  // --- Resolved entity memos ---
  const selectedAdventure = useMemo(
    () => activeCampaign?.adventures.find(a => a.id === selectedAdventureId) || null,
    [activeCampaign, selectedAdventureId]
  );
  const selectedScene = useMemo(
    () => selectedAdventure?.scenes.find(s => s.id === selectedSceneId) || null,
    [selectedAdventure, selectedSceneId]
  );
  const selectedNpc = useMemo(
    () => activeCampaign?.npcs.find(n => n.id === selectedNpcId) || null,
    [activeCampaign, selectedNpcId]
  );
  const selectedLocation = useMemo(
    () => activeCampaign?.locations.find(l => l.id === selectedLocationId) || null,
    [activeCampaign, selectedLocationId]
  );
  const selectedFaction = useMemo(
    () => activeCampaign?.factions.find(f => f.id === selectedFactionId) || null,
    [activeCampaign, selectedFactionId]
  );
  const selectedItem = useMemo(
    () => activeCampaign?.items.find(i => i.id === selectedItemId) || null,
    [activeCampaign, selectedItemId]
  );
  const selectedArticle = useMemo(
    () => activeCampaign?.articles.find(a => a.id === selectedArticleId) || null,
    [activeCampaign, selectedArticleId]
  );
  const selectedSessionLog = useMemo(
    () => activeCampaign?.sessionLogs?.find(s => s.id === selectedSessionLogId) || null,
    [activeCampaign, selectedSessionLogId]
  );
  const selectedPlayerCharacter = useMemo(
    () => activeCampaign?.playerCharacters?.find(p => p.id === selectedPlayerCharacterId) || null,
    [activeCampaign, selectedPlayerCharacterId]
  );
  const selectedPlot = useMemo(
    () => activeCampaign?.plots?.find(n => n.id === selectedPlotId) || null,
    [activeCampaign, selectedPlotId]
  );
  const selectedNote = useMemo(
    () => activeCampaign?.notes?.find(n => n.id === selectedNoteId) || null,
    [activeCampaign, selectedNoteId]
  );

  // --- Helpers ---

  const trackRecentItem = useCallback((type: CommandPaletteEntityType, id: string, name: string) => {
    setRecentItems(prev => {
      const filtered = prev.filter(r => !(r.type === type && r.id === id));
      return [{ type, id, name }, ...filtered].slice(0, 10);
    });
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedNpcId(null);
    setSelectedLocationId(null);
    setSelectedFactionId(null);
    setSelectedItemId(null);
    setSelectedAdventureId(null);
    setSelectedSceneId(null);
    setSelectedArticleId(null);
    setSelectedSessionLogId(null);
    setSelectedPlayerCharacterId(null);
    setSelectedPlotId(null);
    setSelectedNoteId(null);
    setActiveGenerator(null);
  }, []);

  /**
   * Captures the CURRENT view/selection state and pushes it onto the nav stack
   * before navigating away. Max depth of 20 entries.
   */
  const pushNavStack = useCallback((label: string) => {
    setNavStack(prev => {
      let selectedId: string | null = null;
      switch (activeView) {
        case 'npcs': selectedId = selectedNpcId; break;
        case 'locations': selectedId = selectedLocationId; break;
        case 'factions': selectedId = selectedFactionId; break;
        case 'items': selectedId = selectedItemId; break;
        case 'lorebook': selectedId = selectedArticleId; break;
        case 'session-logs': selectedId = selectedSessionLogId; break;
        case 'player-characters': selectedId = selectedPlayerCharacterId; break;
        case 'plots': selectedId = selectedPlotId; break;
        case 'notes': selectedId = selectedNoteId; break;
        case 'adventures': selectedId = selectedAdventureId; break;
        default: selectedId = null;
      }
      const entry: NavStackEntry = {
        view: activeView,
        selectedId,
        adventureId: selectedAdventureId,
        sceneId: selectedSceneId,
        label,
      };
      // Finding #54: two synchronous handleSelect calls in the same click
      // handler (e.g. the sidebar's scene button firing
      // onSelect('adventure', …) then onSelect('scene', …)) both read
      // activeView/selectedXId from this same stale render closure, so both
      // pushes would otherwise capture identical pre-click state and grow the
      // stack by 2 for a single logical navigation. Dedupe against the
      // current top of stack instead of pushing a duplicate.
      const top = prev[prev.length - 1];
      if (
        top &&
        top.view === entry.view &&
        top.selectedId === entry.selectedId &&
        top.adventureId === entry.adventureId &&
        top.sceneId === entry.sceneId
      ) {
        return prev;
      }
      return [...prev, entry].slice(-20);
    });
  }, [
    activeView, selectedNpcId, selectedLocationId, selectedFactionId, selectedItemId,
    selectedArticleId, selectedSessionLogId, selectedPlayerCharacterId, selectedPlotId,
    selectedNoteId, selectedAdventureId, selectedSceneId,
  ]);

  const handleGoBack = useCallback(() => {
    if (navStack.length === 0) return;
    const entry = navStack[navStack.length - 1];

    setActiveView(entry.view);
    setSelectedNpcId(entry.view === 'npcs' ? entry.selectedId : null);
    setSelectedLocationId(entry.view === 'locations' ? entry.selectedId : null);
    setSelectedFactionId(entry.view === 'factions' ? entry.selectedId : null);
    setSelectedItemId(entry.view === 'items' ? entry.selectedId : null);
    setSelectedArticleId(entry.view === 'lorebook' ? entry.selectedId : null);
    setSelectedSessionLogId(entry.view === 'session-logs' ? entry.selectedId : null);
    setSelectedPlayerCharacterId(entry.view === 'player-characters' ? entry.selectedId : null);
    setSelectedPlotId(entry.view === 'plots' ? entry.selectedId : null);
    setSelectedNoteId(entry.view === 'notes' ? entry.selectedId : null);
    setSelectedAdventureId(entry.adventureId ?? null);
    setSelectedSceneId(entry.sceneId ?? null);
    setActiveGenerator(null);

    setNavStack(prev => prev.slice(0, -1));
    onSidebarClose();
  }, [navStack, onSidebarClose]);

  const handleSelectView = useCallback((view: EditorView) => {
    setNavStack([]);
    setActiveView(view);
    resetSelections();
    onSidebarClose();
  }, [resetSelections, onSidebarClose]);

  const handleSelect = useCallback((
    type: 'adventure' | 'scene' | 'npc' | 'location' | 'faction' | 'item' | 'article' | 'session-log' | 'player-character' | 'plot' | 'note',
    id: string
  ) => {
    if (type === 'scene') {
      const parentAdventure = activeCampaign?.adventures.find(adv => adv.scenes.some(s => s.id === id));
      if (parentAdventure) {
        const scene = parentAdventure.scenes.find(s => s.id === id);
        // pushNavStack must run BEFORE resetSelections so it still captures
        // the pre-navigation state (it reads the current selection ids from
        // this render's closure). Finding #21: this branch previously never
        // called resetSelections() at all — every other branch does — so a
        // stale selectedNoteId/selectedPlotId/etc. from a prior navigation
        // survived, and ViewRouter's editor-precedence chain (which checks
        // those before selectedScene) kept rendering the old editor instead
        // of navigating to the scene.
        if (scene) pushNavStack(scene.title);
        resetSelections();
        setActiveView('adventures');
        setSelectedAdventureId(parentAdventure.id);
        setSelectedSceneId(id);
        if (scene) trackRecentItem('adventure', parentAdventure.id, parentAdventure.title);
      }
    } else {
      switch (type) {
        case 'adventure': {
          const adv = activeCampaign?.adventures.find(a => a.id === id);
          if (adv) pushNavStack(adv.title);
          resetSelections();
          setActiveView('adventures');
          setSelectedAdventureId(id);
          if (adv) trackRecentItem('adventure', id, adv.title);
          break;
        }
        case 'npc': {
          const npc = activeCampaign?.npcs.find(n => n.id === id);
          if (npc) pushNavStack(npc.name);
          resetSelections();
          setActiveView('npcs');
          setSelectedNpcId(id);
          if (npc) trackRecentItem('npc', id, npc.name);
          break;
        }
        case 'location': {
          const loc = activeCampaign?.locations.find(l => l.id === id);
          if (loc) pushNavStack(loc.name);
          resetSelections();
          setActiveView('locations');
          setSelectedLocationId(id);
          if (loc) trackRecentItem('location', id, loc.name);
          break;
        }
        case 'faction': {
          const fac = activeCampaign?.factions.find(f => f.id === id);
          if (fac) pushNavStack(fac.name);
          resetSelections();
          setActiveView('factions');
          setSelectedFactionId(id);
          if (fac) trackRecentItem('faction', id, fac.name);
          break;
        }
        case 'item': {
          const itm = activeCampaign?.items.find(i => i.id === id);
          if (itm) pushNavStack(itm.name);
          resetSelections();
          setActiveView('items');
          setSelectedItemId(id);
          if (itm) trackRecentItem('item', id, itm.name);
          break;
        }
        case 'article': {
          const art = activeCampaign?.articles.find(a => a.id === id);
          if (art) pushNavStack(art.title);
          resetSelections();
          setActiveView('lorebook');
          setSelectedArticleId(id);
          if (art) trackRecentItem('article', id, art.title);
          break;
        }
        case 'session-log': {
          const log = activeCampaign?.sessionLogs?.find(s => s.id === id);
          if (log) pushNavStack(log.title);
          resetSelections();
          setActiveView('session-logs');
          setSelectedSessionLogId(id);
          if (log) trackRecentItem('session-log', id, log.title);
          break;
        }
        case 'player-character': {
          const pc = activeCampaign?.playerCharacters?.find(p => p.id === id);
          if (pc) pushNavStack(pc.characterSocial?.characterName || 'Character');
          resetSelections();
          setActiveView('player-characters');
          setSelectedPlayerCharacterId(id);
          if (pc) trackRecentItem('player-character', id, pc.characterSocial?.characterName || 'Character');
          break;
        }
        case 'plot': {
          const plt = activeCampaign?.plots?.find(p => p.id === id);
          if (plt) pushNavStack(plt.title);
          resetSelections();
          setActiveView('plots');
          setSelectedPlotId(id);
          if (plt) trackRecentItem('plot', id, plt.title);
          break;
        }
        case 'note': {
          const nte = activeCampaign?.notes?.find(n => n.id === id);
          if (nte) pushNavStack(nte.title);
          resetSelections();
          setActiveView('notes');
          setSelectedNoteId(id);
          if (nte) trackRecentItem('note', id, nte.title);
          break;
        }
      }
    }
    onSidebarClose();
  }, [activeCampaign, pushNavStack, resetSelections, trackRecentItem, onSidebarClose]);

  /**
   * Bridge between EntityLink's QuickCardEntityType system and handleSelect.
   * Editors receive this as their onNavigate prop.
   */
  const handleEntityNavigate = useCallback((entityType: string, entityId: string) => {
    const typeMap: Record<string, string> = {
      npc: 'npc',
      location: 'location',
      faction: 'faction',
      item: 'item',
      adventure: 'adventure',
      article: 'article',
      plot: 'plot',
      note: 'note',
      'session-log': 'session-log',
      'player-character': 'player-character',
      scene: 'scene',
    };
    const selectType = typeMap[entityType] ?? entityType;
    handleSelect(selectType as Parameters<typeof handleSelect>[0], entityId);
  }, [handleSelect]);

  // --- Breadcrumbs ---
  const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
    if (!activeCampaign) return [];
    const campaignCrumb: BreadcrumbSegment = {
      label: activeCampaign.title,
      onClick: () => { resetSelections(); setActiveView('setting'); },
    };

    const viewLabels: Record<string, string> = {
      setting: 'Setting', npcs: 'NPCs', locations: 'Locations', factions: 'Factions',
      items: 'Items', adventures: 'Adventures', lorebook: 'Lorebook',
      'session-logs': 'Sessions', 'player-characters': 'Characters', plots: 'Plots',
      combat: 'Combat Tracker', relationships: 'World Graph', 'session-runner': 'Session Live',
      secrets: 'Secrets & Clues', notes: 'Notes',
    };

    const categoryCrumb: BreadcrumbSegment = {
      label: viewLabels[activeView] || activeView,
      onClick: () => { resetSelections(); setActiveView(activeView); },
    };

    if (selectedNpc) return [campaignCrumb, categoryCrumb, { label: selectedNpc.name }];
    if (selectedLocation) return [campaignCrumb, categoryCrumb, { label: selectedLocation.name }];
    if (selectedFaction) return [campaignCrumb, categoryCrumb, { label: selectedFaction.name }];
    if (selectedItem) return [campaignCrumb, categoryCrumb, { label: selectedItem.name }];
    if (selectedArticle) return [campaignCrumb, categoryCrumb, { label: selectedArticle.title }];
    if (selectedPlayerCharacter) return [campaignCrumb, categoryCrumb, { label: selectedPlayerCharacter.characterSocial.characterName }];
    if (selectedSessionLog) return [campaignCrumb, categoryCrumb, { label: selectedSessionLog.title }];
    if (selectedPlot) return [campaignCrumb, categoryCrumb, { label: selectedPlot.title }];
    if (selectedNote) return [campaignCrumb, categoryCrumb, { label: selectedNote.title }];
    if (selectedScene && selectedAdventure) {
      return [
        campaignCrumb,
        { label: 'Adventures', onClick: () => { resetSelections(); setActiveView('adventures'); } },
        {
          label: selectedAdventure.title,
          onClick: () => {
            resetSelections();
            setSelectedAdventureId(selectedAdventure.id);
            setActiveView('adventures');
          },
        },
        { label: selectedScene.title },
      ];
    }
    if (selectedAdventure) return [campaignCrumb, categoryCrumb, { label: selectedAdventure.title }];

    return [campaignCrumb, categoryCrumb];
  }, [
    activeCampaign, activeView,
    selectedNpc, selectedLocation, selectedFaction, selectedItem, selectedArticle,
    selectedPlayerCharacter, selectedSessionLog, selectedPlot, selectedNote, selectedScene, selectedAdventure,
  ]);

  return {
    selectedAdventureId, selectedSceneId, selectedNpcId, selectedLocationId,
    selectedFactionId, selectedItemId, selectedArticleId, selectedSessionLogId,
    selectedPlayerCharacterId, selectedPlotId, selectedNoteId,
    navStack, activeView, activeGenerator, recentItems,
    selectedAdventure, selectedScene, selectedNpc, selectedLocation,
    selectedFaction, selectedItem, selectedArticle, selectedSessionLog,
    selectedPlayerCharacter, selectedPlot, selectedNote,
    breadcrumbSegments,
    handleSelect, handleSelectView, handleGoBack, handleEntityNavigate,
    pushNavStack, resetSelections, trackRecentItem, setActiveGenerator,
    setSelectedAdventureId, setSelectedSceneId, setSelectedNpcId, setSelectedLocationId,
    setSelectedFactionId, setSelectedItemId, setSelectedArticleId, setSelectedSessionLogId,
    setSelectedPlayerCharacterId, setSelectedPlotId, setSelectedNoteId, setActiveView,
  };
}
