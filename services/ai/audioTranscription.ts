
// services/ai/audioTranscription.ts
//
// Encapsulates the Gemini Live API real-time audio transcription feature.
// @google/genai is loaded via dynamic import so it is excluded from the main
// bundle and only fetched when the user actually initiates a recording session.

export interface AudioTranscriptionConfig {
  gcpApiKey: string;
  onTranscript: (text: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: unknown) => void;
}

export interface AudioTranscriptionSession {
  stop: () => Promise<void>;
}

// NOTE: Audio transcription intentionally uses Gemini model directly (not provider abstraction). Deferred from Claude migration — requires GCP audio API integration.
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const SYSTEM_INSTRUCTION =
  'You are a silent scribe for a Dungeon Master. Your ONLY job is to listen to the game session and transcribe what is said accurately into text. Do not speak. Do not interrupt.';

/**
 * Starts a real-time audio transcription session using the Gemini Live API.
 *
 * Returns an `AudioTranscriptionSession` with a `stop()` method that cleanly
 * tears down the mic stream, audio context, and Live API connection, then
 * resolves once everything is closed.
 *
 * Throws if the browser mic permission is denied or the API connection fails.
 */
export async function startAudioTranscription(
  config: AudioTranscriptionConfig
): Promise<AudioTranscriptionSession> {
  const { gcpApiKey, onTranscript, onConnected, onDisconnected, onError } = config;

  // Dynamic import — keeps @google/genai out of the initial bundle.
  const { GoogleGenAI, Modality } = await import('@google/genai');

  const ai = new GoogleGenAI({ apiKey: gcpApiKey });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

  let sessionPromise: Promise<any> | null = null;

  const teardown = async () => {
    if (sessionPromise) {
      const s = sessionPromise;
      sessionPromise = null;
      try {
        const session = await s;
        session.close();
      } catch (e) {
        // Ignore close errors during teardown
      }
    }

    if (audioCtx.state !== 'closed') {
      try {
        await audioCtx.close();
      } catch (e) {
        // Ignore
      }
    }

    stream.getTracks().forEach(track => track.stop());
  };

  sessionPromise = ai.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      inputAudioTranscription: {},
      systemInstruction: SYSTEM_INSTRUCTION,
    },
    callbacks: {
      onopen: async () => {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        // ScriptProcessor is deprecated but remains the most broadly supported
        // approach for raw PCM access without AudioWorklet complexity.
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const l = inputData.length;
          const int16 = new Int16Array(l);
          for (let i = 0; i < l; i++) {
            int16[i] = inputData[i] * 32768;
          }

          let binary = '';
          const bytes = new Uint8Array(int16.buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          if (sessionPromise) {
            sessionPromise.then(session => {
              session.sendRealtimeInput({
                media: { mimeType: 'audio/pcm;rate=16000', data: base64Data },
              });
            });
          }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        onConnected();
      },

      onmessage: (msg: any) => {
        if (msg.serverContent?.inputTranscription) {
          const text: string = msg.serverContent.inputTranscription.text;
          if (text) {
            onTranscript(text);
          }
        }
        // Model audio output is intentionally ignored — the system instruction
        // tells the model to stay silent.
      },

      onclose: () => {
        onDisconnected();
      },

      onerror: (err: unknown) => {
        onError(err);
      },
    },
  });

  return {
    stop: teardown,
  };
}
