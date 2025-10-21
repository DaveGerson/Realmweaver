// types/Item.ts
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  properties: string; // e.g., "Requires attunement, +1 to AC"
}
