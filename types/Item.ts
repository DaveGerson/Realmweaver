// types/Item.ts
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
export type ItemType = 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'tool' | 'other';

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  properties: string; // e.g., "Requires attunement, +1 to AC"
  // Optional structured fields
  itemType?: ItemType;
  attunement?: boolean;
  weight?: string;    // e.g. "4 lbs"
  value?: string;     // e.g. "50 gp"
}
