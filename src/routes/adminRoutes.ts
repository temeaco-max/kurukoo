/**
 * Admin boundary — ChatGPT security audit extraction from index.ts.
 *
 * Rules:
 * - All routes except POST /auth require authenticateAdmin.
 * - No client-trusted identity; admin acts on platform data only.
 * - Reuses existing services (aiAgentService, pricingService, commissionService,
 *   analytics, content, disputes, etc.). No parallel admin DB.
 *
 * SEO administration is a separately mounted route owner that reuses seoService.
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
import { ensureProviderVerificationSchema, setProviderVerification } from '../services/providerVerification.js';
import { getPilotDashboard } from '../services/pilotObservability.js';
import { getCommercialMetrics, getMarketingMetrics } from '../services/commercialMetrics.js';
import { getAllContent, getContentBySlug, saveContent, deleteContentBySlug, type ContentItem } from '../services/contentManager.js';
import { getAdminControlPlaneStatus, listAdminFeatureFlags, updateAdminFeatureFlag, updateAdminRuntimeControl } from '../services/adminControlPlane.js';
import { getSeoDashboard } from '../services/seoService.js';
import { createAdCampaign, getAdCampaigns, setAdCampaignStatus, type AdCampaignStatus } from '../services/adManager.js';

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

    const countRows = (table: string, where = ''): number => {
      try {
        const result = db.exec(`SELECT COUNT(*) AS count FROM ${table}${where}`);
        return Number(result[0]?.values[0]?.[0] || 0);
      } catch { return 0; }
    };
    const profiles = countRows('memory_profiles');
    const availableProviders = countRows('memory_profiles', ' WHERE is_available = 1');
    const messages = countRows('messages');
    const pointsLedgerEntries = countRows('credit_transactions');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: { profiles, availableProviders, messages, pointsLedgerEntries },
      // Backward-compatible fields for existing authenticated admin views.
      users: profiles,
      providers: availableProviders,
      messages,
      credits: pointsLedgerEntries,
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

router.get('/dashboard', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const countRows = (table: string, where = ''): number => {
      try {
        const result = db.exec(`SELECT COUNT(*) AS count FROM ${table}${where}`);
        return Number(result[0]?.values[0]?.[0] || 0);
      } catch { return 0; }
    };
    const groupedCounts = (table: string, column: string): Record<string, number> => {
      try {
        const result = db.exec(`SELECT ${column}, COUNT(*) AS count FROM ${table} GROUP BY ${column}`);
        return Object.fromEntries((result[0]?.values || []).map((row: any[]) => [String(row[0]), Number(row[1])])) as Record<string, number>;
      } catch { return {}; }
    };
    const unreadNotifications = countRows('internal_notifications', " WHERE status = 'unread'");
    const skillFlows: any[] = [];
    try {
      const stmt = db.prepare('SELECT * FROM skill_flows');
      while (stmt.step()) skillFlows.push(stmt.getAsObject());
      stmt.free();
    } catch {}
    const presence: any[] = [];
    try {
      const stmt = db.prepare(`SELECT ps.*, mp.name, mp.location FROM pulse_sessions ps JOIN memory_profiles mp ON ps.phone = mp.phone WHERE ps.active = 1 AND ps.expires_at > datetime('now')`);
      while (stmt.step()) presence.push(stmt.getAsObject());
      stmt.free();
    } catch {}
    const [commercial, content, seo] = await Promise.all([getCommercialMetrics(), getAllContent(), getSeoDashboard()]);
    res.json({
      stats: {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          profiles: countRows('memory_profiles'),
          availableProviders: countRows('memory_profiles', ' WHERE is_available = 1'),
          messages: countRows('messages'),
          pointsLedgerEntries: countRows('credit_transactions'),
        },
        economic_requests: groupedCounts('economic_requests', 'status'),
        reminders: groupedCounts('reminders', 'status'),
        check_ins: groupedCounts('safety_checkins', 'status'),
        unread_internal_notifications: unreadNotifications,
      },
      revenue: { metrics: commercial },
      skillFlows,
      presence,
      content: content.map(({ slug, title, type, author, updatedAt, createdAt }) => ({ slug, title, type, author, updated_at: updatedAt || createdAt || null })),
      seo,
    });
  } catch (error) {
    console.error('[AdminDashboard] failed:', error instanceof Error ? error.name : 'unknown');
    res.status(500).json({ error: 'Failed to retrieve dashboard snapshot' });
  }
});

router.get('/pilot-dashboard', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const days = Number(req.query.days || 30);
    const dashboard = await getPilotDashboard(days);
    res.json({ success: true, dashboard, privacy: { aggregate_only: true, raw_feedback: 'omitted', owner_identifiers: 'omitted', raw_conversations: 'omitted', secrets: 'omitted' } });
  } catch (error) {
    console.error('[PilotDashboard] failed:', error instanceof Error ? error.name : 'unknown');
    res.status(500).json({ success: false, error: 'Failed to retrieve pilot dashboard' });
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

router.get('/disputes', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const stmt = db.prepare(`SELECT id, phone, order_id, status, reason, resolution, created_at FROM disputes ORDER BY created_at DESC LIMIT 100`);
    const disputes: any[] = [];
    while (stmt.step()) disputes.push(stmt.getAsObject());
    stmt.free();
    res.json({ success: true, disputes });
  } catch (error) {
    console.error('Error loading admin disputes:', error);
    res.status(500).json({ error: 'Failed to load disputes' });
  }
});

router.get('/communications', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const grouped = (query: string) => {
      try {
        const stmt = db.prepare(query);
        const rows: any[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      } catch { return []; }
    };
    const outbox = grouped(`SELECT dispatch_state AS state, COUNT(*) AS count FROM communication_outbox GROUP BY dispatch_state ORDER BY dispatch_state`);
    const deliveries = grouped(`SELECT channel, state, COUNT(*) AS count FROM communication_deliveries GROUP BY channel, state ORDER BY channel, state`);
    const consents = grouped(`SELECT channel, consent_state AS state, COUNT(*) AS count FROM communication_preferences GROUP BY channel, consent_state ORDER BY channel, consent_state`);
    res.json({
      success: true,
      outbox,
      deliveries,
      consents,
      boundary: 'Counts reflect durable internal records only. Accepted delivery is not external receipt confirmation, and this console cannot send arbitrary messages.',
    });
  } catch (error) {
    console.error('Error loading communication observability:', error);
    res.status(500).json({ error: 'Failed to load communication observability' });
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

    const adminMsg = `[Admin Dispute Escalation] Your dispute #${disputeId} has been escalated for secondary review. Kurukoo will record any further supported update in your request history.`;
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

// ── Analytics ───────────────────────────────────────────────────────────

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
    await ensureProviderVerificationSchema();
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
      const verificationState = verified === '1' ? 'verified' : verified === '0' ? 'unverified' : verified;
      whereClause += " AND COALESCE(v.state, 'unverified') = ?";
      params.push(verificationState);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM memory_profiles LEFT JOIN provider_verifications v ON v.phone=memory_profiles.phone ${whereClause}`);
    countStmt.bind(params);
    let totalCount = 0;
    if (countStmt.step()) totalCount = countStmt.getAsObject().count as number;
    countStmt.free();

    const selectParams = [...params, limit, offset];
    const selectStmt = db.prepare(`
            SELECT memory_profiles.phone, name, location, country, subscription_tier, wallet_balance_minor, points_balance, verified_provider, v.state AS verification_state, provider_type, is_available, is_contributor, fcm_token
            FROM memory_profiles
            LEFT JOIN provider_verifications v ON v.phone=memory_profiles.phone
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
      return res.status(400).json({ error: 'Legacy verification projection cannot be changed directly. Use the evidence-backed provider verification action.' });
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
    const { phone, evidenceRef, expiresAt } = req.body || {};
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

    if (nin && jobsDone >= 5 && avgRating >= 4.0 && typeof evidenceRef === 'string' && evidenceRef.trim()) {
      const verification = await setProviderVerification(String(phone), 'verified', {
        evidenceRef: evidenceRef.trim(),
        reviewedBy: String(req.user?.phone || 'admin'),
        expiresAt: typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt.trim() : undefined,
      });
      res.json({ success: true, message: 'Provider verification recorded with authoritative evidence.', verification });
    } else {
      res.json({
        success: false,
        message: 'Verification requires NIN, 5+ jobs, a 4.0+ rating, and an authoritative evidenceRef.',
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
    res.json({ metrics: await getCommercialMetrics() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch commercial metrics' });
  }
});

router.get('/marketing', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    res.json(await getMarketingMetrics());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch marketing metrics' });
  }
});

// Campaign state remains owned by adManager; this admin projection does not imply advertiser onboarding, billing, or delivered impressions.
router.get('/marketing/campaigns', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ campaigns: await getAdCampaigns() }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load campaigns' }); }
});

router.post('/marketing/campaigns', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const campaign = await createAdCampaign(req.body || {});
    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create campaign' });
  }
});

router.post('/marketing/campaigns/:id/status', authenticateAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '') as AdCampaignStatus;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'A valid campaign id is required' });
  try {
    const campaign = await setAdCampaignStatus(id, status);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update campaign' });
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

const CONTENT_TYPES = new Set<ContentItem['type']>(['blog', 'help', 'legal', 'page']);
const contentSlug = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');

router.get('/content', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const content = await getAllContent();
    res.json(content.map(({ slug, title, type, author, updatedAt, createdAt }) => ({
      slug, title, type, author, updated_at: updatedAt || createdAt || null,
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.get('/content/:slug', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const item = await getContentBySlug(contentSlug(req.params.slug));
    if (!item) return res.status(404).json({ error: 'Content not found' });
    return res.json(item);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.post('/content', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, body, type, author } = req.body || {};
    const slug = contentSlug(req.body?.slug);
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return res.status(400).json({ error: 'Slug must use lowercase letters, numbers, and hyphens only' });
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 180) return res.status(400).json({ error: 'Title is required and must be 180 characters or fewer' });
    if (typeof body !== 'string' || !body.trim() || body.length > 50000) return res.status(400).json({ error: 'Content body is required and must be 50,000 characters or fewer' });
    if (!CONTENT_TYPES.has(type)) return res.status(400).json({ error: 'Content type must be blog, help, legal, or page' });
    if (typeof author !== 'string' || !author.trim() || author.trim().length > 120) return res.status(400).json({ error: 'Author is required and must be 120 characters or fewer' });
    await saveContent({ slug, title: title.trim(), body: body.trim(), type, author: author.trim() });
    res.json({ success: true, slug });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save content' });
  }
});

router.delete('/content/:slug', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const slug = contentSlug(req.params.slug);
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return res.status(400).json({ error: 'Invalid content slug' });
    const existing = await getContentBySlug(slug);
    if (!existing) return res.status(404).json({ error: 'Content not found' });
    await deleteContentBySlug(slug);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete content' });
  }
});

router.post('/content/generate', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { topic } = req.body || {};
    const prompt = `Write a short, professional content draft (about 250 words) on the topic: "${topic}". The draft must be suitable for the Kurukoo conversational fulfilment network. Use plain Markdown only; do not make claims of live provider availability, delivery, payment settlement, escrow custody, emergency response, or external execution unless the topic itself provides verified evidence.`;
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

// ── Guarded Control Plane ───────────────────────────────────────────────

router.get('/control-plane', authenticateAdmin, (_req: AuthRequest, res) => {
  res.json({ success: true, controlPlane: getAdminControlPlaneStatus() });
});

router.put('/control-plane/controls/:key', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const controlPlane = await updateAdminRuntimeControl({ key: String(req.params.key || ''), value: req.body?.value, actor: String(req.user?.phone || req.user?.username || 'admin') });
    res.json({ success: true, controlPlane });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update runtime control';
    res.status(/unknown|must be|disabled|locked|deployment/.test(message) ? 409 : 422).json({ success: false, error: message });
  }
});

router.get('/control-plane/feature-flags', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, ...(await listAdminFeatureFlags(typeof req.query.country === 'string' ? req.query.country : 'ng')) });
  } catch {
    res.status(500).json({ success: false, error: 'Unable to list feature flags' });
  }
});

router.put('/control-plane/feature-flags/:name', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const flag = await updateAdminFeatureFlag({ country: typeof req.body?.country === 'string' ? req.body.country : 'ng', name: String(req.params.name || ''), value: req.body?.value, actor: String(req.user?.phone || req.user?.username || 'admin') });
    res.json({ success: true, flag });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update feature flag';
    res.status(/Invalid|disabled|locked/.test(message) ? 409 : 422).json({ success: false, error: message });
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
