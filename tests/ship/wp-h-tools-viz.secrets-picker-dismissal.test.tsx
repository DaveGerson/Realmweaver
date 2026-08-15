// @vitest-environment jsdom
/**
 * wp-h-tools-viz — finding #115 (components/tools/SecretsTracker.tsx:138-236)
 *
 * `EntityPicker` is an `absolute z-50` popover whose only dismissal paths are
 * its own "Done"/"Close" buttons. `showPicker` is never cleared on Escape, on
 * an outside mousedown, or on blur, and the component registers no document
 * listener — so a picker opened on one secret stays open and overlaps whatever
 * the DM clicks next, and opening a second picker leaves two stacked. It also
 * autofocuses its search input without ever returning focus to the trigger.
 *
 * Contract:
 *  1. Escape (anywhere) closes the picker.
 *  2. A mousedown outside the popover closes it.
 *  3. Closing returns focus to the "Link entity" trigger button.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const { SecretsTracker } = await import('../../components/tools/SecretsTracker');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

const campaign = {
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [{ id: 'npc-1', name: 'Marla Tidebinder' }],
  locations: [],
  factions: [],
  items: [],
  adventures: [],
  articles: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [
    {
      id: 'secret-1',
      title: 'The regent is a changeling',
      content: 'Only the tide knows.',
      category: 'secret',
      isRevealed: false,
      linkedEntityIds: [],
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'secret-2',
      title: 'The lighthouse hides a portal',
      content: 'Beneath the lamp room.',
      category: 'secret',
      isRevealed: false,
      linkedEntityIds: [],
      createdAt: '2026-05-02T00:00:00.000Z',
    },
  ],
} as unknown as Campaign;

const openPicker = () => {
  render(
    <ConfirmDialogProvider>
      <SecretsTracker campaign={campaign} />
    </ConfirmDialogProvider>
  );

  // Expand the secret card, then open the entity picker.
  fireEvent.click(screen.getByRole('button', { name: /The regent is a changeling/i }));
  const trigger = screen.getByRole('button', { name: /link entity/i });
  fireEvent.click(trigger);
  expect(screen.getByPlaceholderText(/search entities/i)).toBeTruthy();
  return trigger;
};

afterEach(() => {
  cleanup();
});

describe('#115 SecretsTracker entity picker dismissal', () => {
  it('closes on Escape', () => {
    openPicker();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByPlaceholderText(/search entities/i)).toBeNull();
  });

  it('closes when the user mousedowns outside the popover', () => {
    openPicker();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByPlaceholderText(/search entities/i)).toBeNull();
  });

  it('returns focus to the trigger when dismissed with Escape', () => {
    const trigger = openPicker();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(document.activeElement).toBe(trigger);
  });

  it('does not steal focus when dismissed by mousedowning a different card', () => {
    // Regression for the #115 refinement: opening the picker on secret A and
    // then mousedown-ing on secret B's card must NOT leave focus (and thus
    // panel scroll position) pinned on secret A's "Link entity" trigger.
    render(
      <ConfirmDialogProvider>
        <SecretsTracker campaign={campaign} />
      </ConfirmDialogProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /The regent is a changeling/i }));
    const triggerA = screen.getByRole('button', { name: /link entity/i });
    fireEvent.click(triggerA);
    expect(screen.getByPlaceholderText(/search entities/i)).toBeTruthy();

    const cardB = screen.getByRole('button', { name: /The lighthouse hides a portal/i });
    fireEvent.mouseDown(cardB);

    // Picker A closed...
    expect(screen.queryByPlaceholderText(/search entities/i)).toBeNull();
    // ...but focus was NOT yanked back onto triggerA — it stayed with the
    // click (or at least off the dismissed trigger).
    expect(document.activeElement).not.toBe(triggerA);
  });
});
