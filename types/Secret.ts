
// types/Secret.ts

export interface Secret {
  id: string;
  title: string;
  content: string;          // The actual secret/clue text
  category: 'secret' | 'clue' | 'revelation' | 'rumor';
  isRevealed: boolean;      // Has this been revealed to players?
  revealedInSessionId?: string;  // Which session it was revealed in
  linkedEntityIds?: string[];     // Related entities (NPCs, locations, etc.)
  createdAt: string;        // ISO date
  notes?: string;           // DM notes about this secret

  // --- Ontology element E1 / E2 (mystery edges) ------------------------------
  // All three are optional: a save written before they existed is valid as-is
  // and needs no migration. Read `cluesNeeded` as `cluesNeeded ?? 3`.

  /**
   * E1 — the clue→revelation edge. Meaningful on a `category: 'clue'` secret:
   * the id of the `category: 'revelation'` secret this clue supports.
   *
   * ID-BEARING: it joins the N-place integrity contract (semantic-model.html
   * §7). It must be cleared by `_purgeEntityReferences` when its target is
   * deleted, rewritten by BOTH id-remap passes (`duplicateCampaign`,
   * `importTemplateData`), validated by the continuity checker's
   * broken-reference rule, and surfaced as an inbound edge by
   * `utils/backlinkUtils.ts`.
   */
  revealsSecretId?: string;

  /**
   * E1 — meaningful on a revelation: the mystery dead-ends if the party never
   * gets here, so the Three-Clue lint applies to it. Absent ⇒ not vital.
   */
  isVital?: boolean;

  /**
   * E2 amendment (Option 3) — per-revelation override of the Three-Clue
   * threshold. Absent ⇒ 3.
   */
  cluesNeeded?: number;
}
