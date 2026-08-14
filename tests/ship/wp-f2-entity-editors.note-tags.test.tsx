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
});
