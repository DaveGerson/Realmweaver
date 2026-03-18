
export interface DiceRoll {
  id: string;
  formula: string;
  results: number[];
  total: number;
  timestamp: string;
  note?: string;
}
