// @vitest-environment jsdom
/**
 * SPEC — Wave 2, lane SECRETS (R2): "Generate ten, keep what you like" in
 * `components/tools/SecretsTracker.tsx`.
 *
 * `docs/design/lazy-dm-lens.md` R2: Shea's step 4 is over-prepare cheaply and
 * discard freely. The tracker gains ONE button that asks for roughly ten
 * secrets/clues in a single pass and shows them as checkable preview cards.
 * Only the checked ones become real secrets; discarding the rest costs the GM
 * nothing. The interaction idiom is the shipped
 * `components/views/session/QuickNpcGenerator.tsx` loop — generate, preview,
 * keep or discard — widened from one card to a batch.
 *
 * 1. **One button, always available.** A `Button` whose accessible name
 *    contains "Generate ten", present even in a campaign with no secrets yet.
 *    It takes no prompt: the DM types nothing.
 *
 * 2. **One call, with generation context.** Clicking builds the context with
 *    `buildCampaignContext({ variant: 'generation', campaign })` and calls the
 *    facade `generateSecretBatch(prompt, isMockMode, campaignContext)` — the
 *    facade, never `services/ai/*`. The `isMockMode` prop is forwarded
 *    verbatim. While the call is in flight the button is disabled, so a
 *    double-click cannot start two batches.
 *
 * 3. **A checkable preview, checked by default.** Each returned draft renders
 *    as a card with a checkbox whose accessible name is the draft's title, and
 *    every box starts CHECKED — the lazy path is "keep the lot" in one more
 *    click, and unchecking is how you discard. Generating creates NOTHING on
 *    its own.
 *
 * 4. **Keep only what is checked.** A keep button whose accessible name carries
 *    the current checked count ("Keep 3") calls
 *    `campaignService.createSecret` once per checked draft, passing the draft's
 *    `title` / `content` / `category` / `notes` and `isRevealed: false` — a
 *    kept proposal is never pre-revealed. Unchecked drafts are never created.
 *    With nothing checked the keep button is disabled.
 *
 * 5. **Keeping is a one-shot.** After keeping, the preview is gone: no
 *    checkboxes, no keep button, the "Generate ten" button back. There is no
 *    second click that could double-create the same batch.
 *
 * 6. **Discarding costs nothing.** A discard button clears the preview and
 *    writes nothing. Generate → discard → generate → discard creates nothing at
 *    all.
 *
 * 7. **Failure is survivable.** A rejected call shows an error message, creates
 *    nothing, leaves no preview behind, and re-enables the button. An empty
 *    batch says so plainly rather than rendering an empty panel.
 *
 * 8. Indigo belongs to RealmChat and appears nowhere here.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign } from '../types/index';

const h = vi.hoisted(() => ({
  createSecret: vi.fn(() => 'new-secret-id'),
  updateSecret: vi.fn(),
  revealSecret: vi.fn(),
  deleteSecret: vi.fn(),
  generateSecretBatch: vi.fn(),
  buildCampaignContext: vi.fn(() => 'GENERATION CONTEXT'),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    createSecret: h.createSecret,
    updateSecret: h.updateSecret,
    revealSecret: h.revealSecret,
    deleteSecret: h.deleteSecret,
  },
}));

vi.mock('@/services/aiService', () => ({
  generateSecretBatch: h.generateSecretBatch,
}));

vi.mock('@/services/contextBuilder', () => ({
  buildCampaignContext: h.buildCampaignContext,
}));

const { SecretsTracker } = await import('../components/tools/SecretsTracker');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');
const { ToastProvider } = await import('../hooks/useToast');

// --- Fixture ---------------------------------------------------------------

const DRAFTS = [
  { title: 'The Duke has not eaten in nine years', content: 'His plates go back untouched.', category: 'revelation' as const },
  { title: 'The wet footprints', content: 'They lead away from the throne.', category: 'clue' as const, notes: 'Best in the throne room.' },
  { title: 'They say the bells ring themselves', content: 'Only on the turn of the tide.', category: 'rumor' as const },
];

const emptyCampaign = () => ({
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [],
  locations: [],
  factions: [],
  items: [],
  adventures: [],
  articles: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [],
});

const renderTracker = (over: Record<string, unknown> = {}, isMockMode = true) => {
  const campaign = { ...emptyCampaign(), ...over } as unknown as Campaign;
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <SecretsTracker campaign={campaign} isMockMode={isMockMode} />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
};

const generateButton = () => screen.getByRole('button', { name: /generate ten/i });
const keepButton = () => screen.getByRole('button', { name: /^keep\b/i });
const queryKeepButton = () => screen.queryByRole('button', { name: /^keep\b/i });
const discardButton = () => screen.getByRole('button', { name: /discard/i });
const checkboxes = () => screen.queryAllByRole('checkbox');

/** Click Generate ten and wait for the preview to settle. */
const generate = async () => {
  fireEvent.click(generateButton());
  await waitFor(() => expect(checkboxes().length).toBeGreaterThan(0));
};

