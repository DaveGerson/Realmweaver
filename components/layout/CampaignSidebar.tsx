
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Campaign, Article } from '../../types/index';
import { Icons, SceneIcon } from '../common/Icons';
import type { EditorView, GeneratorType } from '../../App';
import type { RecentItem, CommandPaletteEntityType } from '../common/CommandPalette';
import { twMerge } from 'tailwind-merge';
import { isFeatureVisible } from '../../utils/dmStyleUtils';
import { DmStylePanel } from '../common/DmStylePanel';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';
import { SidebarSearch } from './sidebar/SidebarSearch';
import { ArticleTreeItem } from './sidebar/ArticleTreeItem';
import { PinnedEntities } from './sidebar/PinnedEntities';
import { RecentItems } from './sidebar/RecentItems';

type SelectedIds = {
    adventure: string | null;
    scene: string | null;
    npc: string | null;
    location: string | null;
    faction: string | null;
    item: string | null;
    article: string | null;
    sessionLog: string | null;
    playerCharacter: string | null;
    plot: string | null;
}

interface CampaignSidebarProps {
    campaign: Campaign;
    activeView: EditorView;
    onSelectView: (view: EditorView) => void;
    selectedIds: SelectedIds;
    onSelect: (type: 'adventure' | 'scene' | 'npc' | 'location' | 'faction' | 'item' | 'article' | 'session-log' | 'player-character' | 'plot', id: string) => void;
    onShowGenerator: (type: GeneratorType) => void;
    onReorderScene: (adventureId: string, draggedSceneId: string, targetSceneId: string) => void;
    recentItems?: RecentItem[];
    onSelectRecent?: (type: CommandPaletteEntityType, id: string) => void;
    pinnedEntities?: Array<{ type: string; id: string }>;
    onSelectPinned?: (type: string, id: string) => void;
    onUnpin?: (type: string, id: string) => void;
    onSetDmStyle?: (style: import('../../types/index').DmStyle) => void;
    onSetFeatureOverride?: (feature: string, visible: boolean) => void;
    onClearFeatureOverride?: (feature: string) => void;
}

