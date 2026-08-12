/**
 * Admin boundary — ChatGPT security audit extraction from index.ts.
 *
 * Rules:
 * - All routes except POST /auth require authenticateAdmin.
 * - No client-trusted identity; admin acts on platform data only.
 * - Reuses existing services (aiAgentService, pricingService, commissionService,
 *   analytics, content, disputes, etc.). No parallel admin DB.
 *
 * SEO admin (/api/admin/seo/*) stays in index.ts for a follow-up extraction batch.
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateAdmin, AuthRequest } from '../middleware/auth.js';
import { getDb, saveDb, getSystemSetting, setSystemSetting } from '../database.js';
import { getCategoryTrends, getGeographicDensity, getMarketIntelData } from '../services/analyticsEngine.js';
import {
  getAllAIAgents,
  getAIAgentById,
  createAIAgent,
  updateAIAgent,
  deleteAIAgent,
  cloneAIAgent,
  executeAgentTask,
} from '../services/aiAgentService.js';
import { getAllCommissions, updateCommission } from '../services/commissionService.js';
import { getAllPricing, updatePlan, createPlan, deletePlan } from '../services/pricingService.js';
import { schedulePost } from '../services/socialScheduler.js';
import { queryGroq } from '../services/groqService.js';
import { isProviderEntityType } from '../services/providerEntity.js';

const router = Router();

// ── Auth (public within /api/admin) ─────────────────────────────────────

router.post('/auth', (req, res) => {
  const { username, password } = req.body || {};
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(503).json({ success: false, error: 'Admin authentication is not configured' });
  }
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    return res.status(503).json({ success: false, error: 'JWT authentication is not configured' });
  }

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// ── Platform Stats / Observability ──────────────────────────────────────

router.get('/stats', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    let economicRequests = {};
    let reminders = {};
    let checkIns = {};
    let notificationsCount = 0;
    try {
      const reqRes = db.exec("SELECT status, COUNT(*) as cnt FROM economic_requests GROUP BY status");
      const reqRows = reqRes[0]?.values || [];
      const reqObj: Record<string, number> = {};
      for (const row of reqRows) reqObj[String(row[0])] = Number(row[1]);
      economicRequests = reqObj;
    } catch {}
    try {
      const remRes = db.exec("SELECT status, COUNT(*) as cnt FROM reminders GROUP BY status");
      const remRows = remRes[0]?.values || [];
      const remObj: Record<string, number> = {};
      for (const row of remRows) remObj[String(row[0])] = Number(row[1]);
      reminders = remObj;
    } catch {}
    try {
      const safeRes = db.exec("SELECT status, COUNT(*) as cnt FROM safety_checkins GROUP BY status");
      const safeRows = safeRes[0]?.values || [];
      const safeObj: Record<string, number> = {};
      for (const row of safeRows) safeObj[String(row[0])] = Number(row[1]);
      checkIns = safeObj;
    } catch {}
    try {
      const notifRes = db.exec("SELECT COUNT(*) FROM internal_notifications WHERE status = 'unread'");
      notificationsCount = Number(notifRes[0]?.values[0]?.[0] || 0);
    } catch {}

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      economic_requests: economicRequests,
      reminders,
      check_ins: checkIns,
      unread_internal_notifications: notificationsCount,
    });
  } catch (error) {
    console.error('[AdminStats] failed:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve platform stats' });
  }
});

// ── Tickets / disputes ──────────────────────────────────────────────────

router.get('/tickets', authenticateAdmin, async (req: AuthRequest, res) => {
  const type = (req.query.type as string) || 'dispute';
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM disputes WHERE type = ? ORDER BY id DESC`);
    stmt.bind([type]);
    const tickets: any[] = [];
    while (stmt.step()) tickets.push(stmt.getAsObject());
    stmt.free();
    res.json(tickets);
  } catch (e) {
    console.error('Error fetching admin tickets:', e);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.post('/tickets/reply', authenticateAdmin, async (req: AuthRequest, res) => {
  const { disputeId, replyMessage } = req.body || {};
  if (!disputeId || !replyMessage) {
    return res.status(400).json({ error: 'Missing disputeId or replyMessage' });
  }
  try {
    const db = await getDb();
    const disputeStmt = db.prepare(`SELECT * FROM disputes WHERE id = ?`);
    disputeStmt.bind([parseInt(String(disputeId), 10)]);
    let dispute: any = null;
    if (disputeStmt.step()) dispute = disputeStmt.getAsObject();
    disputeStmt.free();

    if (!dispute) return res.status(404).json({ error: 'Ticket/Dispute not found' });

    db.run(`UPDATE disputes SET status = 'resolved', resolution = ? WHERE id = ?`, [
      replyMessage,
      parseInt(String(disputeId), 10),
    ]);

    const adminMsg = `[Admin Support Reply] Regarding Ticket #${disputeId}: ${replyMessage}`;
    db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [
      dispute.phone,
      adminMsg,
    ]);

    saveDb();
    res.json({ success: true, message: 'Ticket resolved and reply sent' });
  } catch (e) {
    console.error('Error replying to admin ticket:', e);
    res.status(500).json({ error: 'Failed to reply and resolve ticket' });
  }
});

router.post('/disputes/resolve', authenticateAdmin, async (req: AuthRequest, res) => {
  const { disputeId, action } = req.body || {};
  if (!disputeId || !action) {
    return res.status(400).json({ error: 'Missing disputeId or action' });
  }
  if (!['release', 'refund'].includes(String(action))) {
    return res.status(400).json({ error: 'Invalid dispute resolution action' });
  }
  try {
    const db = await getDb();
    const disputeStmt = db.prepare(`SELECT * FROM disputes WHERE id = ?`);
    disputeStmt.bind([parseInt(String(disputeId), 10)]);
    let dispute: any = null;
    if (disputeStmt.step()) dispute = disputeStmt.getAsObject();
    disputeStmt.free();

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    let escrowUpdated = false;
    if (dispute.order_id) {
      const orderStmt = db.prepare(`SELECT * FROM orders WHERE id = ?`);
      orderStmt.bind([dispute.order_id]);
      let order: any = null;
      if (orderStmt.step()) order = orderStmt.getAsObject();
      orderStmt.free();

      if (order) {
        const escrowStmt = db.prepare(
          `SELECT id FROM escrow WHERE buyer_phone = ? AND provider_phone = ? AND status IN ('held', 'disputed') LIMIT 1`
        );
        escrowStmt.bind([order.phone, order.provider_phone]);
        let escrowId: number | null = null;
        if (escrowStmt.step()) escrowId = escrowStmt.getAsObject().id as number;
        escrowStmt.free();

        if (escrowId) {
          if (action === 'release') {
            db.run(`UPDATE escrow SET status = 'released' WHERE id = ?`, [escrowId]);
            db.run(`UPDATE orders SET status = 'completed' WHERE id = ?`, [dispute.order_id]);
          } else {
            db.run(`UPDATE escrow SET status = 'refunded' WHERE id = ?`, [escrowId]);
            db.run(`UPDATE orders SET status = 'refunded' WHERE id = ?`, [dispute.order_id]);
          }
          escrowUpdated = true;
        }
      }
    }

    const resolutionText = `Admin resolved via escrow ${action === 'release' ? 'release' : 'refund'}.`;
    db.run(`UPDATE disputes SET status = 'resolved', resolution = ? WHERE id = ?`, [
      resolutionText,
      parseInt(String(disputeId), 10),
    ]);

    const adminMsg = `[Admin Dispute Resolution] Your dispute #${disputeId} regarding Order #${dispute.order_id || 'N/A'} has been resolved. The held escrow fund was ${action === 'release' ? 'released to the provider' : 'refunded back to your wallet'}.`;
    db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [
      dispute.phone,
      adminMsg,
    ]);

    saveDb();
    res.json({ success: true, message: 'Dispute resolved successfully', escrowUpdated });
  } catch (e) {
    console.error('Error resolving admin dispute:', e);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

router.post('/disputes/escalate', authenticateAdmin, async (req: AuthRequest, res) => {
  const { disputeId } = req.body || {};
  if (!disputeId) return res.status(400).json({ error: 'Missing disputeId' });
  try {
    const db = await getDb();
    const disputeStmt = db.prepare(`SELECT * FROM disputes WHERE id = ?`);
    disputeStmt.bind([parseInt(String(disputeId), 10)]);
    let dispute: any = null;
    if (disputeStmt.step()) dispute = disputeStmt.getAsObject();
    disputeStmt.free();

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    db.run(`UPDATE disputes SET status = 'escalated' WHERE id = ?`, [parseInt(String(disputeId), 10)]);

    const adminMsg = `[Admin Dispute Escalation] Your dispute #${disputeId} has been escalated for secondary review. Our escrow agents will contact you shortly if additional verification is needed.`;
    db.run(`INSERT INTO messages (phone, sender, content, channel) VALUES (?, 'assistant', ?, 'pwa')`, [
      dispute.phone,
      adminMsg,
    ]);

    saveDb();
    res.json({ success: true, message: 'Dispute escalated to admin review' });
  } catch (e) {
    console.error('Error escalating admin dispute:', e);
    res.status(500).json({ error: 'Failed to escalate dispute' });
  }
});

// ── Stats / analytics ───────────────────────────────────────────────────

router.get('/stats', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const uRes = db.exec(`SELECT COUNT(*) FROM memory_profiles`);
    const pRes = db.exec(`SELECT COUNT(*) FROM memory_profiles WHERE is_available = 1`);
    const mRes = db.exec(`SELECT COUNT(*) FROM messages`);
    const cRes = db.exec(`SELECT COUNT(*) FROM credit_transactions`);

    res.json({
      users: uRes[0]?.values[0][0] || 0,
      providers: pRes[0]?.values[0][0] || 0,
      messages: mRes[0]?.values[0][0] || 0,
      credits: cRes[0]?.values[0][0] || 0,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/analytics/trends', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const trends = await getCategoryTrends();
    const density = await getGeographicDensity();
    res.json({ trends, density });
  } catch (err) {
    console.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

router.get('/analytics/sales', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const intel = await getMarketIntelData();
    res.json(intel);
  } catch (err) {
    console.error('Error fetching market intel:', err);
    res.status(500).json({ error: 'Failed to fetch market intelligence data' });
  }
});

// ── Users ───────────────────────────────────────────────────────────────

router.get('/users', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const search = (req.query.search as string || '').trim();
    const tier = (req.query.tier as string || '').trim();
    const verified = (req.query.verified as string || '').trim();
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const page = parseInt((req.query.page as string) || '1', 10);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (phone LIKE ? OR name LIKE ? OR location LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    if (tier) {
      whereClause += ' AND subscription_tier = ?';
      params.push(tier);
    }
    if (verified) {
      whereClause += ' AND verified_provider = ?';
      params.push(parseInt(verified, 10));
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM memory_profiles ${whereClause}`);
    countStmt.bind(params);
    let totalCount = 0;
    if (countStmt.step()) totalCount = countStmt.getAsObject().count as number;
    countStmt.free();

    const selectParams = [...params, limit, offset];
    const selectStmt = db.prepare(`
            SELECT phone, name, location, country, subscription_tier, wallet_balance_minor, points_balance, verified_provider, provider_type, is_available, is_contributor, fcm_token
            FROM memory_profiles
            ${whereClause}
            ORDER BY phone DESC
            LIMIT ? OFFSET ?
        `);
    selectStmt.bind(selectParams);
    const users: any[] = [];
    while (selectStmt.step()) users.push(selectStmt.getAsObject());
    selectStmt.free();

    res.json({
      users,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users/bulk-update', authenticateAdmin, async (req: AuthRequest, res) => {
  const { phones, action, value } = req.body || {};
  if (!phones || !Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'No user phones specified for bulk action' });
  }
  if (!action) return res.status(400).json({ error: 'Action is required' });

  try {
    const db = await getDb();
    const placeholders = phones.map(() => '?').join(',');

    let query = '';
    let updateVal: any = value;

    if (action === 'subscription_tier') {
      query = `UPDATE memory_profiles SET subscription_tier = ? WHERE phone IN (${placeholders})`;
    } else if (action === 'verified_provider') {
      query = `UPDATE memory_profiles SET verified_provider = ? WHERE phone IN (${placeholders})`;
      updateVal = parseInt(String(value), 10) ? 1 : 0;
    } else if (action === 'is_available') {
      query = `UPDATE memory_profiles SET is_available = ? WHERE phone IN (${placeholders})`;
      updateVal = parseInt(String(value), 10) ? 1 : 0;
    } else if (action === 'provider_type') {
      if (!isProviderEntityType(value)) {
        return res.status(400).json({ error: 'Invalid provider type specified' });
      }
      query = `UPDATE memory_profiles SET provider_type = ? WHERE phone IN (${placeholders})`;
      updateVal = value;
    } else if (action === 'add_points') {
      const pointsToAdd = parseInt(String(value), 10) || 0;
      query = `UPDATE memory_profiles SET points_balance = points_balance + ? WHERE phone IN (${placeholders})`;
      updateVal = pointsToAdd;
    } else if (action === 'delete') {
      query = `DELETE FROM memory_profiles WHERE phone IN (${placeholders})`;
    } else {
      return res.status(400).json({ error: 'Invalid bulk action specified' });
    }

    const runParams = action === 'delete' ? [...phones] : [updateVal, ...phones];
    db.run(query, runParams);
    saveDb();

    res.json({
      success: true,
      message: `Successfully executed bulk action '${action}' for ${phones.length} users.`,
    });
  } catch (err) {
    console.error('Error executing bulk action:', err);
    res.status(500).json({ error: 'Failed to execute bulk action' });
  }
});

router.post('/verify_provider', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const db = await getDb();
    const stmt = db.prepare('SELECT nin FROM memory_profiles WHERE phone = ?');
    stmt.bind([phone]);
    let nin = null;
    if (stmt.step()) nin = stmt.getAsObject().nin;
    stmt.free();

    const stmt2 = db.prepare(
      'SELECT AVG(rating) as avg_rating, SUM(jobs_completed) as jobs_done FROM skills WHERE phone = ?'
    );
    stmt2.bind([phone]);
    let jobsDone = 0;
    let avgRating = 0;
    if (stmt2.step()) {
      const row = stmt2.getAsObject();
      jobsDone = (row.jobs_done as number) || 0;
      avgRating = (row.avg_rating as number) || 0;
    }
    stmt2.free();

    if (nin && jobsDone >= 5 && avgRating >= 4.0) {
      db.run('UPDATE memory_profiles SET verified_provider = 1 WHERE phone = ?', [phone]);
      saveDb();
      res.json({ success: true, message: 'Provider verified successfully.' });
    } else {
      res.json({
        success: false,
        message: 'Does not meet criteria (Needs NIN, 5+ jobs, 4.0+ rating)',
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to verify provider' });
  }
});

// ── Skill flows / pulse ─────────────────────────────────────────────────

router.get('/skill-flows', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM skill_flows`);
    const skillFlows: any[] = [];
    while (stmt.step()) skillFlows.push(stmt.getAsObject());
    stmt.free();
    res.json(skillFlows);
  } catch (err) {
    console.error('Error fetching skill flows:', err);
    res.status(500).json({ error: 'Failed to fetch skill flows' });
  }
});

router.post('/skill-flows', authenticateAdmin, async (req: AuthRequest, res) => {
  const { skill, question_set, post_match_action, payment_model, fulfillment_instructions } =
    req.body || {};
  if (!skill) return res.status(400).json({ error: 'skill is required' });
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO skill_flows (skill, question_set, post_match_action, payment_model, fulfillment_instructions)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(skill) DO UPDATE SET
             question_set=excluded.question_set,
             post_match_action=excluded.post_match_action,
             payment_model=excluded.payment_model,
             fulfillment_instructions=excluded.fulfillment_instructions`,
      [skill, question_set, post_match_action, payment_model, fulfillment_instructions]
    );
    saveDb();
    res.json({ success: true, message: 'Skill flow saved successfully' });
  } catch (err) {
    console.error('Error saving skill flow:', err);
    res.status(500).json({ error: 'Failed to save skill flow' });
  }
});

router.delete('/skill-flows/:skill', authenticateAdmin, async (req: AuthRequest, res) => {
  const { skill } = req.params;
  try {
    const db = await getDb();
    db.run(`DELETE FROM skill_flows WHERE skill = ?`, [skill]);
    saveDb();
    res.json({ success: true, message: 'Skill flow deleted successfully' });
  } catch (err) {
    console.error('Error deleting skill flow:', err);
    res.status(500).json({ error: 'Failed to delete skill flow' });
  }
});

router.get('/pulse-sessions', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(`
            SELECT ps.*, mp.name, mp.location
            FROM pulse_sessions ps
            JOIN memory_profiles mp ON ps.phone = mp.phone
            WHERE ps.active = 1 AND ps.expires_at > datetime('now')
        `);
    const sessions: any[] = [];
    while (stmt.step()) sessions.push(stmt.getAsObject());
    stmt.free();
    res.json(sessions);
  } catch (err) {
    console.error('Error fetching pulse sessions:', err);
    res.status(500).json({ error: 'Failed to fetch pulse sessions' });
  }
});

// ── Artists / referrals / revenue / marketing / social / partnerships ───

router.get('/artists', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(
      `SELECT phone, skill, verified_artist FROM skills WHERE skill LIKE '%artist%' OR skill LIKE '%performer%' OR skill LIKE '%musician%'`
    );
    const artists: any[] = [];
    while (stmt.step()) artists.push(stmt.getAsObject());
    stmt.free();
    res.json(artists);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

router.post('/artists/verify', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { phone, skill, verified_artist } = req.body || {};
    const db = await getDb();
    db.run(`UPDATE skills SET verified_artist = ? WHERE phone = ? AND skill = ?`, [
      verified_artist,
      phone,
      skill,
    ]);
    saveDb();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update artist verification' });
  }
});

router.get('/referrals', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmtAll = db.prepare(`SELECT * FROM referrals ORDER BY created_at DESC`);
    const referrals: any[] = [];
    while (stmtAll.step()) referrals.push(stmtAll.getAsObject());
    stmtAll.free();

    const stmtTop = db.prepare(`
            SELECT referrer_phone, COUNT(*) as total, SUM(CASE WHEN status = 'subscribed' THEN 1 ELSE 0 END) as successful
            FROM referrals
            GROUP BY referrer_phone
            ORDER BY successful DESC, total DESC
            LIMIT 10
        `);
    const topReferrers: any[] = [];
    while (stmtTop.step()) topReferrers.push(stmtTop.getAsObject());
    stmtTop.free();

    res.json({ referrals, topReferrers });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch admin referrals' });
  }
});

router.get('/revenue', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    let subRev = 0;
    let leadFees = 0;
    let adRev = 0;
    let affClicks = 0;

    const stmtSubs = db.prepare(
      `SELECT subscription_tier, COUNT(*) as count FROM memory_profiles GROUP BY subscription_tier`
    );
    while (stmtSubs.step()) {
      const row = stmtSubs.getAsObject();
      const count = row.count as number;
      const tier = String(row.subscription_tier || '').toLowerCase();
      if (tier === 'base') subRev += count * 500;
      if (tier === 'plus') subRev += count * 1500;
      if (tier === 'business') subRev += count * 5000;
    }
    stmtSubs.free();

    const stmtLeads = db.prepare(
      `SELECT SUM(amount) as total FROM credit_transactions WHERE type = 'lead_fee'`
    );
    if (stmtLeads.step()) leadFees = (stmtLeads.getAsObject().total as number) || 0;
    stmtLeads.free();

    const stmtAds = db.prepare(`SELECT SUM(credits_spent) as total FROM ad_campaigns`);
    if (stmtAds.step()) adRev = (stmtAds.getAsObject().total as number) || 0;
    stmtAds.free();

    const stmtAff = db.prepare(`SELECT COUNT(*) as total FROM affiliate_clicks`);
    if (stmtAff.step()) affClicks = (stmtAff.getAsObject().total as number) || 0;
    stmtAff.free();

    res.json({
      subscriptions: subRev,
      lead_fees: leadFees,
      ad_revenue: adRev,
      affiliate_clicks: affClicks,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch revenue stats' });
  }
});

router.get('/marketing', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM referrals');
    let total = 0;
    if (stmt.step()) total = stmt.getAsObject().count as number;
    stmt.free();
    res.json({ total_referrals: total, ad_impressions: 5024, ad_clicks: 342 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch marketing stats' });
  }
});

router.get('/social', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM social_posts');
    const posts: any[] = [];
    while (stmt.step()) posts.push(stmt.getAsObject());
    stmt.free();
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch social posts' });
  }
});

router.post('/social', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { platform, content, scheduled_time } = req.body || {};
    await schedulePost(platform, content, scheduled_time);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to schedule post' });
  }
});

router.get('/partnerships', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM partnerships');
    const list: any[] = [];
    while (stmt.step()) list.push(stmt.getAsObject());
    stmt.free();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch partnerships' });
  }
});

router.get('/scam_reports', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM scam_reports');
    const reports: any[] = [];
    while (stmt.step()) reports.push(stmt.getAsObject());
    stmt.free();
    res.json(reports);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scam reports' });
  }
});

// ── Content ─────────────────────────────────────────────────────────────

router.get('/content', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(
      `SELECT slug, title, type, author, updated_at FROM content ORDER BY updated_at DESC`
    );
    const content: any[] = [];
    while (stmt.step()) content.push(stmt.getAsObject());
    stmt.free();
    res.json(content);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.get('/content/:slug', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { slug } = req.params;
    const db = await getDb();
    const stmt = db.prepare(`SELECT * FROM content WHERE slug = ?`);
    stmt.bind([slug]);
    let item = null;
    if (stmt.step()) item = stmt.getAsObject();
    stmt.free();
    if (item) res.json(item);
    else res.status(404).json({ error: 'Content not found' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.post('/content', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { slug, title, body, type, author } = req.body || {};
    const db = await getDb();
    const stmt = db.prepare(`SELECT slug FROM content WHERE slug = ?`);
    stmt.bind([slug]);
    const exists = stmt.step();
    stmt.free();

    if (exists) {
      db.run(
        `UPDATE content SET title = ?, body = ?, type = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`,
        [title, body, type, author, slug]
      );
    } else {
      db.run(`INSERT INTO content (slug, title, body, type, author) VALUES (?, ?, ?, ?, ?)`, [
        slug,
        title,
        body,
        type,
        author,
      ]);
    }
    saveDb();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save content' });
  }
});

router.post('/content/generate', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { topic } = req.body || {};
    const prompt = `Write a short, professional blog post (about 250 words) on the topic: "${topic}". The post should be suitable for the Kurukoo Everyday Utility platform blog. Use HTML formatting.`;
    const generatedBody = await queryGroq(prompt);
    res.json({ success: true, generatedBody });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

router.get('/future_plans', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM future_plans');
    const plans: any[] = [];
    while (stmt.step()) plans.push(stmt.getAsObject());
    stmt.free();
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch future plans' });
  }
});

// ── Settings ────────────────────────────────────────────────────────────

router.get('/settings', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const useGroqRouting = await getSystemSetting('use_groq_routing', 'false');
    res.json({ use_groq_routing: useGroqRouting === 'true' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/settings', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { use_groq_routing } = req.body || {};
    await setSystemSetting('use_groq_routing', use_groq_routing ? 'true' : 'false');
    res.json({ success: true, use_groq_routing: !!use_groq_routing });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── AI agents ───────────────────────────────────────────────────────────

router.get('/ai-agents', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const agents = await getAllAIAgents();
    res.json(agents);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch AI agents' });
  }
});

router.get('/ai-agents/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const agent = await getAIAgentById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch AI agent' });
  }
});

router.post('/ai-agents', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await createAIAgent(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create AI agent' });
  }
});

router.put('/ai-agents/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await updateAIAgent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update AI agent' });
  }
});

router.delete('/ai-agents/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await deleteAIAgent(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete AI agent' });
  }
});

router.post('/ai-agents/:id/clone', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { newId, newName } = req.body || {};
    const cloned = await cloneAIAgent(req.params.id, newId, newName);
    if (!cloned) return res.status(404).json({ error: 'Source agent not found' });
    res.json({ success: true, agent: cloned });
  } catch (e) {
    res.status(500).json({ error: 'Failed to clone AI agent' });
  }
});

router.post('/ai-agents/:id/execute', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { taskInput } = req.body || {};
    const result = await executeAgentTask(req.params.id, taskInput || 'Simulated task execution');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to execute agent task' });
  }
});

// ── Commissions (pricing admin lives under pricingRoutes) ───────────────

// ── Pricing ──────────────────────────────────────────────────────────────
router.get('/pricing', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const plans = await getAllPricing();
    res.json(plans);
  } catch (e) {
    console.error('Error fetching admin pricing:', e);
    res.status(500).json({ error: 'Failed to fetch admin pricing' });
  }
});
router.put('/pricing/:country/:plan', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { country, plan } = req.params;
    const success = await updatePlan(country, plan, req.body || {});
    res.json({ success });
  } catch (e) {
    console.error('Error updating pricing plan:', e);
    res.status(500).json({ error: 'Failed to update pricing plan' });
  }
});
router.post('/pricing', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const success = await createPlan(req.body || {});
    res.json({ success });
  } catch (e) {
    console.error('Error creating pricing plan:', e);
    res.status(500).json({ error: 'Failed to create pricing plan' });
  }
});
router.delete('/pricing/:country/:plan', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { country, plan } = req.params;
    const success = await deletePlan(country, plan);
    res.json({ success });
  } catch (e) {
    console.error('Error deleting pricing plan:', e);
    res.status(500).json({ error: 'Failed to delete pricing plan' });
  }
});

// ── Commissions ─────────────────────────────────────────────────────────
router.get('/commissions', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const list = await getAllCommissions();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

router.put('/commissions/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rate_minor, active } = req.body || {};
    const success = await updateCommission(id, rate_minor, active !== undefined ? active : 1);
    res.json({ success });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update commission' });
  }
});



export default router;
