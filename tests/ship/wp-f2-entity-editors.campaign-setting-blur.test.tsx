// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #111
 *
 * CampaignSettingEditor seeds `formData.officialSetting` with
 * `campaign.officialSetting || OFFICIAL_SETTINGS[0]` (line 36) but the dirty
 * check in `handleBlur` (line 78) compares it against the RAW
 * `campaign.officialSetting`. For every custom-world campaign (where that field
 * is undefined) the comparison is permanently true, so simply focusing the
 * Title field and clicking away calls `onUpdate(formData)` — writing
 * `officialSetting: 'Forgotten Realms'` into a custom campaign, marking the
 * state dirty and re-arming the debounced localStorage save on every focus-out.
 *
 * Contract:
 *   1. Blur with no user edit must not call onUpdate.
 *   2. When there IS a real edit on a custom-setting campaign, the payload must
 *      not introduce an officialSetting (only include it when
 *      settingType === 'official').
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  analyzeWritingStyle: vi.fn(),
}));

const { CampaignSettingEditor } = await import('../../components/editors/CampaignSettingEditor');

afterEach(cleanup);

// A custom-world campaign: officialSetting has never been picked.
const campaign = {
  id: 'camp-1',
  title: 'The Drowned Empire',
  setting: 'A sunken archipelago of guild-states',
  settingType: 'custom',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function titleInput(container: HTMLElement): HTMLInputElement {
  const el = Array.from(container.querySelectorAll('input'))
    .find(i => i.getAttribute('name') === 'title');
  expect(el, 'title input not found').toBeTruthy();
  return el as HTMLInputElement;
}

describe('wp-f2-entity-editors #111 — no phantom writes from the settings editor', () => {
  it('does not call onUpdate when the user focuses and leaves without editing', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <CampaignSettingEditor campaign={campaign} onUpdate={onUpdate} isMockMode />,
    );

    const input = titleInput(container);
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not inject an officialSetting into a custom campaign on a real edit', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <CampaignSettingEditor campaign={campaign} onUpdate={onUpdate} isMockMode />,
    );

    const input = titleInput(container);
    fireEvent.change(input, { target: { name: 'title', value: 'The Drowned Empire II' } });
    fireEvent.blur(input);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.title).toBe('The Drowned Empire II');
    expect(payload.officialSetting).toBeUndefined();
  });
});
