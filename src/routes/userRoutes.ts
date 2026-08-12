import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb } from '../database.js';
import { exportUserData, deleteUserData } from '../services/dataRetention.js';
import { getProfile } from '../services/memoryProfile.js';
import { generateReferralCode, trackReferral } from '../services/referralService.js';
import { buildQrEntryUrl, parseQrContext } from '../services/qrContextService.js';
import { submitRating } from '../services/ratingService.js';

const router = Router();

function sessionPhone(req: AuthRequest): string | null { return req.user?.phone ? String(req.user.phone) : null; }

router.get('/profile', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ error: 'Forbidden: You can only view your own profile' });
  const db = await getDb(); const stmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`); stmt.bind([phone]); let profile: any = null;
  if (stmt.step()) profile = stmt.getAsObject(); else {
    db.run(`INSERT INTO memory_profiles (phone, name, location, country, subscription_tier, wallet_balance_minor) VALUES (?, 'New User', 'Ibadan', 'ng', 'Base', 30)`, [phone]); saveDb();
    const newStmt = db.prepare(`SELECT * FROM memory_profiles WHERE phone = ?`); newStmt.bind([phone]); if (newStmt.step()) profile = newStmt.getAsObject(); newStmt.free();
  }
  stmt.free(); const skillsStmt = db.prepare(`SELECT * FROM skills WHERE phone = ?`); skillsStmt.bind([phone]); const skills: any[] = []; while (skillsStmt.step()) skills.push(skillsStmt.getAsObject()); skillsStmt.free();
  res.json({ profile, skills });
});

router.post('/profile/availability', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden: You can only update your own availability' });
  const db = await getDb(); db.run(`UPDATE memory_profiles SET is_available = ? WHERE phone = ?`, [req.body?.is_available ? 1 : 0, phone]); saveDb(); res.json({ success: true });
});

router.post('/profile/update', authenticateUser, async (req: AuthRequest, res) => {
  const phone = sessionPhone(req); if (!phone) return res.status(401).json({ error: 'Authentication required' });
  if (req.body?.phone && req.body.phone !== phone) return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
  const { name, location, country, skills, operation_mode, hourly_rate, service_radius_km, transport_mode, pricing_model, payment_method, equipment, is_available } = req.body || {};
  try {
    const db = await getDb(); const stmt = db.prepare(`SELECT phone FROM memory_profiles WHERE phone = ?`); stmt.bind([phone]); const exists = stmt.step(); stmt.free();
    if (!exists) db.run(`INSERT INTO memory_profiles (phone, name, location, country, subscription_tier) VALUES (?, ?, ?, ?, ?)`, [phone, name || 'New User', location || 'Ibadan', country || 'ng', 'Base']);
    else db.run(`UPDATE memory_profiles SET name = COALESCE(?, name), location = COALESCE(?, location), country = COALESCE(?, country) WHERE phone = ?`, [name || null, location || null, country || null, phone]);
    if (typeof is_available !== 'undefined') db.run(`UPDATE memory_profiles SET is_available = ? WHERE phone = ?`, [is_available ? 1 : 0, phone]);
    if (skills) {
      const skillList = Array.isArray(skills) ? skills : String(skills).split(',').map((s: string) => s.trim()).filter((s: string) => s);
      for (const sk of skillList) {
        const sStmt = db.prepare(`SELECT id FROM skills WHERE phone = ? AND skill = ?`); sStmt.bind([phone, sk]); const skillExists = sStmt.step(); sStmt.free(); const equipJson = typeof equipment === 'object' ? JSON.stringify(equipment) : equipment || '{}';
        if (!skillExists) db.run(`INSERT INTO skills (phone, skill, operation_mode, hourly_rate, service_radius_km, transport_mode, pricing_model, payment_method, equipment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [phone, sk, operation_mode || 'stationary', hourly_rate || 0, service_radius_km || 10, transport_mode || 'none', pricing_model || 'hourly', payment_method || 'cash', equipJson]);
        else db.run(`UPDATE skills SET operation_mode = ?, hourly_rate = ?, service_radius_km = ?, transport_mode = ?, pricing_model = ?, payment_method = ?, equipment = ? WHERE phone = ? AND skill = ?`, [operation_mode || 'stationary', hourly_rate || 0, service_radius_km || 10, transport_mode || 'none', pricing_model || 'hourly', payment_method || 'cash', equipJson, phone, sk]);
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

export default router;
