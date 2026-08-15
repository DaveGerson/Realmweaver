// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #108
 *
 * NoteEditor.handleTagsChange (line 83) does
 * `e.target.value.split(',').map(t => t.trim())` with no filtering, so the
 * natural typing sequence "plot, idea," commits `['plot','idea','']` on blur.
 * NoteDashboard then renders `note.tags.map(tag => <span key={tag}>…)`
 * (NoteDashboard.tsx:996): the empty string shows up as a blank pill, and a
 * tag typed twice produces duplicate React keys with unstable reconciliation.
 *
 * Contract: on COMMIT (blur) the persisted tag list is trimmed, empty entries
 * dropped and duplicates collapsed. The user may still type a trailing comma
 * while editing — the filtering belongs on the commit path, not on keystrokes.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Note } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { NoteEditor } = await import('../../components/editors/NoteEditor');
const { NoteDashboard } = await import('../../components/dashboards/NoteDashboard');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

const note = {
  id: 'note-1',
  title: 'Table rules',
  content: 'No phones at the table.',
  tags: [],
} as unknown as Note;

function tagsInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[name="tags"]')
    ?? Array.from(container.querySelectorAll('input')).find(i => /tag/i.test(i.getAttribute('placeholder') || ''));
  expect(el, 'tags input not found').toBeTruthy();
  return el as HTMLInputElement;
}

function commit(container: HTMLElement, value: string, onUpdate: ReturnType<typeof vi.fn>) {
  const input = tagsInput(container);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  const call = onUpdate.mock.calls.find(c => (c[1] as Record<string, unknown>)?.tags !== undefined);
  expect(call, `blur did not commit tags for input "${value}"`).toBeTruthy();
  return (call![1] as { tags: string[] }).tags;
}

describe('wp-f2-entity-editors #108 — note tags are cleaned on commit', () => {
  it('drops the empty entry produced by a trailing comma', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ConfirmDialogProvider>
        <NoteEditor note={note} onUpdate={onUpdate} onDelete={() => {}} isMockMode />
      </ConfirmDialogProvider>,
    );

    expect(commit(container, 'plot, idea,', onUpdate)).toEqual(['plot', 'idea']);
  });

  it('collapses duplicate tags so dashboard keys stay unique', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ConfirmDialogProvider>
        <NoteEditor note={note} onUpdate={onUpdate} onDelete={() => {}} isMockMode />
      </ConfirmDialogProvider>,
    );

    expect(commit(container, 'plot, plot , idea', onUpdate)).toEqual(['plot', 'idea']);
  });

  it('clears the raw trailing comma from the input even when the cleaned list matches what is already saved', () => {
    // Regression for the nit attached to #108: when `cleanedTags` happens to
    // equal the already-persisted `note.tags`, the store write is (correctly)
    // skipped — but the local formData must still switch to the cleaned
    // array, or the input keeps showing the raw trailing comma/empty entry
    // until the note is re-selected.
    const alreadySavedNote = { ...note, tags: ['plot'] } as unknown as Note;
    const onUpdate = vi.fn();
    const { container } = render(
      <ConfirmDialogProvider>
        <NoteEditor note={alreadySavedNote} onUpdate={onUpdate} onDelete={() => {}} isMockMode />
      </ConfirmDialogProvider>,
    );

    const input = tagsInput(container);
    fireEvent.change(input, { target: { value: 'plot,' } });
    // Pre-cleanup display: formData.tags is the raw split ['plot', ''],
    // rendered via `.join(', ')` — the trailing comma is still visible.
    expect(input.value).toBe('plot, ');
    fireEvent.blur(input);

    expect(input.value).toBe('plot');
    expect(onUpdate.mock.calls.some(c => (c[1] as Record<string, unknown>)?.tags !== undefined)).toBe(false);
  });
});

describe('wp-f2-entity-editors #108 — NoteDashboard render-side tag dedupe', () => {
  it('dedupes/filters tags at render time for notes persisted before the commit-time cleanup (e.g. import/AI-created)', () => {
    // Not every note goes through NoteEditor.handleBlur — import and
    // AI-created notes can already carry duplicate/empty tags on disk. The
    // dashboard itself must not choke on those (finding #108).
    const legacyNote = {
      id: 'note-legacy',
      title: 'Imported note',
      content: '',
      tags: ['plot', 'plot', '', 'idea'],
      lastModified: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Note;

    // A duplicate/empty-tag note must not blow up rendering (e.g. via
    // React's duplicate-key warning escalating under strict test setups) —
    // render must simply produce one pill per distinct, non-empty tag.
    const { container } = render(
      <NoteDashboard notes={[legacyNote]} onNoteCreated={() => {}} onSelectNote={() => {}} isMockMode />,
    );

    const card = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('Imported note'));
    expect(card, 'note card not found').toBeTruthy();

    const pills = Array.from(card!.querySelectorAll('span')).filter(s => /plot|idea/.test(s.textContent || ''));
    const pillTexts = pills.map(p => p.textContent);
    expect(pillTexts).toEqual(['plot', 'idea']);
  });
});
