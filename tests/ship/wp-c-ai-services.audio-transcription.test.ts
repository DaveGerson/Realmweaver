// @vitest-environment jsdom
/**
 * wp-c-ai-services — findings #41 and #42 (services/ai/audioTranscription.ts)
 *
 * #41: `sessionPromise = ai.live.connect({...})` is never awaited or caught,
 *      and `startAudioTranscription` returns `{ stop: teardown }` immediately.
 *      When connect() rejects (bad gcpApiKey), the mic stream is ALREADY live:
 *      the rejection goes unhandled, `onConnected` never fires, the caller's
 *      try/catch in SessionLogEditor.tsx:180-186 sees nothing, and every
 *      subsequent click leaks another MediaStream + 16 kHz AudioContext.
 *      Desired: await the connect promise inside a try/catch that runs
 *      `teardown()` and re-throws, so the JSDoc's "Throws if … the API
 *      connection fails" is actually true.
 *
 * #42: The function bypasses the aiService facade entirely and has no mock, in
 *      violation of CLAUDE.md ("Components import ONLY from aiService.ts";
 *      "Every AI function needs a mock in mockService.ts"). It is the one code
 *      path that ignores the mock-mode switch, so an E2E/mock run still opens
 *      the mic and a billed Gemini websocket.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// @google/genai stub — connect() always fails, mimicking a bad API key.
// The rejected promise is pre-handled here so Node does not report an
// unhandled rejection; production code attaching its own handler is exactly
// what this test is asking for.
// ---------------------------------------------------------------------------

const CONNECT_ERROR = new Error('API key not valid. Please pass a valid API key.');

const connectMock = vi.fn(() => {
  const p = Promise.reject(CONNECT_ERROR);
  p.catch(() => {});
  return p;
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    live = { connect: connectMock };
    constructor(_opts: unknown) {}
  },
  Modality: { AUDIO: 'AUDIO', TEXT: 'TEXT' },
}));

import { startAudioTranscription } from '../../services/ai/audioTranscription';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

// ---------------------------------------------------------------------------
// Browser API stubs
// ---------------------------------------------------------------------------

let trackStop: ReturnType<typeof vi.fn>;
let audioCtxClose: ReturnType<typeof vi.fn>;

function stubBrowserAudio() {
  trackStop = vi.fn();
  audioCtxClose = vi.fn(async () => {});

  const stream = { getTracks: () => [{ stop: trackStop }] };

  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });

  class FakeAudioContext {
    state = 'running';
    destination = {};
    close = audioCtxClose;
    resume = vi.fn(async () => {});
    createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
    createScriptProcessor = vi.fn(() => ({ connect: vi.fn(), onaudioprocess: null }));
    constructor(_opts: unknown) {}
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  connectMock.mockClear();
  stubBrowserAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// #41
// ---------------------------------------------------------------------------

describe('startAudioTranscription surfaces connection failures (#41)', () => {
  it('rejects when ai.live.connect() fails instead of resolving a dead session', async () => {
    await expect(
      startAudioTranscription({
        gcpApiKey: 'bad-key',
        onTranscript: vi.fn(),
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError: vi.fn(),
      })
    ).rejects.toThrow(/API key not valid/);
  });

  it('tears down the microphone stream when the connection fails', async () => {
    await startAudioTranscription({
      gcpApiKey: 'bad-key',
      onTranscript: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onError: vi.fn(),
    }).catch(() => undefined);

    // Without this the browser recording indicator stays on and each retry
    // leaks another MediaStream + AudioContext.
    expect(trackStop).toHaveBeenCalled();
    expect(audioCtxClose).toHaveBeenCalled();
  });

  // The original #41 guard only wrapped `await sessionPromise` — a REJECTED
  // connect promise. If `ai.live.connect(...)` itself throws SYNCHRONOUSLY
  // (a malformed config object, an SDK version mismatch validating eagerly),
  // the throw happens before `sessionPromise` is even assigned, so the
  // already-live mic stream and AudioContext leaked exactly as described in
  // #41, just via a different trigger.
  it('tears down the microphone stream when connect() throws synchronously', async () => {
    connectMock.mockImplementationOnce(() => {
      throw new Error('Invalid live session config: unsupported speechConfig shape.');
    });

    await expect(
      startAudioTranscription({
        gcpApiKey: 'bad-key',
        onTranscript: vi.fn(),
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError: vi.fn(),
      })
    ).rejects.toThrow(/unsupported speechConfig/);

    expect(trackStop).toHaveBeenCalled();
    expect(audioCtxClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// #42
// ---------------------------------------------------------------------------

describe('audio transcription goes through the aiService facade (#42)', () => {
  it('exposes startAudioTranscription on services/aiService.ts', () => {
    expect(typeof (aiService as Record<string, unknown>).startAudioTranscription).toBe('function');
  });

  it('has a mock implementation in services/ai/mockService.ts', () => {
    expect(typeof (mockService as Record<string, unknown>).startAudioTranscription).toBe('function');
  });

  it('does not touch the microphone or the Gemini Live API in mock mode', async () => {
    const facade = (aiService as Record<string, unknown>).startAudioTranscription as
      | ((config: unknown) => Promise<{ stop: () => Promise<void> }>)
      | undefined;
    expect(facade).toBeTypeOf('function');

    const onTranscript = vi.fn();
    const session = await facade!({
      gcpApiKey: 'unused',
      onTranscript,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onError: vi.fn(),
      isMockMode: true,
    });

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
    await session.stop();
  });

  // The facade existing is necessary but not sufficient — the whole point of
  // #42 is that a real caller (SessionLogEditor's AI Scribe button) must
  // actually route through it instead of reaching past it into
  // services/ai/audioTranscription directly, which is the one path that
  // ignores isMockMode entirely.
  //
  // components/editors/SessionLogEditor.tsx is wp-f1-owned, not this
  // package's — wp-c's job is to make that swap trivial (the facade above
  // now re-exports both the function AND its config/session types, see
  // aiService.ts) and hand the swap off, not to edit the file directly. A
  // hard assertion here that the component's source never imports
  // `services/ai/*` would be correct once wp-f1 lands the swap, but would
  // fail-flakily today purely on cross-package sequencing (this file is
  // shared, actively-edited state — not something wp-c owns or controls the
  // timing of), which would make an UNRELATED package's suite-green
  // requirement gate this one. Left as a documented follow-up rather than a
  // brittle cross-package assertion; see the fix-report note.
});
