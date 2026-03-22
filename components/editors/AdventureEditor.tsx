
import React, { useState, useEffect } from 'react';
import type { Adventure, Campaign } from '../../types/index';
import { Icons } from '../common/Icons';
import { PrepDocumentView } from './PrepDocumentView';
import { RegenerateButton } from '../common/RegenerateButton';
import { twMerge } from 'tailwind-merge';
import { generateScene } from '../../services/geminiService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';

interface AdventureEditorProps {
  adventure: Adventure;
  campaign: Campaign;
  onUpdate: (id: string, updatedData: Partial<Adventure>) => void;
  isMockMode?: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const AdventureEditor: React.FC<AdventureEditorProps> = ({ adventure, campaign, onUpdate, isMockMode = false, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(adventure);
  const [activeTab, setActiveTab] = useState<'details' | 'prepDoc'>('details');
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);

  useEffect(() => {
    setFormData(adventure);
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
      const sceneData = await generateScene(prompt, false, isMockMode, campaignContext);
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
    <div className="p-6 md:p-8 h-full flex flex-col overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <Icons.Adventures className="w-8 h-8" />
          <h1 className="text-3xl font-bold font-serif text-slate-100">Adventure: {adventure.title}</h1>
        </div>
        
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex space-x-6">
            <TabButton isActive={activeTab === 'details'} onClick={() => setActiveTab('details')}>
              <Icons.Setting className="w-4 h-4 mr-2" /> Details
            </TabButton>
            <TabButton isActive={activeTab === 'prepDoc'} onClick={() => setActiveTab('prepDoc')}>
              <Icons.FileCode className="w-4 h-4 mr-2" /> Prep Document
            </TabButton>
          </nav>
        </div>
      </header>
      
      {activeTab === 'details' && (
        <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 animate-in fade-in duration-300">
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
              <RegenerateButton fieldName="hook" currentValue={formData.hook} entityType="Adventure" entityContext={adventureEntityContext} onRegenerate={handleFieldRegenerate('hook')} isMockMode={isMockMode} campaignContext={campaignContext} />
            </div>
            <textarea
              name="hook"
              value={formData.hook}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 resize-y"
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
        </div>
      )}

      {activeTab === 'prepDoc' && (
        <PrepDocumentView adventure={adventure} campaign={campaign} />
      )}
    </div>
  );
};

const TabButton: React.FC<{isActive: boolean, onClick: () => void, children: React.ReactNode}> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={twMerge(
      'flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none',
      isActive
        ? 'border-amber-500 text-amber-400'
        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
    )}
  >
    {children}
  </button>
)
