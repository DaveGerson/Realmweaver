
import React, { FC, useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Adventure, Scene } from './types/index';
import { WelcomeScreen } from './components/views/WelcomeScreen';
import { CampaignCreator } from './components/views/CampaignCreator';
import { CampaignSelector } from './components/views/CampaignSelector';
import { Header } from './components/layout/Header';
import { CampaignSidebar } from './components/layout/CampaignSidebar';
import { AdventureEditor } from './components/editors/AdventureEditor';
import { AdventureDashboard } from './components/dashboards/AdventureDashboard';
import { SceneGenerator } from './components/generators/SceneGenerator';
import { NpcEditor } from './components/editors/NpcEditor';
import { LocationEditor } from './components/editors/LocationEditor';
import { FactionEditor } from './components/editors/FactionEditor';
import { ItemEditor } from './components/editors/ItemEditor';
import { SceneEditor } from './components/editors/SceneEditor';
import { ArticleEditor } from './components/editors/ArticleEditor';
import { SessionLogEditor } from './components/editors/SessionLogEditor';
import { PlayerCharacterEditor } from './components/editors/PlayerCharacterEditor';
import { PlotEditor } from './components/editors/PlotEditor';
import { CampaignSettingEditor } from './components/editors/CampaignSettingEditor';
import { CombatTracker } from './components/tools/CombatTracker';
import { SecretsTracker } from './components/tools/SecretsTracker';
import { RelationshipGraph } from './components/visualizers/RelationshipGraph';
import { ContentWrapper } from './components/layout/ContentWrapper';
import { DmCoach } from './components/dialogs/DmCoach';
import { EvocationWizard } from './components/dialogs/EvocationWizard';
import { runSmokeTests } from './smokeTest';
import { ExportModal } from './components/dialogs/ExportModal';
import { ContinuityChecker } from './components/dialogs/ContinuityChecker';
import { checkContinuity } from './services/continuityChecker';
import { exportCampaignAsJson, exportCampaignAsObsidian } from './services/importExportService';
import { NpcDashboard } from './components/dashboards/NpcDashboard';
import { LocationDashboard } from './components/dashboards/LocationDashboard';
import { FactionDashboard } from './components/dashboards/FactionDashboard';
import { ItemDashboard } from './components/dashboards/ItemDashboard';
import { ArticleDashboard } from './components/dashboards/ArticleDashboard';
import { SessionLogDashboard } from './components/dashboards/SessionLogDashboard';
import { PlayerCharacterDashboard } from './components/dashboards/PlayerCharacterDashboard';
import { PlotDashboard } from './components/dashboards/PlotDashboard';
import { campaignService } from './services/campaignService';
import { RealmChatWidget } from './components/RealmChat/RealmChatWidget';
import { SessionRunner } from './components/views/SessionRunner';
import { buildCampaignContext } from './services/contextBuilder';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import type { BreadcrumbSegment } from './components/common/Breadcrumbs';
import { CommandPalette } from './components/common/CommandPalette';
import type { RecentItem, CommandPaletteEntityType } from './components/common/CommandPalette';


export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' | 'combat' | 'relationships' | 'session-runner' | 'secrets';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'scene' | 'article';

export interface NavStackEntry {
  view: EditorView;
  selectedId: string | null;
  adventureId?: string | null;
  sceneId?: string | null;
  label: string;
}

