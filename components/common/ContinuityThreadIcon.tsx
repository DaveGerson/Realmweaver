import React from 'react';
import { Icons } from './Icons';
import { twMerge } from 'tailwind-merge';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import type { ContinuityThreadKind } from '@/utils/continuityThreads';

/**
 * Icon for a continuity thread ("loose end"), coloured from ENTITY_TYPE_CONFIG.
 * Secrets have no entity-config entry and render as a muted lock.
 *
 * Static class map keyed by ENTITY_TYPE_CONFIG colour names so Tailwind's
 * build-time scanner sees every literal class.
 */
const ACCENT_TEXT_CLASS: Record<string, string> = {
    rose: 'text-rose-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    orange: 'text-orange-400',
    slate: 'text-slate-400',
};

const KIND_CONFIG_KEY: Partial<Record<ContinuityThreadKind, string>> = {
    'session-loose-ends': 'sessionLog',
    plot: 'plot',
    scene: 'scene',
    adventure: 'adventure',
};

export const ContinuityThreadIcon: React.FC<{ kind: ContinuityThreadKind; className?: string }> = ({ kind, className }) => {
    const configKey = KIND_CONFIG_KEY[kind];
    const config = configKey ? ENTITY_TYPE_CONFIG[configKey] : undefined;
    const Icon = (config ? Icons[config.icon as keyof typeof Icons] : Icons.Lock) as React.ComponentType<{ className?: string }>;
    const accent = ACCENT_TEXT_CLASS[config?.color ?? 'slate'] ?? ACCENT_TEXT_CLASS.slate;
    return <Icon className={twMerge('w-3.5 h-3.5 flex-shrink-0', accent, className)} aria-hidden="true" />;
};
