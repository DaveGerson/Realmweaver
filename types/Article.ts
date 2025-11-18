
// types/Article.ts
export type ArticleCategory = 'lore' | 'history' | 'cosmology';

export interface Article {
  id: string;
  title: string;
  category: ArticleCategory;
  content: string;
  parentArticleId?: string;
  subArticleIds: string[];
  relatedEntityIds?: string[]; // IDs of NPCs, Locations, Factions, Items linked to this lore
}