beforeEach(() => {
  h.createSecret.mockClear();
  h.updateSecret.mockClear();
  h.revealSecret.mockClear();
  h.deleteSecret.mockClear();
  h.buildCampaignContext.mockClear();
  h.generateSecretBatch.mockReset();
  h.generateSecretBatch.mockResolvedValue(DRAFTS);
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1 + 2. The button and the single call
// ---------------------------------------------------------------------------

describe('SecretsTracker — the Generate ten button', () => {
  it('is present even in a campaign with no secrets at all', () => {
    renderTracker({ secrets: [] });

    expect(generateButton()).toBeTruthy();
  });

  it('is present when the campaign has no secrets array at all', () => {
    renderTracker({ secrets: undefined });

    expect(generateButton()).toBeTruthy();
  });

  it('asks the facade once, with the generation-variant campaign context', async () => {
    renderTracker();

    await generate();

    expect(h.buildCampaignContext).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'generation' })
    );
    expect(h.generateSecretBatch).toHaveBeenCalledTimes(1);
    expect(h.generateSecretBatch).toHaveBeenCalledWith(
      expect.any(String), true, 'GENERATION CONTEXT'
    );
  });

  it('forwards isMockMode verbatim', async () => {
    h.generateSecretBatch.mockResolvedValue(DRAFTS);
    renderTracker({}, false);

    await generate();

    expect(h.generateSecretBatch).toHaveBeenCalledWith(expect.any(String), false, 'GENERATION CONTEXT');
  });

  it('disables itself while the batch is in flight, so a double click cannot start two', async () => {
    let settle: (drafts: typeof DRAFTS) => void = () => {};
    h.generateSecretBatch.mockReturnValue(new Promise(resolve => { settle = resolve; }));
    renderTracker();

    fireEvent.click(generateButton());
    await waitFor(() => expect((generateButton() as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(generateButton());

    expect(h.generateSecretBatch).toHaveBeenCalledTimes(1);

    settle(DRAFTS);
    await waitFor(() => expect(checkboxes().length).toBe(DRAFTS.length));
  });
});

// ---------------------------------------------------------------------------
// 3. The preview
// ---------------------------------------------------------------------------

describe('SecretsTracker — the preview cards', () => {
  it('renders one checkbox per draft, named for the draft', async () => {
    renderTracker();

    await generate();

    expect(checkboxes()).toHaveLength(DRAFTS.length);
    for (const d of DRAFTS) {
      expect(screen.queryByRole('checkbox', { name: d.title })).not.toBeNull();
    }
  });

  it('starts every card checked', async () => {
    renderTracker();

    await generate();

    expect(checkboxes().every(c => (c as HTMLInputElement).checked)).toBe(true);
  });

  it('shows each draft\'s content so the GM can judge it', async () => {
    renderTracker();

    await generate();

    for (const d of DRAFTS) {
      expect(screen.queryByText(d.content)).not.toBeNull();
    }
  });

  it('creates nothing merely by generating', async () => {
    renderTracker();

    await generate();

    expect(h.createSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4 + 5. Keeping
// ---------------------------------------------------------------------------

describe('SecretsTracker — keeping what you like', () => {
  it('creates every checked draft, unrevealed, with its own category', async () => {
    renderTracker();
    await generate();

    fireEvent.click(keepButton());

    await waitFor(() => expect(h.createSecret).toHaveBeenCalledTimes(DRAFTS.length));
    for (const d of DRAFTS) {
      expect(h.createSecret).toHaveBeenCalledWith(expect.objectContaining({
        title: d.title,
        content: d.content,
        category: d.category,
        isRevealed: false,
      }));
    }
  });

  it('carries a draft\'s notes through', async () => {
    renderTracker();
    await generate();

    fireEvent.click(keepButton());

    await waitFor(() => expect(h.createSecret).toHaveBeenCalledTimes(DRAFTS.length));
    expect(h.createSecret).toHaveBeenCalledWith(expect.objectContaining({
      title: 'The wet footprints',
      notes: 'Best in the throne room.',
    }));
  });

  it('never creates an unchecked draft', async () => {
    renderTracker();
    await generate();

    fireEvent.click(screen.getByRole('checkbox', { name: DRAFTS[0].title }));
    fireEvent.click(keepButton());

    await waitFor(() => expect(h.createSecret).toHaveBeenCalledTimes(DRAFTS.length - 1));
    expect(h.createSecret).not.toHaveBeenCalledWith(expect.objectContaining({ title: DRAFTS[0].title }));
  });

  it('carries the checked count in the keep button\'s name', async () => {
    renderTracker();
    await generate();

    expect(screen.queryByRole('button', { name: /keep 3/i })).not.toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: DRAFTS[0].title }));

    expect(screen.queryByRole('button', { name: /keep 2/i })).not.toBeNull();
  });

  it('disables keeping when nothing is checked', async () => {
    renderTracker();
    await generate();

    for (const box of checkboxes()) fireEvent.click(box);

    expect((keepButton() as HTMLButtonElement).disabled).toBe(true);
    expect(h.createSecret).not.toHaveBeenCalled();
  });

  it('dismisses the preview afterwards, so the batch cannot be kept twice', async () => {
    renderTracker();
    await generate();

    fireEvent.click(keepButton());

    await waitFor(() => expect(checkboxes()).toHaveLength(0));
    expect(queryKeepButton()).toBeNull();
    expect(generateButton()).toBeTruthy();
    expect(h.createSecret).toHaveBeenCalledTimes(DRAFTS.length);
  });
});

// ---------------------------------------------------------------------------
// 6. Discarding
// ---------------------------------------------------------------------------

describe('SecretsTracker — discarding costs nothing', () => {
  it('clears the preview and writes nothing', async () => {
    renderTracker();
    await generate();

    fireEvent.click(discardButton());

    await waitFor(() => expect(checkboxes()).toHaveLength(0));
    expect(h.createSecret).not.toHaveBeenCalled();
    expect(generateButton()).toBeTruthy();
  });

  it('survives generate → discard → generate → discard with nothing created', async () => {
    renderTracker();

    await generate();
    fireEvent.click(discardButton());
    await waitFor(() => expect(checkboxes()).toHaveLength(0));

    await generate();
    fireEvent.click(discardButton());
    await waitFor(() => expect(checkboxes()).toHaveLength(0));

    expect(h.createSecret).not.toHaveBeenCalled();
    expect(h.generateSecretBatch).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh batch fully checked again', async () => {
    renderTracker();

    await generate();
    fireEvent.click(screen.getByRole('checkbox', { name: DRAFTS[0].title }));
    fireEvent.click(discardButton());
    await waitFor(() => expect(checkboxes()).toHaveLength(0));

    await generate();

    expect(checkboxes().every(c => (c as HTMLInputElement).checked)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Failure modes
// ---------------------------------------------------------------------------

describe('SecretsTracker — a failed batch is survivable', () => {
  it('shows the error, creates nothing, and leaves no preview behind', async () => {
    h.generateSecretBatch.mockRejectedValue(new Error('The provider is asleep'));
    renderTracker();

    fireEvent.click(generateButton());

    await waitFor(() => expect(screen.queryByText(/the provider is asleep/i)).not.toBeNull());
    expect(checkboxes()).toHaveLength(0);
    expect(h.createSecret).not.toHaveBeenCalled();
  });

  it('re-enables the button after a failure', async () => {
    h.generateSecretBatch.mockRejectedValue(new Error('The provider is asleep'));
    renderTracker();

    fireEvent.click(generateButton());

    await waitFor(() => expect((generateButton() as HTMLButtonElement).disabled).toBe(false));
  });

  it('says so plainly when the batch comes back empty', async () => {
    h.generateSecretBatch.mockResolvedValue([]);
    renderTracker();

    fireEvent.click(generateButton());

    await waitFor(() => expect(h.generateSecretBatch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/nothing came back|no secrets|didn't propose/i)).not.toBeNull());
    expect(checkboxes()).toHaveLength(0);
    expect(queryKeepButton()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Hygiene
// ---------------------------------------------------------------------------

describe('SecretsTracker — Generate ten leaves indigo to RealmChat', () => {
  it('renders no indigo class in the preview', async () => {
    const { container } = renderTracker();

    await generate();

    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});
