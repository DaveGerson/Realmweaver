
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[]; // For categorization like "Plot", "Idea", "Summary"
  createdAt: string; // ISO Date string
  lastModified: string; // ISO Date string
}
