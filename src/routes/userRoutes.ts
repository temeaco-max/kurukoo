import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import { exportUserData, deleteUserData } from '../services/dataRetention.js';
import { getProfile, updateProfile } from '../services/memoryProfile.js';
import { generateReferralCode, trackReferral } from '../services/referralService.js';
import { buildQrEntryUrl, parseQrContext } from '../services/qrContextService.js';
import { submitRating } from '../services/ratingService.js';
import { approveTrustChallenge, createTrustChallenge, denyTrustChallenge, getPendingTrustChallenges, getProgressiveTrust, getTrustedDeviceStatus, listTrustedDevices, recordChannelEvidence, recordLocationConsent, registerTrustedDevice, revokeTrustedDevice } from '../services/progressiveTrustService.js';
import { sendFcmPush } from '../services/pushNotifications.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }

function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }

export function sanitizeProactiveBriefPreferences(value: unknown): Record<string, unknown> | null {
  const source = asRecord(value); if (!source) return null;
  const patch: Record<string, unknown> = {};
  if (typeof source.voice_enabled === 'boolean') patch.voice_enabled = source.voice_enabled;
  if (source.style === 'concise' || source.style === 'detailed') patch.style = source.style;
  if (source.interruption_sensitivity === 'minimal' || source.interruption_sensitivity === 'standard' || source.interruption_sensitivity === 'interruptive') patch.interruption_sensitivity = source.interruption_sensitivity;
  if (typeof source.allow_critical_interruption === 'boolean') patch.allow_critical_interruption = source.allow_critical_interruption;
  if (Array.isArray(source.notification_categories)) {
    const allowed = new Set(['completed', 'pending', 'attention_required', 'upcoming_task', 'provider_update', 'important_notification', 'safety_event', 'agent_work_in_progress', 'agent_work_completed', 'waiting_for_user']);
    patch.notification_categories = [...new Set(source.notification_categories.filter(item => typeof item === 'string' && allowed.has(item)))];
  }
  const quietHours = asRecord(source.quiet_hours);
  if (quietHours && /^\d{2}:\d{2}$/.test(String(quietHours.start || '')) && /^\d{2}:\d{2}$/.test(String(quietHours.end || ''))) patch.quiet_hours = { start: String(quietHours.start), end: String(quietHours.end), ...(typeof quietHours.timeZone === 'string' ? { timeZone: quietHours.timeZone } : {}) };
  return patch;
}

router.get('/profile', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ error: 'Forbidden: You can only view your own profile' });
  const db = await getDb(); const stmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`); stmt.bind([phone]); let profile: any = null;
  if (stmt.step()) profile = stmt.getAsObject(); else {
    await updateProfile(phone, 'profile_bootstrap', {});
    const newStmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`); newStmt.bind([phone]); if (newStmt.step()) profile = newStmt.getAsObject(); newStmt.free();
  }
  stmt.free(); const skillsStmt = db.prepare(`SELECT * FROM skills WHERE phone = ?`); skillsStmt.bind([phone]); const skills: any[] = []; while (skillsStmt.step()) skills.push(skillsStmt.getAsObject()); skillsStmt.free();
  res.json({ profile, skills, progressiveTrust: await getProgressiveTrust(phone) });
});

router.post('/profile/availability', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden: You can only update your own availability' });
  const db = await getDb();
  const available = req.body?.is_available ? 1 : 0;
  db.run(`UPDATE memory_profiles SET is_available = ? WHERE phone = ?`, [available, phone]);
  db.run(`UPDATE skills SET is_available = ? WHERE phone = ?`, [available, phone]);
  saveDb(); res.json({ success: true });
});

