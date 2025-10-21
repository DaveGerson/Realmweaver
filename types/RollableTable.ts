export interface RollableTableEntry {
  range: string; // e.g., "1", "2-3", "4-6"
  result: string;
}

export interface RollableTable {
    title: string;
    dieType: string; // e.g., "d6", "d20"
    entries: RollableTableEntry[];
}
