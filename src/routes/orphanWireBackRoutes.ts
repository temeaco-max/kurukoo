import { Router } from 'express';
import { authenticateUser, optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getProfile } from '../services/memoryProfile.js';
import { getDailyPick } from '../services/dailyPicks.js';
import { getQuickReplies } from '../services/quickRepliesService.js';
import { triggerDailyEngagementCheck } from '../services/engagementScheduler.js';
import { getSurveyPrompt, submitSurveyResponse } from '../services/surveyEngine.js';
import { getSmartEngagementPrompt } from '../services/engagementPrompts.js';
import { requestArtistVerification, approveArtistVerification, bookArtist, confirmArtistBooking, releaseArtistEscrow } from '../services/artistBookingService.js';

const router = Router();

// ── Daily Picks ──────────────────────────────────────────────────────────────
router.get('/daily-picks', optionalAuthenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  try {
    const pick = await getDailyPick(phone || undefined);
    res.json({ success: true, pick });
  } catch (error) {
    console.error('[DailyPicks] fetch failed:', error);
    res.status(500).json({ error: 'Unable to fetch daily pick' });
  }
});

// ── Quick Replies ────────────────────────────────────────────────────────────
router.get('/quick-replies', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  try {
    const replies = await getQuickReplies(phone);
    res.json({ success: true, quickReplies: replies });
  } catch (error) {
    console.error('[QuickReplies] fetch failed:', error);
    res.status(500).json({ error: 'Unable to fetch quick replies' });
  }
});

// ── Survey ────────────────────────────────────────────────────────────────────
router.get('/survey-prompt', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  try {
    const profile = await getProfile(phone, 'survey');
    const topic = (profile?.preferences as any)?.last_survey_topic || 'Phone Accessories';
    const prompt = getSurveyPrompt(topic);
    res.json({ success: true, prompt, topic });
  } catch (error) {
    console.error('[Survey] fetch failed:', error);
    res.status(500).json({ error: 'Unable to fetch survey prompt' });
  }
});

router.post('/survey-response', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  const { question, answer } = req.body || {};
  if (!question || !answer) return res.status(400).json({ error: 'question and answer are required' });
  try {
    const result = await submitSurveyResponse(phone, question, answer);
    res.json({ success: true, result });
  } catch (error) {
    console.error('[Survey] response failed:', error);
    res.status(500).json({ error: 'Unable to submit survey response' });
  }
});

// ── Artist Booking ────────────────────────────────────────────────────────────
router.post('/artist/request-verification', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  const { skill, managerName, managerContact } = req.body || {};
  if (!skill || !managerName || !managerContact) return res.status(400).json({ error: 'skill, managerName, and managerContact are required' });
  try {
    await requestArtistVerification(phone, skill, managerName, managerContact);
    res.json({ success: true, message: 'Artist verification request submitted' });
  } catch (error) {
    console.error('[ArtistBooking] request verification failed:', error);
    res.status(500).json({ error: 'Unable to request artist verification' });
  }
});

router.post('/artist/book', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  const request = req.body || {};
  try {
    const result = await bookArtist(phone, request);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('[ArtistBooking] book failed:', error);
    res.status(500).json({ error: 'Unable to book artist' });
  }
});

router.post('/artist/confirm-booking', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ error: 'requestId is required' });
  try {
    const result = await confirmArtistBooking(phone, requestId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('[ArtistBooking] confirm failed:', error);
    res.status(500).json({ error: 'Unable to confirm artist booking' });
  }
});

router.post('/artist/release-escrow', authenticateUser, async (req: AuthRequest, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: 'Authenticated phone required' });
  const { escrowId, bypassCoolingOff } = req.body || {};
  if (!escrowId) return res.status(400).json({ error: 'escrowId is required' });
  try {
    const result = await releaseArtistEscrow(Number(escrowId), bypassCoolingOff || false);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('[ArtistBooking] release escrow failed:', error);
    res.status(500).json({ error: 'Unable to release artist escrow' });
  }
});

export default router;