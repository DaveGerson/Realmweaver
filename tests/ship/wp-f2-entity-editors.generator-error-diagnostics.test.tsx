// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #110
 *
 * NpcGenerator.handleQuickGenerate (line 100):
 *   catch (err) { if (isMountedRef.current) setError('Failed to generate NPC. Please check your API key and try again.'); }
 * The caught error is dropped entirely — a JSON parse failure, a proxy 500, an
 * aborted request and a genuine auth failure are indistinguishable to both the
 * user and a developer reading the console. The same catch is repeated verbatim
 * in AdventureGenerator:76, ArticleGenerator:73, ItemGenerator, LocationGenerator,
 * FactionGenerator and SceneGenerator:75.
 *
 * Contract: the generator logs the real error (console.error with the error
 * object, so the stack survives) in addition to showing an inline message.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const failure = new Error('proxy responded 500: upstream unavailable');
const generateNpc = vi.fn(async () => { throw failure; });
vi.mock('@/services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
  generateEnhancedText: vi.fn(),
  chatToCreateEntity: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('@/services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { NpcGenerator } = await import('../../components/generators/NpcGenerator');

afterEach(() => {
  generateNpc.mockClear();
  vi.restoreAllMocks();
  cleanup();
});

describe('wp-f2-entity-editors #110 — generator failures leave a diagnostic trail', () => {
  it('logs the caught error instead of silently blaming the API key', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <NpcGenerator onNpcCreated={() => {}} isMockMode={false} />,
    );

    const promptField = container.querySelector('textarea') ?? container.querySelector('input[type="text"]');
    expect(promptField, 'prompt field not found').toBeTruthy();
    fireEvent.change(promptField as HTMLElement, { target: { value: 'A corrupt harbourmaster' } });

    const submit = Array.from(container.querySelectorAll('button'))
      .find(b => /generate/i.test(b.textContent || '') && !/conversational|chat/i.test(b.textContent || ''));
    expect(submit, 'generate button not found').toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(generateNpc).toHaveBeenCalled());
    // The inline message still appears...
    await waitFor(() => expect(container.textContent || '').toMatch(/failed to generate/i));

    // ...but the real error must reach the console for diagnosis.
    const loggedTheError = consoleError.mock.calls.some(call => call.some(arg => arg === failure));
    expect(
      loggedTheError,
      'the caught error object must be logged (console.error("[NpcGenerator] generation failed", err))',
    ).toBe(true);
  });
});