export const CampaignSidebar: React.FC<CampaignSidebarProps> = ({
    campaign,
    activeView,
    onSelectView,
    selectedIds,
    onSelect,
    onShowGenerator,
    onReorderScene,
    recentItems = [],
    onSelectRecent,
    pinnedEntities,
    onSelectPinned,
    onUnpin,
    onSetDmStyle,
    onSetFeatureOverride,
    onClearFeatureOverride,
}) => {
    const [expandedAdventures, setExpandedAdventures] = useState<Record<string, boolean>>({});
    const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
    const [expandedViews, setExpandedViews] = useState<Partial<Record<EditorView, boolean>>>({
        npcs: true,
    });
    const [filterText, setFilterText] = useState('');
    const [debouncedFilter, setDebouncedFilter] = useState('');
    const [showDmStylePanel, setShowDmStylePanel] = useState(false);
    const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Compute feature visibility from campaign's dmStyle + overrides
    const dmStyle = campaign.dmStyle ?? 'standard';
    const featureOverrides = campaign.featureOverrides ?? {};
    const showRelationshipGraph = isFeatureVisible('relationship-graph', dmStyle, featureOverrides);
    const showSecretsTracker = isFeatureVisible('secrets-tracker', dmStyle, featureOverrides);
    const showCombatTracker = isFeatureVisible('combat-tracker', dmStyle, featureOverrides);

    const handleFilterChange = useCallback((value: string) => {
        setFilterText(value);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setDebouncedFilter(value.toLowerCase().trim());
        }, 100);
    }, []);

    const handleFilterClear = useCallback(() => {
        setFilterText('');
        setDebouncedFilter('');
    }, []);

    useEffect(() => {
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    const matchesFilter = useCallback((name: string) => {
        if (!debouncedFilter) return true;
        return name.toLowerCase().includes(debouncedFilter);
    }, [debouncedFilter]);

    const toggleAdventure = (adventureId: string) => {
        setExpandedAdventures(prev => ({ ...prev, [adventureId]: !prev[adventureId] }));
    };

    const toggleArticle = (articleId: string) => {
        setExpandedArticles(prev => ({ ...prev, [articleId]: !prev[articleId] }));
    };

    const toggleView = (view: EditorView) => {
        setExpandedViews(prev => ({ ...prev, [view]: !prev[view] }));
    };

    const isViewExpanded = (view: EditorView) => {
        if (view === 'npcs' && selectedIds.npc) return true;
        if (view === 'locations' && selectedIds.location) return true;
        if (view === 'factions' && selectedIds.faction) return true;
        if (view === 'items' && selectedIds.item) return true;
        return !!expandedViews[view];
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, adventureId: string, sceneId: string) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ adventureId, sceneId }));
        e.dataTransfer.effectAllowed = 'move';
        (e.target as HTMLElement).classList.add('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = (e.target as HTMLElement).closest('button');
        if (target) {
            target.classList.add('border-t-2', 'border-amber-500', '-mt-0.5');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const target = (e.target as HTMLElement).closest('button');
        if (target) {
            target.classList.remove('border-t-2', 'border-amber-500', '-mt-0.5');
        }
    };

    const handleDrop = (e: React.DragEvent, targetAdventureId: string, targetSceneId: string) => {
        e.preventDefault();
        handleDragLeave(e);
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            const { adventureId: draggedAdventureId, sceneId: draggedSceneId } = JSON.parse(data);
            if (draggedAdventureId === targetAdventureId && draggedSceneId !== targetSceneId) {
                onReorderScene(draggedAdventureId, draggedSceneId, targetSceneId);
            }
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
        document.querySelectorAll('.border-amber-500').forEach(el => el.classList.remove('border-t-2', 'border-amber-500', '-mt-0.5'));
    };

    const entityGroups: {
        label: string,
        icon: keyof typeof Icons,
        view: 'npcs' | 'locations' | 'factions' | 'items',
        generatorType: 'npc' | 'location' | 'faction' | 'item',
        items: { id: string, name: string }[],
        selectedId: string | null
    }[] = [
        { label: "NPCs", icon: 'NPCs', view: 'npcs', generatorType: 'npc', items: campaign.npcs, selectedId: selectedIds.npc },
        { label: "Locations", icon: 'Locations', view: 'locations', generatorType: 'location', items: campaign.locations, selectedId: selectedIds.location },
        { label: "Factions", icon: 'Factions', view: 'factions', generatorType: 'faction', items: campaign.factions, selectedId: selectedIds.faction },
        { label: "Items", icon: 'Items', view: 'items', generatorType: 'item', items: campaign.items, selectedId: selectedIds.item },
    ];

    const topLevelArticles = campaign.articles.filter(a => !a.parentArticleId);

    // --- Filtered lists for search ---
    const filteredSessionLogs = (campaign.sessionLogs || [])
        .filter(s => matchesFilter(s.title))
        .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
    const filteredPlayerCharacters = (campaign.playerCharacters || []).filter(pc => matchesFilter(pc.characterSocial.characterName));
    const filteredPlots = (campaign.plots || []).filter(p => matchesFilter(p.title));
    const filteredAdventures = campaign.adventures.filter(a => {
        if (matchesFilter(a.title)) return true;
        return a.scenes.some(s => matchesFilter(s.title));
    });
    const filteredTopLevelArticles = debouncedFilter
        ? campaign.articles.filter(a => matchesFilter(a.title))
        : topLevelArticles;
    const filteredEntityGroups = entityGroups.map(group => ({
        ...group,
        items: group.items.filter(item => matchesFilter(item.name)),
    }));

    // Determine if entire buckets should be hidden
    const hasCampaignStateItems = !debouncedFilter || filteredSessionLogs.length > 0 || filteredPlayerCharacters.length > 0 || filteredPlots.length > 0;
    const hasStorylineItems = !debouncedFilter || filteredAdventures.length > 0;
    const hasWorldPlanningItems = !debouncedFilter || filteredTopLevelArticles.length > 0 || filteredEntityGroups.some(g => g.items.length > 0);

    return (
        <aside className="w-full h-full bg-slate-900 flex-shrink-0 flex flex-col border-r border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold font-serif truncate flex-1 min-w-0" title={campaign.title}>{campaign.title}</h2>
                {(onSetDmStyle || onSetFeatureOverride) && (
                    <button
                        onClick={() => setShowDmStylePanel(true)}
                        className="flex-shrink-0 p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
                        title={`DM Style: ${dmStyle}`}
                        aria-label="DM Style settings"
                    >
                        <Icons.Sliders className="w-4 h-4" />
                    </button>
                )}
            </div>
            {showDmStylePanel && onSetDmStyle && onSetFeatureOverride && onClearFeatureOverride && (
                <DmStylePanel
                    dmStyle={dmStyle}
                    featureOverrides={featureOverrides}
                    onSetDmStyle={onSetDmStyle}
                    onSetFeatureOverride={onSetFeatureOverride}
                    onClearFeatureOverride={onClearFeatureOverride}
                    onClose={() => setShowDmStylePanel(false)}
                />
            )}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">

                {/* --- Active Session Runner Banner --- */}
                {campaign.activeSessionId && (() => {
                    const activeSession = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                    return activeSession ? (
                        <div className="mb-4">
                            <button
                                onClick={() => onSelectView('session-runner' as EditorView)}
                                className={twMerge(
                                    'w-full flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors border',
                                    activeView === 'session-runner'
                                        ? 'bg-amber-900/30 text-amber-200 border-amber-700/50'
                                        : 'bg-amber-900/20 text-amber-300 border-amber-800/40 hover:bg-amber-900/30'
                                )}
                            >
                                <Icons.Play className="w-4 h-4 text-red-400 animate-pulse" />
                                <div className="text-left min-w-0">
                                    <div className="font-semibold truncate">{activeSession.title}</div>
                                    <div className="text-xs text-amber-400/70">Session Live</div>
                                </div>
                            </button>
                        </div>
                    ) : null;
                })()}

                {/* --- Search/Filter --- */}
                <SidebarSearch
                    filterText={filterText}
                    onFilterChange={handleFilterChange}
                    onClear={handleFilterClear}
                />

                {/* --- Pinned Entities --- */}
                {pinnedEntities && !debouncedFilter && onSelectPinned && onUnpin && (
                    <PinnedEntities
                        campaign={campaign}
                        pinnedEntities={pinnedEntities}
                        onSelectPinned={onSelectPinned}
                        onUnpin={onUnpin}
                    />
                )}

                {/* --- Recent Items --- */}
                {!debouncedFilter && onSelectRecent && (
                    <RecentItems
                        recentItems={recentItems}
                        onSelectRecent={onSelectRecent}
                    />
                )}

                {/* --- Bucket 1: Campaign State (Maintenance & History) --- */}
                {hasCampaignStateItems && (
                <div className="mb-6">
                    <NavHeader label="Campaign State" />

                    <div className="space-y-1">
                        <NavItem
                            label="Session Timeline"
                            icon="SessionLog"
                            active={activeView === 'session-logs'}
                            onClick={() => onSelectView('session-logs')}
                        />
                        <div className="pl-4 border-l border-slate-700 ml-5 space-y-1">
                            {debouncedFilter && filteredSessionLogs.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-slate-600 italic">No results</p>
                            ) : (
                                <>
                                    {filteredSessionLogs.slice(0, debouncedFilter ? undefined : 5).map(log => (
                                        <button
                                            key={log.id}
                                            onClick={() => onSelect('session-log', log.id)}
                                            className={twMerge(
                                                'w-full text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100',
                                                selectedIds.sessionLog === log.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                            )}
                                            title={log.title}
                                        >
                                            {log.title}
                                        </button>
                                    ))}
                                    {!debouncedFilter && (campaign.sessionLogs || []).length > 5 && (
                                        <button onClick={() => onSelectView('session-logs')} className="text-xs text-slate-500 hover:text-slate-300 pl-2">View all logs...</button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 mt-1">
                        <div className="flex items-center justify-between px-3 py-2 group">
                            <button
                            onClick={() => onSelectView('player-characters')}
                            className={twMerge(
                                'flex items-center gap-3 text-sm transition-colors w-full min-h-[44px] md:min-h-0',
                                activeView === 'player-characters' ? 'text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                            )}
                            >
                            <Icons.PlayerCharacters className="w-4 h-4" />
                            <span>Party & Characters</span>
                            </button>
                            <button onClick={() => onSelectView('player-characters')} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100">
                                <Icons.Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="pl-4 border-l border-slate-700 ml-5 space-y-1">
                            {debouncedFilter && filteredPlayerCharacters.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-slate-600 italic">No results</p>
                            ) : (
                                filteredPlayerCharacters.map(pc => (
                                    <button
                                        key={pc.id}
                                        onClick={() => onSelect('player-character', pc.id)}
                                        className={twMerge(
                                            'w-full text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100',
                                            selectedIds.playerCharacter === pc.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                        )}
                                        title={pc.characterSocial.characterName}
                                    >
                                        {pc.characterSocial.characterName}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {!debouncedFilter && showCombatTracker && (
                    <NavItem
                        label="Combat Tracker"
                        icon="Combat"
                        active={activeView === 'combat'}
                        onClick={() => onSelectView('combat')}
                    />
                    )}

                    <div className="space-y-1 mt-1">
                        <div className="flex items-center justify-between px-3 py-2 group">
                            <button
                            onClick={() => onSelectView('plots')}
                            className={twMerge(
                                'flex items-center gap-3 text-sm transition-colors w-full min-h-[44px] md:min-h-0',
                                activeView === 'plots' ? 'text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                            )}
                            >
                            <Icons.Plot className="w-4 h-4" />
                            <span>Plots & Arcs</span>
                            </button>
                            <button onClick={() => onSelectView('plots')} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100">
                                <Icons.Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="pl-4 border-l border-slate-700 ml-5 space-y-0.5">
                            {debouncedFilter && filteredPlots.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-slate-600 italic">No results</p>
                            ) : (
                                filteredPlots.map(plot => (
                                    <button
                                        key={plot.id}
                                        onClick={() => onSelect('plot', plot.id)}
                                        className={twMerge(
                                            'w-full text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100',
                                            selectedIds.plot === plot.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                        )}
                                        title={plot.title}
                                    >
                                        <Icons.Plot className="w-3 h-3 mr-2 flex-shrink-0"/>
                                        <span className="truncate">{plot.title}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {!debouncedFilter && showRelationshipGraph && (
                    <NavItem
                        label="World Graph"
                        icon="WorldGraph"
                        active={activeView === 'relationships'}
                        onClick={() => onSelectView('relationships')}
                    />
                    )}

                    {!debouncedFilter && showSecretsTracker && (
                    <NavItem
                        label="Secrets & Clues"
                        icon="Lock"
                        active={activeView === 'secrets'}
                        onClick={() => onSelectView('secrets')}
                    />
                    )}
                </div>
                )}

                {/* --- Bucket 2: Storylines --- */}
                {hasStorylineItems && (
                <div className="mb-6">
                    <NavHeader label="Storylines" />

                    {/* Adventures */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-3 py-1.5 group">
                            <button
                            onClick={() => onSelectView('adventures')}
                            className={twMerge(
                                'flex items-center gap-3 text-sm transition-colors w-full min-h-[44px] md:min-h-0',
                                activeView === 'adventures' ? 'text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                            )}
                            >
                            <Icons.Adventures className="w-4 h-4" />
                            <span>Adventures</span>
                            </button>
                            <button onClick={() => onSelectView('adventures')} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100">
                                <Icons.Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="pl-4 border-l border-slate-700 ml-5 space-y-1">
                            {filteredAdventures.map(adventure => (
                                <div key={adventure.id}>
                                    <div className="flex items-center justify-between group">
                                        <button onClick={() => toggleAdventure(adventure.id)} className="p-1 -ml-3 mr-1 text-slate-500 hover:text-slate-300">
                                            <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedAdventures[adventure.id] ? 'rotate-0' : '-rotate-90'}`} />
                                        </button>
                                        <button
                                            onClick={() => onSelect('adventure', adventure.id)}
                                            className={twMerge(
                                                'w-full text-left text-sm truncate pr-2 py-1 rounded-md',
                                                selectedIds.adventure === adventure.id && !selectedIds.scene ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                            )}
                                            title={adventure.title}
                                        >
                                            {adventure.title}
                                        </button>
                                        <button onClick={() => { onSelect('adventure', adventure.id); onShowGenerator('scene');}} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100">
                                            <Icons.Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {(expandedAdventures[adventure.id] || !!debouncedFilter) && (
                                        <div className="pl-5 mt-1 pt-1 border-l border-slate-700 ml-2 space-y-0.5">
                                            {adventure.scenes.filter(s => matchesFilter(s.title) || matchesFilter(adventure.title)).map(scene => (
                                                <button
                                                    key={scene.id}
                                                    draggable="true"
                                                    onDragStart={(e) => handleDragStart(e, adventure.id, scene.id)}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, adventure.id, scene.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={() => { onSelect('adventure', adventure.id); onSelect('scene', scene.id); }}
                                                    className={twMerge(
                                                        'w-full text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100',
                                                        selectedIds.scene === scene.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                                    )}
                                                    title={scene.title}
                                                >
                                                <SceneIcon type={scene.type} className="flex-shrink-0"/>
                                                <span>{scene.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}

                {/* --- Bucket 3: World Planning (Future & Static) --- */}
                {hasWorldPlanningItems && (
                <div className="mb-6">
                    <NavHeader label="World Planning" />

                    {/* Setting & Lore */}
                    {!debouncedFilter && (
                    <NavItem
                        label="Setting Overview"
                        icon="Setting"
                        active={activeView === 'setting'}
                        onClick={() => onSelectView('setting')}
                    />
                    )}

                    {(!debouncedFilter || filteredTopLevelArticles.length > 0) && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-3 py-2 group">
                            <button
                                onClick={() => onSelectView('lorebook')}
                                className={twMerge(
                                    'flex items-center gap-3 text-sm transition-colors w-full min-h-[44px] md:min-h-0',
                                    activeView === 'lorebook' ? 'text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                                )}
                            >
                                <Icons.FileCode className="w-4 h-4" />
                                <span>Lorebook</span>
                            </button>
                            <button onClick={() => onSelectView('lorebook')} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100">
                                <Icons.Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="pl-4 border-l border-slate-700 ml-5 space-y-0.5">
                            {filteredTopLevelArticles.map(article => (
                                debouncedFilter ? (
                                    <button
                                        key={article.id}
                                        onClick={() => onSelect('article', article.id)}
                                        className={twMerge(
                                            'w-full text-left text-sm truncate px-2 py-1.5 rounded-md flex items-center transition-all duration-100 min-w-0',
                                            selectedIds.article === article.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                        )}
                                        title={article.title}
                                    >
                                        <Icons.Scenes className="w-4 h-4 mr-2 flex-shrink-0"/>
                                        <span className="truncate">{article.title}</span>
                                    </button>
                                ) : (
                                    <ArticleTreeItem
                                        key={article.id}
                                        article={article}
                                        allArticles={campaign.articles}
                                        selectedId={selectedIds.article}
                                        onSelect={(id) => onSelect('article', id)}
                                        expandedArticles={expandedArticles}
                                        toggleArticle={toggleArticle}
                                    />
                                )
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Entities */}
                    {filteredEntityGroups.map(group => {
                        if (debouncedFilter && group.items.length === 0) return null;
                        const Icon = Icons[group.icon];
                        const isExpanded = debouncedFilter ? true : isViewExpanded(group.view);
                        return (
                            <div key={group.view} className="space-y-1">
                                <div className="flex items-center justify-between group">
                                    <button
                                        onClick={() => { onSelectView(group.view); toggleView(group.view); }}
                                        className={twMerge(
                                            'w-full flex items-center gap-3 px-3 py-2 min-h-[44px] md:min-h-0 text-sm rounded-md transition-colors',
                                            activeView === group.view ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                        )}
                                    >
                                        <Icon className="w-4 h-4" /> <span>{group.label}</span>
                                        <Icons.ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                    </button>
                                    <button onClick={() => onSelectView(group.view)} className="text-slate-400 hover:text-white transition-colors p-1 -m-1 rounded-md opacity-0 group-hover:opacity-100 mr-2">
                                        <Icons.Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                {isExpanded && (
                                    <div className="pl-4 border-l border-slate-700 ml-5 space-y-1">
                                        {group.items.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => onSelect(group.generatorType, item.id)}
                                                className={twMerge(
                                                    'w-full text-left text-sm truncate pr-2 pl-2 py-1 rounded-md',
                                                    group.selectedId === item.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
                                                )}
                                                title={item.name}
                                            >
                                                {item.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                )}
            </nav>
        </aside>
    );
};


const NavHeader = ({ label }: { label: string }) => <h3 className="px-3 pt-4 pb-1 text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</h3>;

const NavItem = ({ icon, label, active, onClick }: { icon: keyof typeof Icons, label: string, active: boolean, onClick: () => void }) => {
  const Icon = Icons[icon];
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 min-h-[44px] md:min-h-0 md:py-2 text-sm rounded-md transition-colors ${active ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      <Icon className="w-4 h-4" /> <span>{label}</span>
    </button>
  );
};
