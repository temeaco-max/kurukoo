import crypto from 'node:crypto';
import { Router } from 'express';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { appendChatMessage } from '../services/chatConversationService.js';
import { processCanonicalChatTurn } from '../services/canonicalChatTurnService.js';
import { createVoiceSession, endVoiceSession, getVoiceSession, getVoiceStatus } from '../services/voiceService.js';
import { synthesizeSpeech } from '../services/serverTtsService.js';
import { transcribeMistralAudio } from '../services/mistralService.js';
import { executeVoiceTool, isVoiceToolAllowed } from '../services/voiceToolRegistry.js';
import { createArtifact, setArtifactTranscript } from '../services/artifactService.js';

const router = Router();
const sessionRateLimit = createRateLimiter({ windowMs: 60_000, max: Math.max(1, Math.min(20, Number(process.env.KURUKOO_VOICE_SESSION_RATE_LIMIT) || 5)), keyPrefix: 'voice-session', message: 'Voice session limit reached — try again shortly' });

function guestIdentity(req: any, res: any): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map((value: string) => value.trim()).find((value: string) => value.startsWith('kurukoo_guest_id='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_guest_id='.length));
  const id = `anon_${crypto.randomUUID()}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_guest_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
  return id;
}

function identity(req: AuthRequest, res: any) {
  const phone = req.user?.phone ? String(req.user.phone) : guestIdentity(req, res);
  return { phone, isGuest: phone.startsWith('anon_') };
}

router.get('/status', optionalAuthenticateUser, (_req, res) => res.json({ voice: getVoiceStatus() }));

router.post('/session', optionalAuthenticateUser, sessionRateLimit, async (req: AuthRequest, res) => {
  const { phone, isGuest } = identity(req, res);
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.slice(0, 160) : undefined;
  try {
    const session = await createVoiceSession({ phone, conversationId, isGuest });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ voice: { ...session, guest: isGuest } });
  } catch (error: any) {
    const code = error?.code || 'VOICE_SESSION_ERROR';
    const status = code === 'VOICE_UNAVAILABLE' ? 503 : code === 'VOICE_CONCURRENT_LIMIT' ? 429 : 502;
    console.warn('[Voice] session_create_failed', { code, guest: isGuest });
    res.status(status).json({ error: error?.message || 'Voice is unavailable right now. You can continue by typing.', code });
  }
});

router.post('/tools', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const { phone, isGuest } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const args = req.body?.args;
  const session = getVoiceSession(sessionId, phone);
  if (!session) return res.status(404).json({ error: 'Voice session is unavailable.' });
  if (!isVoiceToolAllowed(name)) return res.status(403).json({ error: 'That voice action is not permitted.' });
  if (name === 'route_user_intent' && (typeof args?.text !== 'string' || args.text.trim().length === 0 || args.text.length > 4000)) return res.status(400).json({ error: 'Invalid spoken request.' });
  try {
    const result = await executeVoiceTool(name, args, { phone, conversationId: session.conversationId, isGuest, sessionId });
    console.info('[Voice] tool_executed', { sessionId, name, ok: result.ok !== false });
    res.json({ result });
  } catch (error) {
    console.warn('[Voice] tool_failed', { sessionId, name });
    res.status(500).json({ error: 'That request could not be completed right now.' });
  }
});

router.post('/transcribe', optionalAuthenticateUser, sessionRateLimit, async (req: AuthRequest, res) => {
  const { phone, isGuest } = identity(req, res);
  if (isGuest) return res.status(403).json({ error: 'Sign in to use server transcription.' });
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const session = getVoiceSession(sessionId, phone);
  if (!session) return res.status(404).json({ error: 'Voice session is unavailable.' });
  const encoded = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.replace(/^data:[^;]+;base64,/, '') : '';
  const mimeType = typeof req.body?.mimeType === 'string' && req.body.mimeType.startsWith('audio/') ? req.body.mimeType.slice(0, 80) : 'audio/webm';
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) return res.status(400).json({ error: 'audioBase64 is required.' });
  const data = Buffer.from(encoded, 'base64');
  if (!data.length || data.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Audio must be between 1 byte and 10 MB.' });
  const filename = typeof req.body?.filename === 'string' ? req.body.filename.slice(0, 120) : 'kurukoo-audio';
  let artifact: Awaited<ReturnType<typeof createArtifact>> | undefined;
  try {
    artifact = await createArtifact({ phone, filename, mimeType, data, kind: 'voice', transcriptStatus: 'pending' });
    const transcript = await transcribeMistralAudio({ data, mimeType, filename, language: typeof req.body?.language === 'string' ? req.body.language : undefined });
    artifact = (await setArtifactTranscript(phone, artifact.id, transcript.text, 'available')) || artifact;
    const turn = await processCanonicalChatTurn({ phone, message: transcript.text, channel: 'web_voice', conversationId: session.conversationId });
    res.json({ transcript: transcript.text, transcriptStatus: 'available', provider: 'mistral', model: transcript.model, language: transcript.language, conversationId: turn.conversationId, artifact, turn });
  } catch (error: any) {
    const code = error?.code || 'MISTRAL_REQUEST_FAILED';
    if (artifact) artifact = (await setArtifactTranscript(phone, artifact.id, undefined, 'failed').catch(() => artifact)) || artifact;
    const status = code === 'MISTRAL_NOT_CONFIGURED' || code.startsWith('DRIVE_') || code.startsWith('ARTIFACT_') ? 503 : 502;
    console.warn('[Voice] transcription_failed', { code, guest: isGuest, artifactId: artifact?.id, durability: artifact?.durability });
    res.status(status).json({ error: 'Server transcription is unavailable right now. The voice artifact was retained only if the returned artifact record confirms it.', code, ...(artifact ? { artifact, transcriptStatus: 'failed' } : {}) });
  }
});

router.post('/tts', optionalAuthenticateUser, sessionRateLimit, async (req: AuthRequest, res) => {
  const { isGuest } = identity(req, res);
  const text = String(req.body?.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (isGuest) return res.status(403).json({ error: 'Sign in to use server voice.' });
  try {
    const { mime, data, provider, model } = await synthesizeSpeech(text);
    res.set({ 'Content-Type': mime, 'Content-Length': String(data.length), 'Cache-Control': 'private, max-age=300', 'X-Kurukoo-Tts-Provider': provider, 'X-Kurukoo-Tts-Model': model.slice(0, 120) });
    res.send(data);
  } catch (error: any) {
    const code = String(error?.code || 'TTS_REQUEST_FAILED');
    const unavailable = code === 'MISTRAL_NOT_CONFIGURED' || code === 'MISTRAL_TTS_DISABLED' || code === 'MISTRAL_DISABLED' || code === 'GEMINI_NOT_CONFIGURED';
    console.warn('[Voice] tts_failed', { code, guest: isGuest });
    res.status(unavailable ? 503 : 502).json({ error: unavailable ? 'Text-to-speech is not enabled for this deployment. You can continue by typing.' : 'Text-to-speech is unavailable right now. You can continue by typing.', code });
  }
});

router.post('/transcript', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const { phone } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const role = req.body?.role === 'assistant' ? 'assistant' : req.body?.role === 'user' ? 'user' : null;
  const content = typeof req.body?.content === 'string' ? req.body.content.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 4000) : '';
  const session = getVoiceSession(sessionId, phone);
  if (!session || !role || !content) return res.status(400).json({ error: 'Invalid voice transcript.' });
  try {
    const voiceStatus = getVoiceStatus();
    const message = await appendChatMessage({ phone, sender: role, content, channel: 'web_voice', conversationId: session.conversationId, metadata: { voice: true, provider: voiceStatus.provider, capability: voiceStatus.capability, model: voiceStatus.model, session_id: sessionId } });
    res.json({ messageId: message.id, conversationId: message.conversationId });
  } catch {
    res.status(500).json({ error: 'Transcript could not be saved.' });
  }
});

router.post('/end', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const { phone } = identity(req, res);
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 60) : 'client_disconnect';
  res.json({ ended: endVoiceSession(sessionId, phone, reason) });
});

export default router;
