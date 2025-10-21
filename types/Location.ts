// types/Location.ts
export interface Location {
  id: string;
  name: string;
  description: string;
  secrets: string;
  parentLocationId?: string;
  subLocationIds: string[];
}