const App: FC = () => {
  const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState
  );

  const [isMockMode, setIsMockMode] = useState(true);
  
  // UI-specific state that remains in the component
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
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isContinuityCheckerOpen, setIsContinuityCheckerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [navStack, setNavStack] = useState<NavStackEntry[]>([]);


  useEffect(() => {
    runSmokeTests(isMockMode).catch(err => console.error('Smoke tests failed:', err));
  }, [isMockMode]);

  // Cmd+K / Ctrl+K to open command palette (suppressed inside input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return;
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track recently viewed entities (max 10, session-only)
  const trackRecentItem = (type: CommandPaletteEntityType, id: string, name: string) => {
    setRecentItems(prev => {
      const filtered = prev.filter(r => !(r.type === type && r.id === id));
      return [{ type, id, name }, ...filtered].slice(0, 10);
    });
  };

  const activeCampaign = useMemo(() => campaigns.find(c => c.id === activeCampaignId), [campaigns, activeCampaignId]);
  const isOfficialSetting = activeCampaign?.settingType === 'official';

  // Continuity issue count — recomputed whenever the campaign changes. Only counts
  // errors and warnings (info items don't warrant a badge).
  const continuityIssueCount = useMemo(() => {
    if (!activeCampaign) return 0;
    const issues = checkContinuity(activeCampaign);
    return issues.filter(i => i.severity === 'error' || i.severity === 'warning').length;
  }, [activeCampaign]);
  const campaignContext = useMemo(() => {
    if (!activeCampaign) return undefined;
    return buildCampaignContext({
      variant: 'generation',
      campaign: activeCampaign,
      activeSceneId: activeCampaign.activeSceneId,
      activeSessionId: activeCampaign.activeSessionId,
    });
  }, [activeCampaign]);

  const resetSelections = () => {
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
    setActiveGenerator(null);
  };

  const handleImportCampaign = async (file: File) => {
      try {
          const title = await campaignService.importCampaign(file);
          alert(`Campaign "${title}" imported successfully!`);
      } catch (error) {
          console.error("Import failed:", error);
          alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
  };

  const handleImportPC = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target?.result) {
                try {
                    const base64 = (event.target.result as string).split(',')[1];
                    const newId = await campaignService.createPlayerCharacterFromPdf(base64, isMockMode);
                    resolve(newId);
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(new Error("Could not read file."));
            }
        };
        reader.onerror = () => reject(new Error("Error reading file."));
        reader.readAsDataURL(file);
    });
};

    // Generic handler for RealmChat additions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddEntityFromChat = (type: string, data: any) => {
        switch (type) {
            case 'npc': 
                const npcId = campaignService.createNpc(data);
                handleSelect('npc', npcId);
                break;
            case 'location': 
                const locId = campaignService.createLocation(data);
                handleSelect('location', locId);
                break;
            case 'faction': 
                const facId = campaignService.createFaction(data);
                handleSelect('faction', facId);
                break;
            case 'item': 
                const itemId = campaignService.createItem(data);
                handleSelect('item', itemId);
                break;
            case 'article': 
                const artId = campaignService.createArticle(data);
                handleSelect('article', artId);
                break;
            case 'adventure':
                const advId = campaignService.createFullAdventure(data);
                handleSelect('adventure', advId);
                break;
            default:
                console.warn("Unknown entity type from chat:", type);
        }
    };

    // Generic handler for RealmChat updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateEntityFromChat = (type: string, id: string, data: any) => {
        switch (type) {
            case 'npc': 
                campaignService.updateNpc(id, data);
                break;
            case 'location': 
                campaignService.updateLocation(id, data);
                break;
            case 'faction': 
                campaignService.updateFaction(id, data);
                break;
            case 'item': 
                campaignService.updateItem(id, data);
                break;
            case 'article': 
                campaignService.updateArticle(id, data);
                break;
            case 'adventure':
                campaignService.updateAdventure(id, data);
                break;
            default:
                console.warn("Unknown entity type update from chat:", type);
        }
    };

  // --- Memos for selected items ---
  const selectedAdventure = useMemo(() => activeCampaign?.adventures.find(a => a.id === selectedAdventureId) || null, [activeCampaign, selectedAdventureId]);
  const selectedScene = useMemo(() => selectedAdventure?.scenes.find(s => s.id === selectedSceneId) || null, [selectedAdventure, selectedSceneId]);
  const selectedNpc = useMemo(() => activeCampaign?.npcs.find(n => n.id === selectedNpcId) || null, [activeCampaign, selectedNpcId]);
  const selectedLocation = useMemo(() => activeCampaign?.locations.find(l => l.id === selectedLocationId) || null, [activeCampaign, selectedLocationId]);
  const selectedFaction = useMemo(() => activeCampaign?.factions.find(f => f.id === selectedFactionId) || null, [activeCampaign, selectedFactionId]);
  const selectedItem = useMemo(() => activeCampaign?.items.find(i => i.id === selectedItemId) || null, [activeCampaign, selectedItemId]);
  const selectedArticle = useMemo(() => activeCampaign?.articles.find(a => a.id === selectedArticleId) || null, [activeCampaign, selectedArticleId]);
  const selectedSessionLog = useMemo(() => activeCampaign?.sessionLogs?.find(s => s.id === selectedSessionLogId) || null, [activeCampaign, selectedSessionLogId]);
  const selectedPlayerCharacter = useMemo(() => activeCampaign?.playerCharacters?.find(p => p.id === selectedPlayerCharacterId) || null, [activeCampaign, selectedPlayerCharacterId]);
  const selectedPlot = useMemo(() => activeCampaign?.plots?.find(n => n.id === selectedPlotId) || null, [activeCampaign, selectedPlotId]);
  
  // --- Context Construction for Session Weaver ---
  const currentContext = useMemo(() => {
      if (!activeCampaign) return '';
      let context = `Campaign: ${activeCampaign.title}\n`;
      
      // 1. Setting Context
      if (activeCampaign.settingType === 'official' && activeCampaign.officialSetting) {
          context += `Official Setting: ${activeCampaign.officialSetting}.\n`;
          if (activeCampaign.setting) {
            context += `Supplemental Lore: ${activeCampaign.setting}\n\n`;
          }
      } else {
          context += `Setting: ${activeCampaign.setting}\n\n`;
      }

      // 2. ACTIVE SESSION CONTEXT (Priority High)
      const activeSession = activeCampaign.sessionLogs?.find(s => s.status === 'active');
      if (activeSession) {
          context += `--- ACTIVE SESSION IN PROGRESS: "${activeSession.title}" ---\n`;
          if (activeSession.prepNotes) context += `DM Prep Notes: ${activeSession.prepNotes}\n`;
          if (activeSession.runningNotes) context += `Current Session Notes: ${activeSession.runningNotes}\n`;
          
          // Inject Active Adventure Context
          if (activeSession.adventureId) {
              const adv = activeCampaign.adventures.find(a => a.id === activeSession.adventureId);
              if (adv) {
                  context += `Current Adventure: "${adv.title}" (Theme: ${adv.theme})\n`;
                  if (adv.hook) context += `Adventure Hook: ${adv.hook}\n`;
              }
          }
          
          // Find previously completed session for continuity
          const pastSessions = activeCampaign.sessionLogs
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
          
          if (pastSessions.length > 0) {
              context += `PREVIOUS SESSION RECAP (${pastSessions[0].title}): ${pastSessions[0].recap}\n`;
              if (pastSessions[0].looseEnds) context += `UNRESOLVED THREADS: ${pastSessions[0].looseEnds}\n`;
          }
          
          context += `\n`;
      }

      // 3. Helper to append related lore to context
      const appendRelatedLore = (entityId: string) => {
          const relatedArticles = activeCampaign.articles.filter(a => a.relatedEntityIds?.includes(entityId));
          if (relatedArticles.length > 0) {
              context += `\nRELEVANT LORE:\n`;
              relatedArticles.forEach(article => {
                  context += `- ${article.title} (${article.category}): ${article.content.substring(0, 300)}${article.content.length > 300 ? '...' : ''}\n`;
              });
              context += `\n`;
          }
      };

      // 4. ACTIVE SCENE STATE (Manual Scene Selection Override)
      if (activeCampaign.activeSceneId) {
         let activeScene: Scene | undefined;
         let activeAdventure: Adventure | undefined;
         // Find scene and adventure
         for (const adv of activeCampaign.adventures) {
             const s = adv.scenes.find(s => s.id === activeCampaign.activeSceneId);
             if (s) {
                 activeScene = s;
                 activeAdventure = adv;
                 break;
             }
         }
         
         if (activeScene && activeAdventure) {
             context += `--- CURRENT SCENE ---\n`;
             context += `Scene: "${activeScene.title}" (Adventure: "${activeAdventure.title}")\n`;
             context += `Type: ${activeScene.type}\n`;
             if (activeScene.readAloudText) context += `Description: "${activeScene.readAloudText}"\n`;
             if (activeScene.gmNotes) context += `GM Notes: ${activeScene.gmNotes}\n`;
             
             // Active Location Context
             if (activeScene.locationId) {
                 const loc = activeCampaign.locations.find(l => l.id === activeScene.locationId);
                 if (loc) {
                     context += `Current Location: ${loc.name}. ${loc.description}\n`;
                     appendRelatedLore(loc.id);
                 }
             }
             
             // Active NPCs Context
             if (activeScene.npcIds.length > 0) {
                 const npcs = activeCampaign.npcs.filter(n => activeScene!.npcIds.includes(n.id));
                 context += `NPCs Present: ${npcs.map(n => `${n.name} (${n.traits})`).join('; ')}\n`;
                 npcs.forEach(n => appendRelatedLore(n.id));
             }
             context += `\n`;
         }
      }

      // 5. CURRENT USER FOCUS (Editor Selection)
      // If the user is viewing something *different* than the active scene, give context on that too.
      let selectionContext = '';
      if (selectedScene && selectedAdventure && selectedScene.id !== activeCampaign.activeSceneId) {
          selectionContext += `USER IS VIEWING SCENE: "${selectedScene.title}" (Adventure: ${selectedAdventure.title})\n`;
          if (selectedScene.gmNotes) selectionContext += `Notes: ${selectedScene.gmNotes}\n`;
      } else if (selectedLocation) {
          selectionContext += `USER IS VIEWING LOCATION: "${selectedLocation.name}"\n`;
          if (selectedLocation.description) selectionContext += `Desc: ${selectedLocation.description}\n`;
      } else if (selectedNpc) {
          selectionContext += `USER IS VIEWING NPC: "${selectedNpc.name}"\n`;
          if (selectedNpc.traits) selectionContext += `Traits: ${selectedNpc.traits}\n`;
      }

      if (selectionContext) {
          context += `--- CURRENT USER FOCUS ---\n${selectionContext}`;
      }

      return context;
  }, [activeCampaign, activeCampaign?.activeSceneId, activeCampaign?.sessionLogs, selectedScene, selectedAdventure, selectedLocation, selectedNpc, selectedFaction]);


  // ── Navigation Back Stack ────────────────────────────────────────────────

  /**
   * Captures the CURRENT view/selection state and pushes it onto the nav stack
   * before navigating away. Call this before any state mutation in handleSelect.
   * Max depth of 20 entries to prevent unbounded growth.
   */
  const pushNavStack = (label: string) => {
    setNavStack(prev => {
      // Derive the currently selected ID from the active view
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
      return [...prev, entry].slice(-20);
    });
  };

  /**
   * Pops the last entry from the nav stack and restores its view + selection.
   * If the stack is empty, does nothing.
   */
  const handleGoBack = () => {
    setNavStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const next = prev.slice(0, -1);

      // Restore selection state
      setActiveView(entry.view);
      setSelectedNpcId(entry.view === 'npcs' ? entry.selectedId : null);
      setSelectedLocationId(entry.view === 'locations' ? entry.selectedId : null);
      setSelectedFactionId(entry.view === 'factions' ? entry.selectedId : null);
      setSelectedItemId(entry.view === 'items' ? entry.selectedId : null);
      setSelectedArticleId(entry.view === 'lorebook' ? entry.selectedId : null);
      setSelectedSessionLogId(entry.view === 'session-logs' ? entry.selectedId : null);
      setSelectedPlayerCharacterId(entry.view === 'player-characters' ? entry.selectedId : null);
      setSelectedPlotId(entry.view === 'plots' ? entry.selectedId : null);
      setSelectedAdventureId(entry.adventureId ?? null);
      setSelectedSceneId(entry.sceneId ?? null);
      setActiveGenerator(null);

      return next;
    });
    setIsSidebarOpen(false);
  };

  /**
   * Bridge between EntityLink's QuickCardEntityType system and the existing
   * handleSelect function. Editors will receive this as their onNavigate prop.
   */
  const handleEntityNavigate = (entityType: string, entityId: string) => {
    const typeMap: Record<string, string> = {
      npc: 'npc',
      location: 'location',
      faction: 'faction',
      item: 'item',
      adventure: 'adventure',
      article: 'article',
      plot: 'plot',
      'session-log': 'session-log',
      'player-character': 'player-character',
      scene: 'scene',
    };
    const selectType = typeMap[entityType] ?? entityType;
    handleSelect(selectType as Parameters<typeof handleSelect>[0], entityId);
  };

  const handleSelectView = (view: EditorView) => {
    // Sidebar navigation starts a fresh context — reset the back stack
    setNavStack([]);
    setActiveView(view);
    resetSelections();
    setIsSidebarOpen(false);
  };

    const handleSelect = (type: 'adventure' | 'scene' | 'npc' | 'location' | 'faction' | 'item' | 'article' | 'session-log' | 'player-character' | 'plot', id: string) => {
        if (type === 'scene') {
            const parentAdventure = activeCampaign?.adventures.find(adv => adv.scenes.some(s => s.id === id));
            if (parentAdventure) {
                // Push current state before navigating to scene
                const scene = parentAdventure.scenes.find(s => s.id === id);
                if (scene) pushNavStack(scene.title);
                setActiveView('adventures');
                setSelectedAdventureId(parentAdventure.id);
                setSelectedSceneId(id);
                if (scene) trackRecentItem('adventure', parentAdventure.id, parentAdventure.title);
            }
        } else {
            switch(type) {
                case 'adventure': {
                    const adv = activeCampaign?.adventures.find(a => a.id === id);
                    if (adv) pushNavStack(adv.title);
                    resetSelections();
                    setActiveView('adventures'); setSelectedAdventureId(id);
                    if (adv) trackRecentItem('adventure', id, adv.title);
                    break;
                }
                case 'npc': {
                    const npc = activeCampaign?.npcs.find(n => n.id === id);
                    if (npc) pushNavStack(npc.name);
                    resetSelections();
                    setActiveView('npcs'); setSelectedNpcId(id);
                    if (npc) trackRecentItem('npc', id, npc.name);
                    break;
                }
                case 'location': {
                    const loc = activeCampaign?.locations.find(l => l.id === id);
                    if (loc) pushNavStack(loc.name);
                    resetSelections();
                    setActiveView('locations'); setSelectedLocationId(id);
                    if (loc) trackRecentItem('location', id, loc.name);
                    break;
                }
                case 'faction': {
                    const fac = activeCampaign?.factions.find(f => f.id === id);
                    if (fac) pushNavStack(fac.name);
                    resetSelections();
                    setActiveView('factions'); setSelectedFactionId(id);
                    if (fac) trackRecentItem('faction', id, fac.name);
                    break;
                }
                case 'item': {
                    const itm = activeCampaign?.items.find(i => i.id === id);
                    if (itm) pushNavStack(itm.name);
                    resetSelections();
                    setActiveView('items'); setSelectedItemId(id);
                    if (itm) trackRecentItem('item', id, itm.name);
                    break;
                }
                case 'article': {
                    const art = activeCampaign?.articles.find(a => a.id === id);
                    if (art) pushNavStack(art.title);
                    resetSelections();
                    setActiveView('lorebook'); setSelectedArticleId(id);
                    if (art) trackRecentItem('article', id, art.title);
                    break;
                }
                case 'session-log': {
                    const log = activeCampaign?.sessionLogs?.find(s => s.id === id);
                    if (log) pushNavStack(log.title);
                    resetSelections();
                    setActiveView('session-logs'); setSelectedSessionLogId(id);
                    if (log) trackRecentItem('session-log', id, log.title);
                    break;
                }
                case 'player-character': {
                    const pc = activeCampaign?.playerCharacters?.find(p => p.id === id);
                    if (pc) pushNavStack(pc.characterSocial?.characterName || 'Character');
                    resetSelections();
                    setActiveView('player-characters'); setSelectedPlayerCharacterId(id);
                    if (pc) trackRecentItem('player-character', id, pc.characterSocial?.characterName || 'Character');
                    break;
                }
                case 'plot': {
                    const plt = activeCampaign?.plots?.find(p => p.id === id);
                    if (plt) pushNavStack(plt.title);
                    resetSelections();
                    setActiveView('plots'); setSelectedPlotId(id);
                    if (plt) trackRecentItem('plot', id, plt.title);
                    break;
                }
            }
        }
        setIsSidebarOpen(false);
    };

  const handleGoLive = (sessionLogId: string) => {
      campaignService.goLive(sessionLogId);
      setActiveView('session-runner');
      resetSelections();
  };

  const handleEndSession = () => {
      campaignService.endSession();
      setActiveView('session-logs');
      resetSelections();
  };

  const breadcrumbSegments = useMemo((): BreadcrumbSegment[] => {
      if (!activeCampaign) return [];
      const campaignCrumb: BreadcrumbSegment = { label: activeCampaign.title, onClick: () => { resetSelections(); setActiveView('setting'); } };

      const viewLabels: Record<string, string> = {
          'setting': 'Setting', 'npcs': 'NPCs', 'locations': 'Locations', 'factions': 'Factions',
          'items': 'Items', 'adventures': 'Adventures', 'lorebook': 'Lorebook',
          'session-logs': 'Sessions', 'player-characters': 'Characters', 'plots': 'Plots',
          'combat': 'Combat Tracker', 'relationships': 'World Graph', 'session-runner': 'Session Live',
          'secrets': 'Secrets & Clues'
      };

      const categoryCrumb: BreadcrumbSegment = {
          label: viewLabels[activeView] || activeView,
          onClick: () => { resetSelections(); setActiveView(activeView); }
      };

      // Entity-level crumbs
      if (selectedNpc) return [campaignCrumb, categoryCrumb, { label: selectedNpc.name }];
      if (selectedLocation) return [campaignCrumb, categoryCrumb, { label: selectedLocation.name }];
      if (selectedFaction) return [campaignCrumb, categoryCrumb, { label: selectedFaction.name }];
      if (selectedItem) return [campaignCrumb, categoryCrumb, { label: selectedItem.name }];
      if (selectedArticle) return [campaignCrumb, categoryCrumb, { label: selectedArticle.title }];
      if (selectedPlayerCharacter) return [campaignCrumb, categoryCrumb, { label: selectedPlayerCharacter.characterSocial.characterName }];
      if (selectedSessionLog) return [campaignCrumb, categoryCrumb, { label: selectedSessionLog.title }];
      if (selectedPlot) return [campaignCrumb, categoryCrumb, { label: selectedPlot.title }];
      if (selectedScene && selectedAdventure) return [
          campaignCrumb,
          { label: 'Adventures', onClick: () => { resetSelections(); setActiveView('adventures'); } },
          { label: selectedAdventure.title, onClick: () => { resetSelections(); setSelectedAdventureId(selectedAdventure.id); setActiveView('adventures'); } },
          { label: selectedScene.title }
      ];
      if (selectedAdventure) return [campaignCrumb, categoryCrumb, { label: selectedAdventure.title }];

      // Dashboard-level crumbs (just campaign > category)
      return [campaignCrumb, categoryCrumb];
  }, [activeCampaign, activeView, selectedNpc, selectedLocation, selectedFaction, selectedItem, selectedArticle, selectedPlayerCharacter, selectedSessionLog, selectedPlot, selectedScene, selectedAdventure]);

  const renderMainContent = () => {
      if (!activeCampaign) return null;

      // Session Runner takes priority when active
      if (activeView === 'session-runner' && activeCampaign.activeSessionId) {
          const activeSessionLog = activeCampaign.sessionLogs?.find(s => s.id === activeCampaign.activeSessionId);
          if (activeSessionLog) {
              return (
                  <SessionRunner
                      campaign={activeCampaign}
                      sessionLog={activeSessionLog}
                      isMockMode={isMockMode}
                      onEndSession={handleEndSession}
                      onOpenCoach={() => setIsCoachOpen(true)}
                      onNavigate={handleEntityNavigate}
                  />
              );
          }
      }

      // Render Generators
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene" icon="Scenes"><SceneGenerator onSceneCreated={(s) => campaignService.createScene(selectedAdventure.id, s)} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} /></ContentWrapper>;

      // Render Editors & Dashboards - Editors take priority if an item is selected
      if (selectedPlayerCharacter) return <PlayerCharacterEditor pc={selectedPlayerCharacter} onUpdate={campaignService.updatePlayerCharacter} onDelete={(id) => { campaignService.deletePlayerCharacter(id); resetSelections(); }} />;
      
      if (selectedSessionLog) return (
        <SessionLogEditor
            log={selectedSessionLog}
            onUpdate={campaignService.updateSessionLog}
            onDelete={(id) => { campaignService.deleteSessionLog(id); resetSelections(); }}
            isMockMode={isMockMode}
            onGoLive={handleGoLive}
            onNavigate={handleEntityNavigate}
        />
      );

      if (selectedPlot) return <PlotEditor plot={selectedPlot} onUpdate={campaignService.updatePlot} onDelete={(id) => { campaignService.deletePlot(id); resetSelections(); }} isMockMode={isMockMode} onNavigate={handleEntityNavigate} />;
      if (selectedScene && selectedAdventure) return <SceneEditor scene={selectedScene} allNpcs={activeCampaign.npcs} allLocations={activeCampaign.locations} campaign={activeCampaign} onUpdate={(id, data) => campaignService.updateScene(selectedAdventure.id, id, data)} onDelete={(id) => { campaignService.deleteScene(selectedAdventure.id, id); setSelectedSceneId(null); }} isMockMode={isMockMode} isActiveScene={activeCampaign.activeSceneId === selectedScene.id} onSetActive={campaignService.setActiveScene} onNavigate={handleEntityNavigate} />;
      if (selectedAdventure) return <AdventureEditor adventure={selectedAdventure} campaign={activeCampaign} onUpdate={campaignService.updateAdventure} onNavigate={handleEntityNavigate} />;

      if (selectedArticle) return (
        <ArticleEditor
            article={selectedArticle}
            allArticles={activeCampaign.articles}
            onUpdate={campaignService.updateArticle}
            onDelete={(id) => { campaignService.deleteArticle(id); resetSelections(); }}
            isMockMode={isMockMode}
            onNavigate={handleEntityNavigate}
        />
      );

      if (selectedNpc) return (
        <NpcEditor
            npc={selectedNpc}
            factions={activeCampaign.factions}
            allNpcs={activeCampaign.npcs}
            playerCharacters={activeCampaign.playerCharacters}
            onUpdate={campaignService.updateNpc}
            onDelete={(id) => { campaignService.deleteNpc(id); resetSelections(); }}
            isMockMode={isMockMode}
            onNavigate={handleEntityNavigate}
        />
      );

      if (selectedLocation) return (
        <LocationEditor
            location={selectedLocation}
            allLocations={activeCampaign.locations}
            allFactions={activeCampaign.factions}
            onUpdate={campaignService.updateLocation}
            onDelete={(id) => { campaignService.deleteLocation(id); resetSelections(); }}
            isMockMode={isMockMode}
            onNavigate={handleEntityNavigate}
        />
      );

      if (selectedFaction) return (
        <FactionEditor
            faction={selectedFaction}
            allNpcs={activeCampaign.npcs}
            allLocations={activeCampaign.locations}
            onUpdate={campaignService.updateFaction}
            onDelete={(id) => { campaignService.deleteFaction(id); resetSelections(); }}
            isMockMode={isMockMode}
            onNavigate={handleEntityNavigate}
        />
      );
      if (selectedItem) return <ItemEditor item={selectedItem} onUpdate={campaignService.updateItem} onDelete={(id) => { campaignService.deleteItem(id); resetSelections(); }} isMockMode={isMockMode} onNavigate={handleEntityNavigate} />;

      // If no specific item is selected, show the corresponding dashboard
      if (activeView === 'adventures') {
        return <AdventureDashboard 
                    adventures={activeCampaign.adventures} 
                    onAdventureCreated={(advData) => {
                        const newId = campaignService.createFullAdventure(advData);
                        setSelectedAdventureId(newId);
                        setActiveGenerator(null);
                    }}
                    onSelectAdventure={(id) => {
                        resetSelections();
                        setActiveView('adventures');
                        setSelectedAdventureId(id);
                    }}
                    isMockMode={isMockMode}
                    isOfficialSetting={isOfficialSetting}
                    campaignContext={campaignContext}
                />;
      }
      if (activeView === 'player-characters') return <PlayerCharacterDashboard 
          playerCharacters={activeCampaign.playerCharacters || []}
          onImport={async (file) => {
            try {
                const newId = await handleImportPC(file);
                resetSelections();
                setActiveView('player-characters');
                setSelectedPlayerCharacterId(newId);
            } catch (error) {
                console.error("PC Import failed:", error);
                alert(`Failed to import character sheet: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          }}
          onSelectPlayerCharacter={(id) => {
            resetSelections();
            setActiveView('player-characters');
            setSelectedPlayerCharacterId(id);
          }}
          isMockMode={isMockMode}
        />;
      if (activeView === 'session-logs') return <SessionLogDashboard
          campaign={activeCampaign}
          sessionLogs={activeCampaign.sessionLogs || []}
          onSessionLogCreated={(logData) => {
              const newId = campaignService.createSessionLog(logData);
              setActiveView('session-logs');
              setSelectedSessionLogId(newId);
          }}
          onSelectSessionLog={(id) => {
              setSelectedSessionLogId(id);
              if (activeCampaign.activeSessionId === id) {
                  setActiveView('session-runner');
              }
          }}
          onGoLive={handleGoLive}
          isMockMode={isMockMode}
      />;
      if (activeView === 'plots') return <PlotDashboard plots={activeCampaign.plots || []} sessionLogs={activeCampaign.sessionLogs || []} onPlotCreated={(noteData) => {
            const newId = campaignService.createPlot(noteData);
            setActiveView('plots');
            setSelectedPlotId(newId);
      }} onSelectPlot={setSelectedPlotId} onSelectSession={(id) => { setSelectedSessionLogId(id); setActiveView('session-logs'); }} />;
      if (activeView === 'npcs') return <NpcDashboard npcs={activeCampaign.npcs} factions={activeCampaign.factions} onNpcCreated={(npcData) => {
            const newId = campaignService.createNpc(npcData);
            setActiveView('npcs');
            setSelectedNpcId(newId);
        }} onSelectNpc={setSelectedNpcId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'locations') return <LocationDashboard locations={activeCampaign.locations} factions={activeCampaign.factions} onLocationCreated={(locData) => {
            const newId = campaignService.createLocation(locData);
            setActiveView('locations');
            setSelectedLocationId(newId);
        }} onSelectLocation={setSelectedLocationId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'factions') return <FactionDashboard factions={activeCampaign.factions} npcs={activeCampaign.npcs} locations={activeCampaign.locations} onFactionCreated={(facData) => {
            const newId = campaignService.createFaction(facData);
            setActiveView('factions');
            setSelectedFactionId(newId);
        }} onSelectFaction={setSelectedFactionId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'items') return <ItemDashboard items={activeCampaign.items} onItemCreated={(itemData) => {
            const newId = campaignService.createItem(itemData);
            setActiveView('items');
            setSelectedItemId(newId);
        }} onSelectItem={setSelectedItemId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'lorebook') return <ArticleDashboard articles={activeCampaign.articles} npcs={activeCampaign.npcs} locations={activeCampaign.locations} factions={activeCampaign.factions} onArticleCreated={(artData) => {
            const newId = campaignService.createArticle(artData);
            setActiveView('lorebook');
            setSelectedArticleId(newId);
        }} onSelectArticle={setSelectedArticleId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;

      // Combat Tracker View
      if (activeView === 'combat') {
        return <CombatTracker 
            encounter={activeCampaign.activeEncounter || { id: 'default', round: 1, turnIndex: 0, combatants: [] }} 
            onUpdate={campaignService.updateEncounter} 
            campaignNpcs={activeCampaign.npcs}
            campaignPcs={activeCampaign.playerCharacters || []}
        />;
      }

      // Relationship Graph View
      if (activeView === 'relationships') {
          return <RelationshipGraph
            campaign={activeCampaign}
            onNodeSelect={(type, id) => handleSelect(type as any, id)}
          />;
      }

      // Secrets & Clues View
      if (activeView === 'secrets') {
          return (
              <ContentWrapper title="Secrets & Clues" icon="Lock">
                  <SecretsTracker campaign={activeCampaign} />
              </ContentWrapper>
          );
      }

      // Fallback to Campaign Setting Editor
      if (activeView === 'setting') {
          return (
              <ContentWrapper title="Campaign Setting" icon="Setting">
                  <CampaignSettingEditor campaign={activeCampaign} onUpdate={campaignService.updateCampaign} />
              </ContentWrapper>
          );
      }

      return null;
  };

  const appContent = () => {
    switch (appStatus) {
      case 'welcome':
        return <WelcomeScreen onStart={() => campaignService.prepareNewCampaign()} />;
      case 'creating':
        return <CampaignCreator onCreateCampaign={campaignService.createCampaign} />;
      case 'selecting':
        return <CampaignSelector campaigns={campaigns} onSelect={campaignService.selectCampaign} onDelete={campaignService.deleteCampaign} onCreateNew={() => campaignService.prepareNewCampaign()} />;
      case 'editing':
      case 'loading':
        if (activeCampaign) {
          return (
            <>
              <Header
                activeCampaign={activeCampaign}
                isMockMode={isMockMode}
                onToggleMockMode={() => setIsMockMode(p => !p)}
                onToggleCoach={() => setIsCoachOpen(p => !p)}
                onToggleWizard={() => setIsWizardOpen(p => !p)}
                onToggleContinuityChecker={() => setIsContinuityCheckerOpen(p => !p)}
                continuityIssueCount={continuityIssueCount}
                onSaveCampaign={campaignService.saveCampaign}
                onSwitchCampaign={campaignService.switchToCampaignSelector}
                onCreateNew={campaignService.startNewCampaignCreation}
                onImportCampaign={handleImportCampaign}
                onShowExportModal={() => setIsExportModalOpen(true)}
                onToggleSidebar={() => setIsSidebarOpen(p => !p)}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />
              <div className="flex-1 flex overflow-hidden relative">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                  />
                )}

                {/* Sidebar Container */}
                <div className={`
                  fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out
                  md:relative md:translate-x-0
                  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                  <CampaignSidebar
                    campaign={activeCampaign}
                    activeView={activeView}
                    onSelectView={handleSelectView}
                    selectedIds={{
                        adventure: selectedAdventureId,
                        scene: selectedSceneId,
                        npc: selectedNpcId,
                        location: selectedLocationId,
                        faction: selectedFactionId,
                        item: selectedItemId,
                        article: selectedArticleId,
                        sessionLog: selectedSessionLogId,
                        playerCharacter: selectedPlayerCharacterId,
                        plot: selectedPlotId
                    }}
                    onSelect={handleSelect}
                    recentItems={recentItems}
                    onSelectRecent={(type, id) => handleSelect(type as Parameters<typeof handleSelect>[0], id)}
                    pinnedEntities={activeCampaign?.pinnedEntities}
                    onSelectPinned={(type, id) => handleSelect(type as Parameters<typeof handleSelect>[0], id)}
                    onUnpin={(type, id) => campaignService.unpinEntity(type, id)}
                    onShowGenerator={(type) => {
                      if (type === 'scene') {
                        if (!selectedAdventureId) {
                          alert("Please select an adventure first to add a scene to it.");
                          return;
                        }
                      }
                      setActiveGenerator(type);
                    }}
                    onReorderScene={campaignService.reorderScene}
                  />
                </div>

                <main className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 relative w-full">
                  {activeView !== 'session-runner' && (
                    <Breadcrumbs
                      segments={breadcrumbSegments}
                      canGoBack={navStack.length > 0}
                      onGoBack={handleGoBack}
                    />
                  )}
                  {renderMainContent()}
                </main>
                
                {/* Floating Widgets */}
                <RealmChatWidget
                  campaign={activeCampaign}
                  onAddToCampaign={handleAddEntityFromChat}
                  onUpdateCampaign={handleUpdateEntityFromChat}
                  isMockMode={isMockMode}
                  onNavigate={handleEntityNavigate}
                />

                {isCoachOpen && <DmCoach campaign={activeCampaign} activeContext={currentContext} onClose={() => setIsCoachOpen(false)} onSendToNotes={(content) => campaignService.addAutoEvent('coach-used', content)} isMockMode={isMockMode} onNavigate={handleEntityNavigate} />}
                {isWizardOpen && <EvocationWizard 
                    campaign={activeCampaign} 
                    onClose={() => setIsWizardOpen(false)} 
                    onAddToCampaign={(data) => {
                        const count = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0) as number;
                        campaignService.batchAddToCampaign(data);
                        setIsWizardOpen(false);
                        if (count > 0) {
                            alert(`${count} entit${count === 1 ? 'y' : 'ies'} added to your campaign!`);
                        }
                    }} 
                    isMockMode={isMockMode}
                />}
                {isExportModalOpen && <ExportModal
                  campaignTitle={activeCampaign.title}
                  onClose={() => setIsExportModalOpen(false)}
                  onExportJson={() => { exportCampaignAsJson(activeCampaign); setIsExportModalOpen(false); }}
                  onExportObsidian={() => { exportCampaignAsObsidian(activeCampaign); setIsExportModalOpen(false); }}
                />}
                {isContinuityCheckerOpen && (
                  <ContinuityChecker
                    campaign={activeCampaign}
                    onNavigate={handleEntityNavigate}
                    onClose={() => setIsContinuityCheckerOpen(false)}
                  />
                )}
                <CommandPalette
                  isOpen={isCommandPaletteOpen}
                  onClose={() => setIsCommandPaletteOpen(false)}
                  npcs={activeCampaign.npcs}
                  locations={activeCampaign.locations}
                  factions={activeCampaign.factions}
                  items={activeCampaign.items}
                  adventures={activeCampaign.adventures}
                  articles={activeCampaign.articles}
                  sessionLogs={activeCampaign.sessionLogs || []}
                  plots={activeCampaign.plots || []}
                  playerCharacters={activeCampaign.playerCharacters || []}
                  recentItems={recentItems}
                  onSelectNpc={(id) => handleSelect('npc', id)}
                  onSelectLocation={(id) => handleSelect('location', id)}
                  onSelectFaction={(id) => handleSelect('faction', id)}
                  onSelectItem={(id) => handleSelect('item', id)}
                  onSelectAdventure={(id) => handleSelect('adventure', id)}
                  onSelectArticle={(id) => handleSelect('article', id)}
                  onSelectSessionLog={(id) => handleSelect('session-log', id)}
                  onSelectPlot={(id) => handleSelect('plot', id)}
                  onSelectPlayerCharacter={(id) => handleSelect('player-character', id)}
                  onNavigateTo={(view) => { handleSelectView(view as any); }}
                  onOpenCoach={() => setIsCoachOpen(true)}
                />
              </div>
            </>
          );
        }
        return null;
      default:
        return <div>Unhandled App Status</div>;
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {appContent()}
    </div>
  );
};


export default App;
