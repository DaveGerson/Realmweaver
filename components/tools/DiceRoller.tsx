
import React, { useState, useCallback } from 'react';
import type { DiceRoll } from '../../types';
import { Icons } from '../common/Icons';
import { parseFormula, rollDice, formatFormula, type ParsedFormula } from '../../utils/diceUtils';

interface DiceRollerProps {
    onLogRoll?: (roll: DiceRoll) => void;
}

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const MAX_HISTORY = 20;

interface RollResult extends DiceRoll {
    keptResults: number[];
    hasKeep: boolean;
    modifier: number;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ onLogRoll }) => {
    const [quantity, setQuantity] = useState(1);
    const [formulaInput, setFormulaInput] = useState('');
    const [history, setHistory] = useState<RollResult[]>([]);
    const [noteInput, setNoteInput] = useState('');
    const [formulaError, setFormulaError] = useState('');

    const addToHistory = useCallback((roll: RollResult) => {
        setHistory(prev => [roll, ...prev].slice(0, MAX_HISTORY));
    }, []);

    const handleDieClick = useCallback((sides: number) => {
        const parsed: ParsedFormula = { count: quantity, sides, modifier: 0 };
        const { results, keptResults, total } = rollDice(parsed);
        const formula = formatFormula(quantity, sides);

        const roll: RollResult = {
            id: crypto.randomUUID(),
            formula,
            results,
            keptResults,
            total,
            timestamp: new Date().toISOString(),
            hasKeep: false,
            modifier: 0,
        };
        addToHistory(roll);
    }, [quantity, addToHistory]);

    const handleAdvantage = useCallback(() => {
        const parsed: ParsedFormula = { count: 2, sides: 20, keepHighest: 1, modifier: 0 };
        const { results, keptResults, total } = rollDice(parsed);

        const roll: RollResult = {
            id: crypto.randomUUID(),
            formula: '2d20kh1',
            results,
            keptResults,
            total,
            timestamp: new Date().toISOString(),
            hasKeep: true,
            modifier: 0,
        };
        addToHistory(roll);
    }, [addToHistory]);

    const handleDisadvantage = useCallback(() => {
        const parsed: ParsedFormula = { count: 2, sides: 20, keepLowest: 1, modifier: 0 };
        const { results, keptResults, total } = rollDice(parsed);

        const roll: RollResult = {
            id: crypto.randomUUID(),
            formula: '2d20kl1',
            results,
            keptResults,
            total,
            timestamp: new Date().toISOString(),
            hasKeep: true,
            modifier: 0,
        };
        addToHistory(roll);
    }, [addToHistory]);

    const handleFormulaRoll = useCallback(() => {
        setFormulaError('');
        const parsed = parseFormula(formulaInput);
        if (!parsed) {
            setFormulaError('Invalid formula. Try: 2d6+4, 4d6kh3, 2d20kl1');
            return;
        }

        const { results, keptResults, total } = rollDice(parsed);
        const hasKeep = parsed.keepHighest !== undefined || parsed.keepLowest !== undefined;

        const roll: RollResult = {
            id: crypto.randomUUID(),
            formula: formulaInput.trim().toLowerCase(),
            results,
            keptResults,
            total,
            timestamp: new Date().toISOString(),
            hasKeep,
            modifier: parsed.modifier,
        };
        addToHistory(roll);
        setFormulaInput('');
    }, [formulaInput, addToHistory]);

    const handleLogRoll = useCallback((roll: RollResult) => {
        if (!onLogRoll) return;
        const diceRoll: DiceRoll = {
            id: roll.id,
            formula: roll.formula,
            results: roll.results,
            total: roll.total,
            timestamp: roll.timestamp,
            note: noteInput.trim() || undefined,
        };
        onLogRoll(diceRoll);
        setNoteInput('');
    }, [onLogRoll, noteInput]);

    const lastRoll = history[0] || null;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
                <Icons.Dice className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">Dice Roller</span>
            </div>

            <div className="p-3 space-y-3">
                {/* Die Buttons */}
                <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {DICE_TYPES.map(sides => (
                            <button
                                key={sides}
                                onClick={() => handleDieClick(sides)}
                                className="px-2.5 py-1.5 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                            >
                                d{sides}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Qty:</span>
                        <select
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                            className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                            {QUANTITY_OPTIONS.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Advantage / Disadvantage */}
                <div className="flex gap-1.5 border-t border-slate-700 pt-3">
                    <button
                        onClick={handleAdvantage}
                        className="flex-1 px-2 py-1.5 rounded-md bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
                    >
                        Advantage
                    </button>
                    <button
                        onClick={handleDisadvantage}
                        className="flex-1 px-2 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
                    >
                        Disadvantage
                    </button>
                </div>

                {/* Formula Input */}
                <div className="border-t border-slate-700 pt-3">
                    <div className="flex gap-1.5">
                        <div className="relative flex-1">
                            <Icons.Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                            <input
                                type="text"
                                value={formulaInput}
                                onChange={(e) => { setFormulaInput(e.target.value); setFormulaError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleFormulaRoll(); }}
                                placeholder="2d6+4, 4d6kh3..."
                                className="w-full bg-slate-700 border border-slate-600 rounded-md pl-7 pr-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <button
                            onClick={handleFormulaRoll}
                            disabled={!formulaInput.trim()}
                            className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                        >
                            Roll
                        </button>
                    </div>
                    {formulaError && (
                        <p className="text-xs text-red-400 mt-1">{formulaError}</p>
                    )}
                </div>

                {/* Last Roll Display */}
                {lastRoll && (
                    <div className="border-t border-slate-700 pt-3">
                        <div className="bg-slate-900 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-amber-400 font-mono">{lastRoll.formula}</span>
                                <span className="text-lg font-bold text-white">{lastRoll.total}</span>
                            </div>
                            <div className="text-xs text-slate-400">
                                <span className="font-mono">
                                    [{lastRoll.results.join(', ')}]
                                </span>
                                {lastRoll.hasKeep && (
                                    <span className="text-slate-500">
                                        {' '}&rarr; kept [{lastRoll.keptResults.join(', ')}]
                                    </span>
                                )}
                                {lastRoll.modifier !== 0 && (
                                    <span className="text-slate-500">
                                        {' '}{lastRoll.modifier > 0 ? '+' : ''}{lastRoll.modifier}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* History */}
                {history.length > 0 && (
                    <div className="border-t border-slate-700 pt-3">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">History</h3>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {history.map(roll => (
                                <div
                                    key={roll.id}
                                    className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-slate-700/50 cursor-pointer"
                                    onClick={() => handleLogRoll(roll)}
                                    title="Click to log to session"
                                >
                                    <span className="font-mono text-amber-400">{roll.formula}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 font-mono">[{roll.results.join(',')}]</span>
                                        <span className="text-white font-bold">= {roll.total}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Log to Session */}
                {onLogRoll && lastRoll && (
                    <div className="border-t border-slate-700 pt-3 space-y-1.5">
                        <input
                            type="text"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Note (optional)..."
                            className="w-full bg-slate-700 border border-slate-600 rounded-md px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        <button
                            onClick={() => handleLogRoll(lastRoll)}
                            className="w-full px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                        >
                            Log to Session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
