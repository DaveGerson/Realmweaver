
import React, { useCallback, useState } from 'react';
import type { Campaign } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { generateSceneMenu, type SceneMenuDraft } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';

export interface SceneMenuSuggestionsProps {
  campaign: Campaign;
  isMockMode: boolean;
  /**
   * Fires once, with the checked drafts only (`hook` carried through as
   * `notes`) — the caller (the Beats step) folds them into its own
   * `lazyBeats` state. Never called with an empty array.
   */
  onAdd: (items: Array<{ title: string; notes?: string }>) => void;
}

/**
 * §4.1 Scene Menu Generator (docs/design/lazy-dm-lens.md §4 R1 / the "scene
 * menu"). Mirrors `SecretsTracker.tsx`'s `GenerateTenPanel` (R2) generate ->
 * preview -> keep-some idiom one step down in scale: one click (zero typed
 * prompt — the request is a fixed constant inside `dmCoach.ts`) fetches 5-6
 * draft scenes, the DM checks the ones they like, "Add N" folds them into the
 * Beats list, "Discard" drops the whole batch with no trace.
 */
export const SceneMenuSuggestions: React.FC<SceneMenuSuggestionsProps> = ({ campaign, isMockMode, onAdd }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SceneMenuDraft[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const campaignContext = buildCampaignContext({ variant: 'generation', campaign });
      const result = await generateSceneMenu(campaignContext, isMockMode);
      if (result.length === 0) {
        setDrafts(null);
        setError('Nothing came back — try again, or add beats by hand.');
      } else {
        setDrafts(result);
        setChecked(new Set(result.map((_, i) => i)));
      }
    } catch (err) {
      setDrafts(null);
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [campaign, isMockMode]);

  const toggleChecked = useCallback((index: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (!drafts) return;
    const items = drafts
      .filter((_, i) => checked.has(i))
      .map(d => ({ title: d.title, ...(d.hook ? { notes: d.hook } : {}) }));
    if (items.length === 0) return;
    onAdd(items);
    // One-shot: dismiss immediately so the same batch cannot be added twice.
    setDrafts(null);
    setChecked(new Set());
  }, [drafts, checked, onAdd]);

  const handleDiscard = useCallback(() => {
    setDrafts(null);
    setChecked(new Set());
    setError(null);
  }, []);

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <Icons.Sparkles className="w-4 h-4 mr-1.5" />
        )}
        Suggest a few
      </Button>

      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}

      {drafts && drafts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {drafts.map((draft, i) => (
            <label
              key={`${draft.title}-${i}`}
              className="flex items-start gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked.has(i)}
                onChange={() => toggleChecked(i)}
                aria-label={draft.title}
                className="mt-0.5 accent-amber-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{draft.title}</p>
                {draft.hook && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{draft.hook}</p>
                )}
              </div>
            </label>
          ))}

          <div className="flex gap-2 pt-0.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={checked.size === 0}
              className="flex-1"
            >
              Add {checked.size}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
