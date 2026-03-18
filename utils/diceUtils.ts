
export interface ParsedFormula {
    count: number;
    sides: number;
    keepHighest?: number;
    keepLowest?: number;
    modifier: number;
}

export interface RollResult {
    results: number[];
    keptResults: number[];
    total: number;
}

export const parseFormula = (formula: string): ParsedFormula | null => {
    const trimmed = formula.trim().toLowerCase();
    const match = trimmed.match(/^(\d+)d(\d+)(kh\d+|kl\d+)?([+-]\d+)?$/);
    if (!match) return null;

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    let keepHighest: number | undefined;
    let keepLowest: number | undefined;

    if (match[3]) {
        if (match[3].startsWith('kh')) {
            keepHighest = parseInt(match[3].slice(2), 10);
        } else if (match[3].startsWith('kl')) {
            keepLowest = parseInt(match[3].slice(2), 10);
        }
    }

    const modifier = match[4] ? parseInt(match[4], 10) : 0;

    if (count < 1 || count > 100 || sides < 1 || sides > 1000) return null;
    if (keepHighest !== undefined && (keepHighest < 1 || keepHighest > count)) return null;
    if (keepLowest !== undefined && (keepLowest < 1 || keepLowest > count)) return null;

    return { count, sides, keepHighest, keepLowest, modifier };
};

export const rollDice = (parsed: ParsedFormula): RollResult => {
    const results: number[] = [];
    for (let i = 0; i < parsed.count; i++) {
        results.push(Math.floor(Math.random() * parsed.sides) + 1);
    }

    let keptResults: number[];
    if (parsed.keepHighest !== undefined) {
        keptResults = [...results].sort((a, b) => b - a).slice(0, parsed.keepHighest);
    } else if (parsed.keepLowest !== undefined) {
        keptResults = [...results].sort((a, b) => a - b).slice(0, parsed.keepLowest);
    } else {
        keptResults = results;
    }

    const total = keptResults.reduce((sum, v) => sum + v, 0) + parsed.modifier;
    return { results, keptResults, total };
};

export const formatFormula = (count: number, sides: number, keepHighest?: number, keepLowest?: number, modifier?: number): string => {
    let formula = `${count}d${sides}`;
    if (keepHighest !== undefined) formula += `kh${keepHighest}`;
    if (keepLowest !== undefined) formula += `kl${keepLowest}`;
    if (modifier && modifier > 0) formula += `+${modifier}`;
    if (modifier && modifier < 0) formula += `${modifier}`;
    return formula;
};
