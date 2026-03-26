
// components/common/DmStylePanel.tsx
// Settings panel for DM Style and per-feature overrides.

import React, { useState } from 'react';
import { Icons } from './Icons';
import { Button } from './Button';
import type { DmStyle } from '../../types/index';
import { isFeatureVisible, OVERRIDEABLE_FEATURES, FEATURE_LABELS } from '../../utils/dmStyleUtils';

interface DmStylePanelProps {
  dmStyle: DmStyle;
  featureOverrides: Record<string, boolean>;
  onSetDmStyle: (style: DmStyle) => void;
  onSetFeatureOverride: (feature: string, visible: boolean) => void;
  onClearFeatureOverride: (feature: string) => void;
  onClose: () => void;
}

const DM_STYLE_OPTIONS: Array<{ value: DmStyle; label: string; shortDesc: string }> = [
  { value: 'guided', label: 'Guided', shortDesc: 'Essentials only' },
  { value: 'standard', label: 'Standard', shortDesc: 'Balanced' },
  { value: 'power', label: 'Power', shortDesc: 'Everything' },
];

export const DmStylePanel: React.FC<DmStylePanelProps> = ({
  dmStyle,
  featureOverrides,
  onSetDmStyle,
  onSetFeatureOverride,
  onClearFeatureOverride,
  onClose,
}) => {
  const [showOverrides, setShowOverrides] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="DM Style Settings">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Icons.Sliders className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-slate-100">DM Style</h2>
          </div>
          <Button
            variant="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <Icons.X className="w-4 h-4" />
          </Button>
        </div>

        {/* DM Style Selector */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400">Choose which features are visible by default.</p>
          <div className="grid grid-cols-3 gap-2">
            {DM_STYLE_OPTIONS.map((opt) => {
              const isSelected = dmStyle === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSetDmStyle(opt.value)}
                  className={[
                    'flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-center transition-all duration-150',
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600',
                  ].join(' ')}
                >
                  <span className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-slate-500">{opt.shortDesc}</span>
                </button>
              );
            })}
          </div>

          {/* Effective visibility summary */}
          <div className="text-xs text-slate-500 bg-slate-800/60 rounded-md p-2">
            {dmStyle === 'guided' && 'Hides: continuity checker, world graph, secrets tracker, combat tracker, backlinks panel, and keyboard shortcuts.'}
            {dmStyle === 'standard' && 'Shows all core tools. Advanced analysis tools are available.'}
            {dmStyle === 'power' && 'All features visible. Nothing is hidden by default.'}
          </div>

          {/* Per-feature overrides */}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOverrides(p => !p)}
              className="w-full text-slate-400 hover:text-slate-200 justify-start py-1"
            >
              <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform mr-1.5 ${showOverrides ? '' : '-rotate-90'}`} />
              Custom feature overrides
              {Object.keys(featureOverrides).length > 0 && (
                <span className="ml-auto bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {Object.keys(featureOverrides).length}
                </span>
              )}
            </Button>

            {showOverrides && (
              <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                {OVERRIDEABLE_FEATURES.map((feature) => {
                  const defaultVisible = isFeatureVisible(feature, dmStyle, {});
                  const hasOverride = feature in featureOverrides;
                  const currentVisible = isFeatureVisible(feature, dmStyle, featureOverrides);

                  return (
                    <div key={feature} className="flex items-center justify-between gap-2 px-1">
                      <span className={`text-xs flex-1 ${hasOverride ? 'text-amber-300' : 'text-slate-400'}`}>
                        {FEATURE_LABELS[feature]}
                        {hasOverride && (
                          <span className="ml-1 text-[10px] text-amber-500">(override)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (hasOverride) {
                              // If override matches the toggled state, clear it
                              onClearFeatureOverride(feature);
                            } else {
                              // Set override to opposite of current
                              onSetFeatureOverride(feature, !currentVisible);
                            }
                          }}
                          className={[
                            'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                            currentVisible ? 'bg-amber-600' : 'bg-slate-700',
                          ].join(' ')}
                          role="switch"
                          aria-checked={currentVisible}
                          title={hasOverride ? 'Click to remove override' : `Click to override (default: ${defaultVisible ? 'visible' : 'hidden'})`}
                        >
                          <span
                            aria-hidden="true"
                            className={[
                              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              currentVisible ? 'translate-x-4' : 'translate-x-0',
                            ].join(' ')}
                          />
                        </button>
                        {/* Clear override button */}
                        {hasOverride && (
                          <button
                            type="button"
                            onClick={() => onClearFeatureOverride(feature)}
                            className="text-slate-600 hover:text-slate-300 transition-colors"
                            title="Reset to style default"
                          >
                            <Icons.X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(featureOverrides).length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => OVERRIDEABLE_FEATURES.forEach(f => onClearFeatureOverride(f))}
                    className="w-full text-slate-500 hover:text-amber-400 mt-1"
                  >
                    Reset all overrides to style defaults
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