router.post('/profile/update', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
  const { name, location, country, skills, operation_mode, hourly_rate, service_radius_km, transport_mode, pricing_model, payment_method, equipment, is_available, proactive_brief } = req.body || {};
  try {
    const db = await getDb();
    const proactiveBriefPatch = proactive_brief === undefined ? undefined : sanitizeProactiveBriefPreferences(proactive_brief);
    if (proactive_brief !== undefined && !proactiveBriefPatch) return res.status(400).json({ error: 'Invalid proactive brief preferences' });
    const profile = proactiveBriefPatch ? await getProfile(phone, 'profile_update') : null;
    const currentPreferences = asRecord(profile?.preferences) || {};
    const currentBrief = asRecord(currentPreferences.proactive_brief) || {};
    await updateProfile(phone, 'profile_update', {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      location: typeof location === 'string' && location.trim() ? location.trim() : undefined,
      country: typeof country === 'string' && country.trim() ? country.trim() : undefined,
      provenance: 'user_declared',
      source_ref: 'profile_update',
      preferences: proactiveBriefPatch ? { ...currentPreferences, proactive_brief: { ...currentBrief, ...proactiveBriefPatch } } : undefined,
    });
    if (typeof is_available !== 'undefined') {
      const available = is_available ? 1 : 0;
      db.run(`UPDATE memory_profiles SET is_available = ? WHERE phone = ?`, [available, phone]);
      db.run(`UPDATE skills SET is_available = ? WHERE phone = ?`, [available, phone]);
    }
    if (skills) {
      const skillList = Array.isArray(skills) ? skills : String(skills).split(',').map((s: string) => s.trim()).filter((s: string) => s);
      for (const sk of skillList) {
        const sStmt = db.prepare(`SELECT id FROM skills WHERE phone = ? AND skill = ?`); sStmt.bind([phone, sk]); const skillExists = sStmt.step(); sStmt.free(); const equipJson = typeof equipment === 'object' ? JSON.stringify(equipment) : equipment || '{}';
        if (!skillExists) db.run(`INSERT INTO skills (phone, skill, operation_mode, hourly_rate, service_radius_km, transport_mode, pricing_model, payment_method, equipment, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [phone, sk, operation_mode || 'stationary', hourly_rate || 0, service_radius_km || 10, transport_mode || 'none', pricing_model || 'hourly', payment_method || 'cash', equipJson, typeof is_available === 'undefined' ? 0 : (is_available ? 1 : 0)]);
        else db.run(`UPDATE skills SET operation_mode = ?, hourly_rate = ?, service_radius_km = ?, transport_mode = ?, pricing_model = ?, payment_method = ?, equipment = ?, is_available = COALESCE(?, is_available) WHERE phone = ? AND skill = ?`, [operation_mode || 'stationary', hourly_rate || 0, service_radius_km || 10, transport_mode || 'none', pricing_model || 'hourly', payment_method || 'cash', equipJson, typeof is_available === 'undefined' ? null : (is_available ? 1 : 0), phone, sk]);
      }
    }
    saveDb(); res.json({ success: true });
  } catch (err) { console.error('Error updating profile:', err); res.status(500).json({ error: 'Internal server error updating profile' }); }
});

router.post('/profile/skills/add', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); const skill = String(req.body?.skill || '').trim(); if (!skill) return res.status(400).json({ error: 'Missing skill' }); if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden' });
  try { const db = await getDb(); const stmt = db.prepare(`SELECT id FROM skills WHERE phone = ? AND skill = ?`); stmt.bind([phone, skill]); const exists = stmt.step(); stmt.free(); if (!exists) { db.run(`INSERT INTO skills (phone, skill, operation_mode, hourly_rate, service_radius_km, transport_mode, pricing_model, payment_method) VALUES (?, ?, 'stationary', 0, 10, 'none', 'hourly', 'cash')`, [phone, skill]); saveDb(); } res.json({ success: true }); } catch (err) { console.error('Error adding skill:', err); res.status(500).json({ error: 'Internal error adding skill' }); }
});
router.post('/profile/skills/remove', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); const skill = String(req.body?.skill || '').trim(); if (!skill) return res.status(400).json({ error: 'Missing skill' }); if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden' });
  try { const db = await getDb(); db.run(`DELETE FROM skills WHERE phone = ? AND skill = ?`, [phone, skill]); saveDb(); res.json({ success: true }); } catch (err) { console.error('Error removing skill:', err); res.status(500).json({ error: 'Internal error removing skill' }); }
});

router.get('/user/export', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ error: 'Forbidden' }); try { res.json({ success: true, data: await exportUserData(phone) }); } catch (_) { res.status(500).json({ error: 'Failed to export user data' }); } });
router.get('/profile/export', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); try { res.json(await exportUserData(phone)); } catch (err) { console.error(err); res.status(500).json({ error: 'Internal error exporting data' }); } });
router.post('/user/delete', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); try { await deleteUserData(phone); res.json({ success: true }); } catch (_) { res.status(500).json({ error: 'Failed to delete user data' }); } });
router.delete('/profile/delete', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); try { await deleteUserData(phone); res.json({ success: true }); } catch (err) { console.error(err); res.status(500).json({ error: 'Internal error deleting data' }); } });

// ── Referrals + QR ─────────────────────────────────────────────────────
router.post('/referral/code', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); res.json({ success: true, code: await generateReferralCode(phone) }); });

router.get('/referral/qr', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const channel = req.query.channel ? String(req.query.channel) : undefined;
  const code = await generateReferralCode(phone);
  const context = parseQrContext({ context: 'referral', ref: code, source: 'user-referral', ...(channel ? { channel } : {}) });
  if (!context) return res.status(400).json({ error: 'Invalid QR channel context.' });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = buildQrEntryUrl(baseUrl, context);
  res.json({ success: true, context: context.type, referralCode: code, url });
});

router.post('/referral/claim', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); const referral_code = String(req.body?.referral_code || '').trim().toUpperCase(); if (!referral_code) return res.status(400).json({ error: 'Missing referral_code' }); try { const { findReferrerByCode } = await import('../services/referralService.js'); const referrer_phone = await findReferrerByCode(referral_code); if (!referrer_phone) return res.status(400).json({ error: 'Invalid referral code' }); if (referrer_phone === phone) return res.status(400).json({ error: 'You cannot refer yourself' }); await trackReferral(referrer_phone, phone, referral_code); res.json({ success: true, message: 'Referral registered successfully. Reward activates only after the qualifying event.' }); } catch (_) { res.status(500).json({ error: 'Failed to register referral code' }); } });
router.post('/referral/share-reward', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); try { const { awardShareReward } = await import('../services/referralService.js'); res.json({ success: true, rewarded: await awardShareReward(phone) }); } catch (_) { res.status(500).json({ error: 'Failed to award sharing reward' }); } });

/** Public referral resolution intentionally returns only whether a code is valid; it never exposes the referrer's phone number. */
router.post('/referral/resolve', async (req, res) => { const code = String(req.body?.code || '').trim().toUpperCase(); if (!code) return res.status(400).json({ error: 'Missing code' }); try { const { findReferrerByCode } = await import('../services/referralService.js'); const valid = Boolean(await findReferrerByCode(code)); res.json({ success: valid, valid }); } catch (_) { res.status(500).json({ error: 'Failed to resolve referral code' }); } });
router.get('/referral/stats', authenticateUser, async (req: AuthRequest, res) => { const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' }); try { const { getReferralStats } = await import('../services/referralService.js'); res.json({ success: true, stats: await getReferralStats(phone) }); } catch (_) { res.status(500).json({ error: 'Failed to fetch referral stats' }); } });

router.post('/ratings', authenticateUser, async (req: AuthRequest, res) => { const rater = sessionPhone(req); if (!rater) return res.status(401).json({ error: 'Authentication required' }); const { provider_phone, skill, rating } = req.body || {}; if (!provider_phone || !skill || !rating) return res.status(400).json({ error: 'Missing data' }); const r = parseInt(rating, 10); if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be an integer from 1 to 5' }); await submitRating(provider_phone, skill, r); res.json({ success: true }); });

// Progressive trust remains owned by the authenticated user boundary. It never
// changes the canonical phone identity or treats a browser challenge as phone proof.
router.post('/device/register', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const deviceId = String(req.body?.deviceId || req.headers['x-kurukoo-device-id'] || '').trim();
  if (!deviceId) return res.status(400).json({ error: 'Device identifier is required' });
  try { res.json({ success: true, device: await registerTrustedDevice({ phone, deviceId, credentialType: req.body?.credentialType, label: req.body?.label, pushCapable: req.body?.pushCapable === true }) }); }
  catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Device registration failed' }); }
});

router.get('/device/status', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const deviceId = String(req.query.deviceId || req.headers['x-kurukoo-device-id'] || '').trim();
  if (!deviceId) return res.status(400).json({ error: 'Device identifier is required' });
  res.json({ success: true, ...(await getTrustedDeviceStatus(phone, deviceId)) });
});

router.post('/device/challenge', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const targetDeviceId = String(req.body?.targetDeviceId || '').trim();
  if (!targetDeviceId) return res.status(400).json({ error: 'Target device identifier is required' });
  try {
    const challenge = await createTrustChallenge({ phone, targetDeviceId, purpose: req.body?.purpose });
    const pushQueued = !challenge.alreadyTrusted && Boolean(challenge.id) ? await sendFcmPush(phone, 'Approve this Kurukoo device', 'A new device is asking to continue your Kurukoo session. Open Kurukoo to approve or deny it.', '/settings?section=devices') : false;
    res.status(challenge.alreadyTrusted ? 200 : 201).json({ success: true, challenge, pushQueued, pushDelivery: pushQueued ? 'provider_accepted_or_internal_queued' : 'not_available' });
  }
  catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Trust challenge could not be created' }); }
});

router.post('/device/challenge/:id/approve', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const approverDeviceId = String(req.headers['x-kurukoo-device-id'] || '').trim();
  if (!approverDeviceId) return res.status(400).json({ error: 'Approver device identifier is required' });
  const result = await approveTrustChallenge({ phone, challengeId: String(req.params.id), approverDeviceId });
  res.status(result.approved ? 200 : 403).json({ success: result.approved, ...result });
});

router.get('/device/challenges', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  res.json({ success: true, challenges: await getPendingTrustChallenges(phone) });
});

router.get('/devices', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  res.json({ success: true, devices: await listTrustedDevices(phone) });
});

router.post('/devices/:id/revoke', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const result = await revokeTrustedDevice({ phone, deviceRecordId: Number(req.params.id), currentDeviceId: String(req.headers['x-kurukoo-device-id'] || '') });
  res.status(result.revoked ? 200 : 400).json({ success: result.revoked, ...result });
});

router.post('/device/challenge/:id/deny', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const approverDeviceId = String(req.headers['x-kurukoo-device-id'] || '').trim();
  if (!approverDeviceId) return res.status(400).json({ error: 'Approver device identifier is required' });
  const result = await denyTrustChallenge({ phone, challengeId: String(req.params.id), approverDeviceId });
  res.status(result.denied ? 200 : 403).json({ success: result.denied, ...result });
});

router.get('/trust/progressive', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  res.json({ success: true, trust: await getProgressiveTrust(phone) });
});

router.post('/channel-evidence', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const channel = String(req.body?.channel || '').toLowerCase();
  if (!['whatsapp', 'telegram', 'sms', 'email', 'social', 'ivr', 'ussd'].includes(channel)) return res.status(400).json({ error: 'Unsupported channel evidence type' });
  if (!String(req.body?.evidenceType || '').trim()) return res.status(400).json({ error: 'evidenceType is required' });
  await recordChannelEvidence({ phone, channel: channel as any, evidenceType: String(req.body.evidenceType), externalSubject: req.body.externalSubject, sourceRef: req.body.sourceRef, consented: req.body.consented === true });
  res.status(201).json({ success: true, status: 'observed' });
});

router.post('/location/consent', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  const purpose = String(req.body?.purpose || '').trim();
  if (!purpose) return res.status(400).json({ error: 'Location purpose is required' });
  const precision = req.body?.precision === 'precise' ? 'precise' : 'coarse';
  await recordLocationConsent({ phone, purpose, precision, latitude: Number(req.body?.latitude), longitude: Number(req.body?.longitude), area: req.body?.area, expiresAt: req.body?.expiresAt });
  res.status(201).json({ success: true, status: 'granted', precision, purpose });
});

export default router;
