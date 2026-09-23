// @vitest-environment jsdom
/**
 * components/common/CanonCapturePicker.tsx
 *
 * The shared inline picker behind "Make this canon" (Monte Cook's
 * improv-canon-capture posture), used by both RunningLog (live session) and
 * SessionLogEditor (post-hoc review). Purely presentational — these tests
 * cover only its own contract: pre-filled/editable name, kind selection,
 * Save/Cancel — never campaignService (each host owns that).
 *
 * No jest-dom in this repo (there is no vitest setup file, and the package
 * is not a dependency) — plain DOM property/attribute reads instead.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { CanonCapturePicker } from '../components/common/CanonCapturePicker';

afterEach(() => cleanup());

describe('CanonCapturePicker', () => {
  it('defaults to New NPC selected and pre-fills the name from splitCanonNote', () => {
    render(
      <CanonCapturePicker
        content="Borin, the one-eyed innkeeper, mentions a hidden door."
        onSave={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole('radio', { name: 'New NPC' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'New Location' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: 'New Item' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: 'New Note' }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText('Canon entity name') as HTMLInputElement).value).toBe('Borin');
  });

  it('lets the DM switch kind (without touching the name) and edit the name before saving', () => {
    const onSave = vi.fn();
    render(
      <CanonCapturePicker
        content="The Rusty Anchor: a dive bar near the docks."
        onSave={onSave}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'New Location' }));
    expect(screen.getByRole('radio', { name: 'New Location' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'New NPC' }).getAttribute('aria-checked')).toBe('false');

    const nameInput = screen.getByLabelText('Canon entity name') as HTMLInputElement;
    expect(nameInput.value).toBe('Rusty Anchor');

    fireEvent.change(nameInput, { target: { value: 'The Rusty Anchor Inn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('location', 'The Rusty Anchor Inn');
  });

  it('disables Save and calls neither callback when the name is blank', () => {
    const onSave = vi.fn();
    render(<CanonCapturePicker content="Borin" onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('Canon entity name'), { target: { value: '   ' } });
    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    fireEvent.click(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Cancel calls onCancel and never onSave', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<CanonCapturePicker content="Borin" onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Enter in the name field saves; Escape cancels', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<CanonCapturePicker content="Borin" onSave={onSave} onCancel={onCancel} defaultKind="item" />);

    const nameInput = screen.getByLabelText('Canon entity name');
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('item', 'Borin');

    fireEvent.keyDown(nameInput, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
