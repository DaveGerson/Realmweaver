
import React, { useState } from 'react';
import type { RollableTable, RollableTableEntry } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { parseFormula, rollDice } from '@/utils/diceUtils';
import { QUICK_TABLES, tableDieSides, resolveTableEntry } from '@/data/randomTables';

/**
 * §4.9 — Quick Tables. A disclosure using the exact same toggle pattern as
 * Quick Tools' own Dice Roller (`QuickToolsPanel.tsx`'s `showDiceRoller`
 * state): no AI, no latency, works with no backend at all. One tap rolls a
 * hand-authored table via `utils/diceUtils.ts`'s `rollDice` (read-only
 * import) and shows the result; "Log it" writes it as a `'manual'` note via
 * `campaignService.addSessionRunnerNote`, the same call the design's report
 * names for this feature.
 */

interface LastRoll {
    table: RollableTable;
    roll: number;
    entry: RollableTableEntry;
}

export const QuickTablesPanel: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const [lastRoll, setLastRoll] = useState<LastRoll | null>(null);
    const [logged, setLogged] = useState(false);

    const handleRoll = (table: RollableTable) => {
        const sides = tableDieSides(table);
        const parsed = sides > 0 ? parseFormula(`1d${sides}`) : null;
        if (!parsed) return; // defensive only — every shipped table's dieType parses cleanly
        const { total } = rollDice(parsed);
        const entry = resolveTableEntry(table, total) ?? { range: String(total), result: 'No result defined for this roll.' };
        setLastRoll({ table, roll: total, entry });
        setLogged(false);
    };

    const handleLogIt = () => {
        // Self-guarded, not just `disabled`-gated: a second press must never
        // write a duplicate note, the same idiom every other Quick Tools
        // "log it once" action (Use It, Promote to NPC) already follows.
        if (!lastRoll || logged) return;
        campaignService.addSessionRunnerNote(
            `${lastRoll.table.title} (${lastRoll.table.dieType}, rolled ${lastRoll.roll}): ${lastRoll.entry.result}`
        );
        setLogged(true);
    };

    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full justify-start"
            >
                <Icons.List className="w-4 h-4 mr-2 text-amber-400" />
                Quick Tables
                <Icons.ChevronDown className={twMerge('w-3 h-3 ml-auto text-slate-500 transition-transform', expanded && 'rotate-180')} />
            </Button>

            {expanded && (
                <div className="space-y-2">
                    <div className="space-y-1">
                        {QUICK_TABLES.map((table) => (
                            <button
                                key={table.title}
                                type="button"
                                onClick={() => handleRoll(table)}
                                className="w-full flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700/60 text-left transition-colors"
                            >
                                <span className="text-slate-200 truncate">{table.title}</span>
                                <span className="text-slate-500 font-mono flex-shrink-0">{table.dieType}</span>
                            </button>
                        ))}
                    </div>

                    {lastRoll && (
                        <div className="rounded-md border border-amber-700/40 bg-amber-900/10 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider truncate">
                                    {lastRoll.table.title}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono flex-shrink-0">rolled {lastRoll.roll}</span>
                            </div>
                            <p className="text-sm text-slate-200 leading-relaxed">{lastRoll.entry.result}</p>
                            <Button variant="secondary" size="sm" onClick={handleLogIt} disabled={logged}>
                                <Icons.Check className="w-3.5 h-3.5 mr-1.5" />
                                {logged ? 'Logged' : 'Log it'}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
