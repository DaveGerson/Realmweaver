
import React, { useState, useEffect, useRef } from 'react';
import type { Adventure, Campaign } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { PrepDocumentView } from './PrepDocumentView';
import { RegenerateButton } from '../common/RegenerateButton';
import { generateScene } from '../../services/aiService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { LinkedText } from '../common/LinkedText';
import { textareaBaseClasses } from '../common/Textarea';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface AdventureEditorProps {
  adventure: Adventure;
  campaign: Campaign;
  onUpdate: (id: string, updatedData: Partial<Adventure>) => void;
  onDelete?: (id: string) => void;
  isMockMode?: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const ADVENTURE_TABS: TabDefinition[] = [
  { id: 'overview',  label: 'Overview',      icon: Icons.Adventures },
  { id: 'scenes',    label: 'Scenes',        icon: Icons.Scenes },
  { id: 'prepDoc',   label: 'Prep Document', icon: Icons.FileCode },
];

export const AdventureEditor: React.FC<AdventureEditorProps> = ({ adventure, campaign, onUpdate, onDelete, isMockMode = false, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(adventure);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const { confirm } = useConfirmDialog();

  // Tracks the last `adventure` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevAdventureRef = useRef(adventure);

  // Reset to first tab when the adventure changes
  useEffect(() => {
    setActiveTab('overview');
  }, [adventure.id]);

  useEffect(() => {
    const prevAdventure = prevAdventureRef.current;
    if (prevAdventure.id !== adventure.id) {
      // Switched to viewing a different adventure entirely — fully adopt it.
      setFormData(adventure);
    } else if (prevAdventure !== adventure) {
      // Same adventure, but the underlying object changed elsewhere (e.g. an
      // async AI generation). Only adopt fields the user hasn't started editing
      // since the last sync — any field where formData still matches what we
      // last saw from `adventure`. Fields the user has locally changed
      // (unblurred edits) are preserved.
      setFormData(prev => {
        const merged = { ...prev };
        (Object.keys(adventure) as (keyof Adventure)[]).forEach((key) => {
          if (prev[key] === prevAdventure[key]) {
            merged[key] = adventure[key];
          }
        });
        return merged;
      });
    }
    prevAdventureRef.current = adventure;
  }, [adventure]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = e.target.type === 'number';
    setFormData(prev => ({ ...prev, [name]: isNumber ? parseInt(value) || 0 : value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (JSON.stringify(formData) !== JSON.stringify(adventure)) {
        const { name, value } = e.target;
        const isNumber = e.target.type === 'number';
        onUpdate(adventure.id, { [name]: isNumber ? parseInt(value) || 0 : value });
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = await confirm(
      'Delete Adventure',
      `Are you sure you want to delete "${adventure.title}"? All its scenes will also be removed. This cannot be undone.`,
      { variant: 'danger' },
    );
    if (confirmed) onDelete(adventure.id);
  };

  const handleFieldRegenerate = (field: 'hook') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(adventure.id, { [field]: newValue });
  };

  const adventureEntityContext = `Adventure Title: ${formData.title}\nLevel: ${formData.level}\nTheme: ${formData.theme || 'Not specified'}\nHook: ${formData.hook || 'Not specified'}`;

  // --- Generate Next Scene ---
  const lastScene = adventure.scenes[adventure.scenes.length - 1];
  const sceneCount = adventure.scenes.length;
  const sceneGenerationDefaultPrompt = lastScene
    ? `Generate the next scene (scene ${sceneCount + 1}) for the adventure "${adventure.title}". The previous scene was "${lastScene.title}" (${lastScene.type}). Continue the narrative with a compelling follow-up that fits the theme: ${adventure.theme || 'adventure'}.`
    : `Generate the first scene for the adventure "${adventure.title}". Hook: ${adventure.hook || 'A dramatic opening'}. Theme: ${adventure.theme || 'adventure'}. This scene should grab the players immediately.`;

  const handleGenerateNextScene = async (prompt: string) => {
    setIsGeneratingScene(true);
    try {
      const sceneData = await generateScene(prompt, isMockMode, campaignContext);
      campaignService.createScene(adventure.id, {
        ...sceneData,
        locationId: undefined,
        npcIds: [],
      });
    } catch (error) {
      console.error('Failed to generate scene for adventure:', error);
    } finally {
      setIsGeneratingScene(false);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-y-auto custom-scrollbar animate-fade-in">
      <header className="flex justify-between items-start mb-6 gap-4">
        <div className="flex items-center gap-3 text-amber-400 min-w-0">
          <Icons.Adventures className="w-8 h-8 flex-shrink-0" />
          <h1 className="text-3xl font-bold font-serif text-slate-100 truncate">Adventure: {adventure.title}</h1>
        </div>
        {onDelete && (
          <Button variant="danger" size="sm" onClick={handleDelete} className="flex-shrink-0">
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Adventure
          </Button>
        )}
      </header>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 flex-1">
        <TabLayout tabs={ADVENTURE_TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Adventure Title</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                    placeholder="The Sunken City of Zylos"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Target Level</label>
                  <input
                    type="number"
                    name="level"
                    min={1}
                    max={20}
                    value={formData.level}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">One-Sentence Hook</label>
                  <RegenerateButton
                    fieldName="hook"
                    currentValue={formData.hook}
                    entityType="Adventure"
                    entityContext={adventureEntityContext}
                    onRegenerate={handleFieldRegenerate('hook')}
                    isMockMode={isMockMode}
                    campaignContext={campaignContext}
                  />
                </div>
                <textarea
                  name="hook"
                  value={formData.hook}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  rows={2}
                  className={`w-full px-3 py-2 transition-all placeholder:text-slate-600 ${textareaBaseClasses}`}
                  placeholder="A mysterious artifact is discovered, but it's part of a key to an ancient, powerful prison..."
                />
                {formData.hook && onNavigate && (
                    <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                        <LinkedText text={formData.hook} onNavigate={onNavigate} />
                    </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Themes & Mood</label>
                <input
                  type="text"
                  name="theme"
                  value={formData.theme}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Cosmic Horror, Investigation, Desperate Survival"
                />
              </div>

              {/* Backlinks Panel */}
              <BacklinksPanel entityId={adventure.id} entityType="adventure" onNavigate={onNavigate} />
            </div>
          )}

          {/* Scenes Tab */}
          {activeTab === 'scenes' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/50">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Icons.Scenes className="w-4 h-4" />
                  <span>{adventure.scenes.length} scene{adventure.scenes.length !== 1 ? 's' : ''}</span>
                </div>
                <GenerateHerePanel
                  buttonLabel="Generate next scene"
                  defaultPrompt={sceneGenerationDefaultPrompt}
                  isGenerating={isGeneratingScene}
                  onGenerate={handleGenerateNextScene}
                />
              </div>

              {adventure.scenes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No scenes yet. Generate one above, or add scenes from the adventure dashboard.</p>
              ) : (
                <div className="space-y-2">
                  {adventure.scenes.map((scene, index) => (
                    <div key={scene.id} className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-md border border-slate-800/50">
                      <span className="text-xs text-slate-500 w-5 text-right flex-shrink-0">{index + 1}</span>
                      <Icons.Scenes className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-200 flex-grow">{scene.title}</span>
                      <span className="text-xs text-slate-500 capitalize bg-slate-800 px-2 py-0.5 rounded-full">{scene.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prep Document Tab */}
          {activeTab === 'prepDoc' && (
            <PrepDocumentView adventure={adventure} campaign={campaign} />
          )}

        </TabLayout>
      </div>
    </div>
  );
};
