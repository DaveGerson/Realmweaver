/**
 * The Lazy DM checklist (docs/design/lazy-dm-lens.md §4.5) — a purely
 * informational mirror of Shea's eight-step method, shown on the Session Prep
 * Wizard's Review & Go Live step. Every row is derived from wizard state that
 * already exists in memory when that step renders; nothing here reads the
 * store, calls the AI, or persists anything.
 *
 * NEVER a "missing" or red/urgent state — see `components/dialogs/prep/LazyChecklist.tsx`
 * for the (deliberately neutral) rendering. This module only computes what
 * each line says and which wizard step, if any, clicking it should jump to.
 */

/**
 * A wizard step this checklist can jump to. Deliberately a NARROWER string
 * union than (and therefore structurally assignable to) `WizardStep` in
 * `components/dialogs/SessionPrepWizard.tsx` — kept local here so this module
 * has zero dependency on the wizard component.
 */
export type LazyChecklistStepId = 'strongStart' | 'beats' | 'secretsCheck';

export interface ChecklistRow {
  /** Stable identity for the row — list keys only, never shown to the DM. */
  id: string;
  /** Shea's step label, plain copy, e.g. "Strong start". */
  label: string;
  /** One neutral-toned sentence describing what's on hand for tonight. Never a "missing" or warning phrasing. */
  detail: string;
  /** Present only when a wizard step exists for this row to jump to (some rows — Review the characters, Relevant monsters — have no matching step). */
  stepId?: LazyChecklistStepId;
}

export interface DeriveLazyChecklistInput {
  /** Shea step 1 — does the campaign have any player characters on file at all. */
  hasPlayerCharacters: boolean;
  /** Shea step 2 — whichever field currently owns "what opens tonight" (the lazy path's `strongStart`, or the standard path's `goLiveColdOpen`). */
  strongStart: string;
  /** Shea step 3 — the lazy path's own loose beats. Always 0 outside the lazy path. */
  beatsCount: number;
  /** Shea step 3 — formal scenes selected for tonight (composes with an adventure, in either flow). */
  scenesSelectedCount: number;
  /** Shea step 4 — the wizard's own Secrets Check roster (already scoped to tonight's NPCs/locations). */
  unrevealedSecretsCount: number;
  /** Shea step 5 — locations gathered for tonight (`activeLocationIds`). */
  locationsCount: number;
  /** Shea step 6 — NPCs gathered for tonight (`activeNpcIds`). */
  npcsCount: number;
  /** Shea step 8 — items in the campaign's own roster. */
  itemsCount: number;
  /** Shea step 8 — selected scenes that already carry their own reward text. */
  sceneRewardsCount: number;
  /**
   * Whether the wizard's lazy-only steps (Strong Start / Beats / Secrets
   * Check) exist in the CURRENT step order — only then do the "Strong
   * start" / "Potential scenes" / "Secrets and clues" rows carry a `stepId`
   * to jump to. The standard flow's own steps (Scenes, NPCs & Locations)
   * don't share an id with this checklist's rows, so there is no coherent
   * jump target for them outside the lazy path — the row stays informational
   * instead of turning into a dead click.
   */
  lazyStepsAvailable: boolean;
}

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Pure. Builds the eight checklist rows from wizard state that already
 * exists — no store read, no AI call, no persisted "completion" flag. Order
 * mirrors Shea's numbered steps, with "Review the characters" prepended
 * (§4.3's already-shipped slice, not one of Shea's eight, but the same
 * weekly-loop rhythm the rest of the checklist mirrors).
 */
export function deriveLazyChecklistRows(input: DeriveLazyChecklistInput): ChecklistRow[] {
  const {
    hasPlayerCharacters,
    strongStart,
    beatsCount,
    scenesSelectedCount,
    unrevealedSecretsCount,
    locationsCount,
    npcsCount,
    itemsCount,
    sceneRewardsCount,
    lazyStepsAvailable,
  } = input;

  const sceneParts: string[] = [];
  if (beatsCount > 0) sceneParts.push(pluralize(beatsCount, 'beat'));
  if (scenesSelectedCount > 0) sceneParts.push(`${pluralize(scenesSelectedCount, 'scene')} selected`);

  const rewardParts: string[] = [];
  if (sceneRewardsCount > 0) rewardParts.push(`${pluralize(sceneRewardsCount, 'scene')} with rewards written in`);
  if (itemsCount > 0) rewardParts.push(`${pluralize(itemsCount, 'item')} in your campaign`);

  return [
    {
      id: 'review-characters',
      label: 'Review the characters',
      detail: hasPlayerCharacters ? 'Your player characters are on file.' : 'No player characters logged yet.',
    },
    {
      id: 'strong-start',
      label: 'Strong start',
      detail: strongStart.trim() ? 'Written.' : 'Not written yet.',
      ...(lazyStepsAvailable ? { stepId: 'strongStart' as const } : {}),
    },
    {
      id: 'potential-scenes',
      label: 'Potential scenes',
      detail: sceneParts.length > 0 ? `${sceneParts.join(', ')}.` : 'Nothing sketched yet.',
      ...(lazyStepsAvailable ? { stepId: 'beats' as const } : {}),
    },
    {
      id: 'secrets-and-clues',
      label: 'Secrets and clues',
      detail:
        unrevealedSecretsCount > 0
          ? `${pluralize(unrevealedSecretsCount, 'secret')} unrevealed, ready to drop in.`
          : 'Nothing unrevealed to glance at yet.',
      ...(lazyStepsAvailable ? { stepId: 'secretsCheck' as const } : {}),
    },
    {
      id: 'fantastic-locations',
      label: 'Fantastic locations',
      detail: locationsCount > 0 ? `${pluralize(locationsCount, 'location')} gathered for tonight.` : 'None gathered yet.',
    },
    {
      id: 'important-npcs',
      label: 'Important NPCs',
      detail: npcsCount > 0 ? `${pluralize(npcsCount, 'NPC')} gathered for tonight.` : 'None gathered yet.',
    },
    {
      id: 'relevant-monsters',
      label: 'Relevant monsters',
      detail: 'Not tracked here — pick them at the table.',
    },
    {
      id: 'magic-item-rewards',
      label: 'Magic item rewards',
      detail: rewardParts.length > 0 ? `${rewardParts.join(', ')}.` : 'None flagged yet — Items and scene rewards both work.',
    },
  ];
}
