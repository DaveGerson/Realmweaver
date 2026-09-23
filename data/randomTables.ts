// data/randomTables.ts
//
// §4.9 — Quick Tables. Hand-authored, always-available `RollableTable`s for
// the Session Runner's Quick Tools: zero AI, zero latency, works with no
// backend at all — the answer to "something's interrupting the scene, give
// me a result right now" that `generateRollableTable` (AI-latency-bound)
// can't. Reuses the shipped `RollableTable`/`RollableTableEntry` shape
// (types/RollableTable.ts) rather than inventing a second table format, so
// the same rendering/rolling code that would handle an AI-generated table
// works here unchanged.
//
// Every table's entries are validated (`tests/quickTables.randomTables.test.ts`)
// to cover 1..N contiguously with no gaps and no overlaps, where N is the
// table's own die size — the same invariant an AI-generated table is expected
// to honor.

import type { RollableTable, RollableTableEntry } from '../types/index';

export const TAVERN_INTERRUPTION: RollableTable = {
  title: 'Tavern Interruption',
  dieType: 'd8',
  entries: [
    { range: '1', result: 'A drunk mistakes one of you for someone who still owes them money.' },
    { range: '2', result: 'A bard starts loudly — and badly — retelling last week\'s news as an epic.' },
    { range: '3', result: 'The innkeeper\'s dog decides it loves you and will not leave your side.' },
    { range: '4', result: 'A fight breaks out two tables over. Nothing to do with you. Yet.' },
    { range: '5', result: 'Someone overhears a name you mentioned and leans in to listen closer.' },
    { range: '6', result: 'The ale runs out mid-round and the whole room groans as one.' },
    { range: '7', result: 'A hooded figure leaves a folded note on your table and slips out the back.' },
    { range: '8', result: 'A traveling merchant tries to sell you something that is obviously stolen.' },
  ],
};

export const THE_WATCH_NOTICES: RollableTable = {
  title: 'The Watch Notices',
  dieType: 'd6',
  entries: [
    { range: '1', result: 'A weapon, not quite hidden well enough.' },
    { range: '2', result: 'Blood on a sleeve that no one is explaining.' },
    { range: '3', result: 'A face that matches a posted description.' },
    { range: '4', result: 'Coin changing hands a little too quickly.' },
    { range: '5', result: 'A door that should be locked, standing open.' },
    { range: '6', result: 'Nothing at all — but they are watching now anyway.' },
  ],
};

export const RUMOR_MAKING_THE_ROUNDS: RollableTable = {
  title: 'A Rumor Making the Rounds',
  dieType: 'd10',
  entries: [
    { range: '1', result: 'The old mill is not as abandoned as everyone thinks.' },
    { range: '2', result: 'A noble house is quietly buying up debt all across town.' },
    { range: '3', result: 'Someone has been paying good coin for maps of the sewers.' },
    { range: '4', result: 'The last caravan through here was never actually seen leaving.' },
    { range: '5', result: 'A local has been putting on airs since coming into sudden wealth.' },
    { range: '6', result: 'The well water has tasted different since last week.' },
    { range: '7', result: 'A shrine outside town has started drawing pilgrims again.' },
    { range: '8', result: 'Guards have been quietly reassigned away from the docks.' },
    { range: '9', result: 'Someone is offering a reward for information, no questions asked.' },
    { range: '10', result: 'A face from years ago was spotted — older, but unmistakable.' },
  ],
};

export const COMPLICATION_ON_THE_ROAD: RollableTable = {
  title: 'Complication on the Road',
  dieType: 'd8',
  entries: [
    { range: '1', result: 'The path ahead has washed out — a detour costs the party real time.' },
    { range: '2', result: 'A wheel, an axle, or a shoe fails at the worst possible moment.' },
    { range: '3', result: 'The weather turns hard and fast, forcing an unplanned stop.' },
    { range: '4', result: 'A fellow traveler asks to join, for a stretch or for good.' },
    { range: '5', result: 'Wildlife has already claimed the usual campsite.' },
    { range: '6', result: 'Someone is clearly, badly, following the party.' },
    { range: '7', result: 'Supplies are lighter than expected — someone miscounted.' },
    { range: '8', result: 'A landmark on the map is not where the map says it is.' },
  ],
};

export const WHATS_IN_THE_POCKET: RollableTable = {
  title: "What's in the Pocket",
  dieType: 'd6',
  entries: [
    { range: '1', result: 'A few coins, foreign and unfamiliar.' },
    { range: '2', result: 'A key that fits nothing anyone recognizes yet.' },
    { range: '3', result: 'A folded scrap of paper with a name and nothing else.' },
    { range: '4', result: 'A small, cheap trinket, clearly sentimental to someone.' },
    { range: '5', result: 'A receipt or ticket stub from somewhere oddly specific.' },
    { range: '6', result: 'Nothing of value — just lint, and a story you make up on the spot.' },
  ],
};

/** Every Quick Table, in the fixed display order the panel renders them. */
export const QUICK_TABLES: readonly RollableTable[] = [
  TAVERN_INTERRUPTION,
  THE_WATCH_NOTICES,
  RUMOR_MAKING_THE_ROUNDS,
  COMPLICATION_ON_THE_ROAD,
  WHATS_IN_THE_POCKET,
];

/**
 * Parses one entry's `range` ("4" or "2-6") into an inclusive `[min, max]`
 * pair. Returns `null` for anything malformed (non-numeric, reversed, or
 * containing extra characters) rather than guessing.
 */
export function parseTableRange(range: string): [number, number] | null {
  const trimmed = range.trim();
  const single = /^(\d+)$/.exec(trimmed);
  if (single) {
    const n = Number(single[1]);
    return [n, n];
  }
  const pair = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (pair) {
    const low = Number(pair[1]);
    const high = Number(pair[2]);
    return low <= high ? [low, high] : null;
  }
  return null;
}

/** The number of sides in a table's die, parsed from its `dieType` (e.g. `"d8"` → `8`). Returns 0 if unparseable. */
export function tableDieSides(table: RollableTable): number {
  const match = /^d(\d+)$/i.exec(table.dieType.trim());
  return match ? Number(match[1]) : 0;
}

/** Finds the entry whose range contains `roll`, or `undefined` if no entry matches. */
export function resolveTableEntry(table: RollableTable, roll: number): RollableTableEntry | undefined {
  return table.entries.find((entry) => {
    const range = parseTableRange(entry.range);
    return range !== null && roll >= range[0] && roll <= range[1];
  });
}
