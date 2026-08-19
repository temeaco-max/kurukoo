import { getGenAIClient, GeminiProviderError } from './geminiService.js';
import { MistralProviderError, synthesizeMistralSpeech } from './mistralService.js';
import { getFeatureFlag } from './featureFlags.js';

export interface TtsResult {
  mime: string;
  data: Buffer;
  provider: 'gemini' | 'mistral';
  model: string;
}

function ttsProvider(): 'gemini' | 'mistral' | 'disabled' {
  const provider = String(process.env.KURUKOO_VOICE_TTS_PROVIDER || 'disabled').trim().toLowerCase();
  return provider === 'gemini' || provider === 'mistral' ? provider : 'disabled';
}
function geminiTtsModel(): string { return process.env.KURUKOO_VOICE_TTS_MODEL || process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'; }
function geminiTtsConfigured(): boolean { return ttsProvider() === 'gemini' && Boolean(geminiTtsModel()) && Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY); }
function mistralTtsConfigured(): boolean { return ttsProvider() === 'mistral' && Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_TTS_MODEL && process.env.MISTRAL_TTS_VOICE_ID); }
function mistralTtsEnabled(): boolean { return mistralTtsConfigured() && getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'mistral_tts'); }

/** TTS execution is enabled only for an explicit selected provider; live provider evidence remains a separate readiness dimension. */
export function isTtsEnabled(): boolean { return geminiTtsConfigured() || mistralTtsEnabled(); }
export function getTtsStatus(): { provider: 'gemini' | 'mistral' | 'disabled'; configured: boolean; executionEnabled: boolean } {
  const provider = ttsProvider();
  const configured = provider === 'gemini' ? geminiTtsConfigured() : provider === 'mistral' ? mistralTtsConfigured() : false;
  return { provider, configured, executionEnabled: provider === 'gemini' ? geminiTtsConfigured() : provider === 'mistral' ? mistralTtsEnabled() : false };
}

/** Provider-selected, bounded server TTS. No fallback is silently attributed as external provider audio. */
export async function synthesizeSpeech(input: string): Promise<TtsResult> {
  const text = String(input || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 2_000);
  if (!text) throw new GeminiProviderError('GEMINI_REQUEST_FAILED', 'Text-to-speech requires non-empty text.');
  if (ttsProvider() === 'mistral') {
    try { const result = await synthesizeMistralSpeech(text); return { mime: result.mime, data: result.data, provider: 'mistral', model: result.model }; }
    catch (error) { if (error instanceof MistralProviderError) throw error; throw new MistralProviderError('MISTRAL_REQUEST_FAILED', 'Mistral TTS request failed; no synthetic audio was generated.', { cause: error }); }
  }
  if (!geminiTtsConfigured()) throw new GeminiProviderError('GEMINI_NOT_CONFIGURED', 'Server TTS is not configured for this deployment.');
  try {
    const response = await getGenAIClient().models.generateContent({
      model: geminiTtsModel(),
      contents: text,
      config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } } },
    });
    const audio = response?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData?.data);
    if (!audio?.inlineData?.data) throw new GeminiProviderError('GEMINI_EMPTY_RESPONSE', 'Gemini TTS returned no audio.');
    return { mime: audio.inlineData.mimeType || 'audio/wav', data: Buffer.from(audio.inlineData.data, 'base64'), provider: 'gemini', model: geminiTtsModel() };
  } catch (error) {
    if (error instanceof GeminiProviderError) throw error;
    throw new GeminiProviderError('GEMINI_REQUEST_FAILED', 'Gemini TTS request failed.', { cause: error });
  }
}
