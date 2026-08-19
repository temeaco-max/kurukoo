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
import { getDb, saveDb, getSystemSetting, setSystemSetting, getCanonicalOperatorIdentity, getOperatorActorDefinitions, resetOperatorActorState, CANONICAL_OPERATOR_PHONE } from '../database.js';
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
import { issueUserToken, upsertProfile } from './authRoutes.js';
import { getConfiguredTestName, getConfiguredTestPhone, getDevelopmentTestAuthStatus } from '../services/devTestAuthService.js';
import { getProfile, updateProfile } from '../services/memoryProfile.js';
import { getPilotReadiness } from '../services/pilotReadiness.js';
import { getExternalIntegrationReadiness } from '../services/externalIntegrationReadiness.js';
import { createAdCampaign, getAdCampaigns, updateAdCampaign } from '../services/adManager.js';
import { testMistralConnection } from '../services/mistralService.js';
import { getNotificationQueueStats } from '../services/pushNotifications.js';
import { approveLearningArtifact, getContextArbitrationTelemetry, getCoordinatorTelemetry, listCoordinatorRuns, listLearningArtifacts } from '../services/coordinatorStore.js';
import { getPrivacyBridgeStatus } from '../services/privacyBridge.js';
import { getSmolLM2RuntimeStatus } from '../services/smolLm2Service.js';
import { listCountryExperiences } from '../services/countryExperience.js';
import { getTelegramLinkedDeviceStatus, startTelegramLinkedDevice, stopTelegramLinkedDevice } from '../services/telegramLinkedDeviceService.js';
import { getWhatsAppLinkedDeviceStatus } from '../services/whatsappLinkedDeviceService.js';
import { listTrustedDevices, revokeTrustedDevice } from '../services/progressiveTrustService.js';
import { listCurationCandidates, getCurationCandidate, reviewCurationCandidate, rewriteCurationCandidate, getCurationStats, getAcceptedCorpusGate, getCurationAudit } from '../services/curationService.js';

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

// ── Controlled development/test Chat access ─────────────────────────────

function setUserCookie(res: any, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `kurukoo_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
}

function setDevelopmentUserCookie(res: any, token: string): void {
  if (process.env.NODE_ENV === 'production') return;
  setUserCookie(res, token);
}

router.get('/test-chat', authenticateAdmin, async (_req: AuthRequest, res) => {
  const status = getDevelopmentTestAuthStatus();
  if (!status.active || !status.configured) return res.status(404).json({ success: false, error: 'Development test authentication is not enabled or configured' });
  const phone = getConfiguredTestPhone();
  await upsertProfile(phone, getConfiguredTestName(), '', 'buyer');
  const profile = await getProfile(phone, 'admin_test_chat');
  if (profile && profile.preferences?.onboarding_complete !== true) await updateProfile(phone, 'admin_test_chat', { name: getConfiguredTestName(), preferences: { ...(profile.preferences || {}), onboarding_complete: true, development_test_account: true } });
  const token = issueUserToken(phone);
  setDevelopmentUserCookie(res, token);
  res.json({ success: true, testMode: true, phone, name: getConfiguredTestName(), redirect: '/chat?test_mode=1' });
});

router.post('/test-chat/reset', authenticateAdmin, async (_req: AuthRequest, res) => {
  const status = getDevelopmentTestAuthStatus();
  if (!status.active || !status.configured) return res.status(404).json({ success: false, error: 'Development test authentication is not enabled or configured' });
  const phone = getConfiguredTestPhone();
  try {
    const db = await getDb();
    // This route is restricted to the explicitly configured development test actor.
    // Remove only that actor's profile so stale ciphertext from a prior test key cannot
    // block isolation; production identities and ordinary reset paths are untouched.
    db.run('DELETE FROM memory_profiles WHERE phone = ?', [phone]);
    saveDb();
    await upsertProfile(phone, getConfiguredTestName(), '', 'buyer');
    const messageStmt = db.prepare('SELECT id FROM messages WHERE phone = ?');
    messageStmt.bind([phone]);
    const messageIds: number[] = [];
    while (messageStmt.step()) messageIds.push(Number(messageStmt.getAsObject().id));
    messageStmt.free();
    for (const id of messageIds) db.run('DELETE FROM chat_message_meta WHERE message_id = ?', [id]);
    db.run('DELETE FROM messages WHERE phone = ?', [phone]);
    for (const statement of [
      ['DELETE FROM reminders WHERE phone = ?', [phone]],
      ['DELETE FROM user_behavior_signals WHERE phone = ?', [phone]],
      ['DELETE FROM phone_otps WHERE phone = ?', [phone]],
    ] as Array<[string, unknown[]]>) { try { db.run(statement[0], statement[1]); } catch {} }
    try { db.run('DELETE FROM agent_goal_events WHERE goal_id IN (SELECT id FROM agent_goals WHERE phone = ?)', [phone]); } catch {}
    try { db.run('DELETE FROM agent_goals WHERE phone = ?', [phone]); } catch {}
    await updateProfile(phone, 'admin_test_chat', { name: getConfiguredTestName(), preferences: { goal: 'buyer', onboarding_complete: true, development_test_account: true, test_state_reset_at: new Date().toISOString() } });
    saveDb();
    res.json({ success: true, testMode: true, phone, preserved: ['economic_requests', 'orders', 'escrow', 'payments', 'disputes'] });
  } catch (error) {
    console.error('[AdminTestChat] reset failed:', error);
    res.status(500).json({ success: false, error: 'Unable to reset development test state' });
  }
});

// ── Canonical User #1 operator Chat and isolated Test As contexts ─────────
router.get('/operator/state', authenticateAdmin, async (_req: AuthRequest, res) => {
  const operator = getCanonicalOperatorIdentity();
  const actors = getOperatorActorDefinitions();
  const db = await getDb();
  const rows = actors.map(actor => {
    const profile = db.exec('SELECT phone, name, location, subscription_tier, points_balance, is_available, is_contributor, provider_type, preferences FROM memory_profiles WHERE phone = ?', [actor.phone])[0]?.values?.[0];
    return { ...actor, exists: Boolean(profile), profile: profile ? { phone: profile[0], name: profile[1], location: profile[2], subscriptionTier: profile[3], points: profile[4], available: Boolean(profile[5]), contributor: Boolean(profile[6]), providerType: profile[7] } : null };
  });
  res.json({ success: true, operator, actors: rows, testBoundary: 'explicit_operator_session_claim' });
});

router.get('/operator/chat', authenticateAdmin, async (_req: AuthRequest, res) => {
  const operator = getCanonicalOperatorIdentity();
  if (process.env.NODE_ENV !== 'production' && process.env.KURUKOO_TEST_RESET_OPERATOR_ON_LAUNCH === 'true') {
    const db = await getDb();
    db.run('DELETE FROM memory_profiles WHERE phone = ?', [operator.phone]);
    saveDb();
  }
  await upsertProfile(operator.phone, operator.name, '', 'super_admin');
  const token = issueUserToken(operator.phone, { operatorPhone: operator.phone, operatorSession: true, actorRole: 'super_admin', actorContextId: 'operator' });
  setUserCookie(res, token);
  res.json({ success: true, operator, redirect: '/chat?operator=1', session: { operator: true, phone: operator.phone, actorRole: 'super_admin' } });
});

router.get('/operator/actors', authenticateAdmin, async (_req: AuthRequest, res) => {
  res.json({ success: true, actors: getOperatorActorDefinitions().map(actor => ({ ...actor, testOnly: true, identityBoundary: 'isolated_actor_context' })) });
});

router.post('/operator/actors/:actorId/chat', authenticateAdmin, async (req: AuthRequest, res) => {
  const actor = getOperatorActorDefinitions().find(item => item.id === String(req.params.actorId || ''));
  if (!actor) return res.status(404).json({ success: false, error: 'Unknown controlled actor' });
  await upsertProfile(actor.phone, actor.name, '', actor.role);
  const token = issueUserToken(actor.phone, { operatorPhone: CANONICAL_OPERATOR_PHONE, operatorSession: true, testActor: true, actorRole: actor.role, actorContextId: actor.id });
  setUserCookie(res, token);
  res.json({ success: true, actor, testOnly: true, identityBoundary: 'isolated_actor_context', resetEndpoint: `/api/admin/operator/actors/${actor.id}/reset`, redirect: `/chat?test_actor=${encodeURIComponent(actor.id)}` });
});

router.post('/operator/actors/:actorId/reset', authenticateAdmin, async (req: AuthRequest, res) => {
  const actor = getOperatorActorDefinitions().find(item => item.id === String(req.params.actorId || ''));
  if (!actor) return res.status(404).json({ success: false, error: 'Unknown controlled actor' });
  const db = await getDb();
  resetOperatorActorState(db, actor.phone);
  res.json({ success: true, actor, reset: true, preserved: ['operator_identity', 'other_actor_contexts', 'production_user_data'] });
});

router.post('/coordinator/learning/:id/approve', authenticateAdmin, async (req: AuthRequest, res) => {
  if (process.env.KURUKOO_COORDINATOR_PROMOTION_ENABLED !== 'true') return res.status(503).json({ success: false, error: 'Learning-artifact promotion is disabled for this deployment.' });
  const operatorId = String(req.user?.phone || `admin:${process.env.ADMIN_USERNAME || 'admin'}`);
  const score = req.body?.evaluationScore === undefined ? undefined : Number(req.body.evaluationScore);
  const result = await approveLearningArtifact({ id: String(req.params.id || ''), operatorId, evaluationScore: score, policyVersion: req.body?.policyVersion ? String(req.body.policyVersion) : undefined });
  const status = result.ok ? 200 : result.status === 'missing' ? 404 : result.status === 'conflict' ? 409 : 400;
  return res.status(status).json({ success: result.ok, ...result, runtimeActivation: 'separate_feature_flag_and_canary_required' });
});

// ── Trust, channel, and privacy readiness ────────────────────────────────
router.get('/trust/readiness', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const count = (sql: string): number => { try { return Number(db.exec(sql)[0]?.values?.[0]?.[0] || 0); } catch { return 0; } };
    const channelRows = (() => { try { return db.exec('SELECT channel, status, COUNT(*) FROM channel_evidence GROUP BY channel, status')[0]?.values || []; } catch { return []; } })();
    const channelEvidence: Record<string, Record<string, number>> = {};
    for (const row of channelRows) {
      const channel = String(row[0]);
      const status = String(row[1]);
      channelEvidence[channel] ||= {};
      channelEvidence[channel][status] = Number(row[2]);
    }
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      featureFlags: {
        progressiveTrust: process.env.KURUKOO_PROGRESSIVE_TRUST_ENABLED === 'true',
        pushApproval: process.env.KURUKOO_PUSH_APPROVAL_ENABLED === 'true',
        channelEvidence: process.env.KURUKOO_CHANNEL_EVIDENCE_ENABLED === 'true',
        emailOtp: process.env.KURUKOO_EMAIL_OTP_ENABLED === 'true',
        privateNumberMasking: process.env.FF_PRIVATE_NUMBER_MASKING === 'true',
      },
      trustedDevices: { active: count("SELECT COUNT(*) FROM trusted_devices WHERE status='active'"), revoked: count("SELECT COUNT(*) FROM trusted_devices WHERE status='revoked'") },
      trustChallenges: { pending: count("SELECT COUNT(*) FROM trust_challenges WHERE status='pending' AND expires_at > CURRENT_TIMESTAMP"), approved: count("SELECT COUNT(*) FROM trust_challenges WHERE status='approved'"), denied: count("SELECT COUNT(*) FROM trust_challenges WHERE status='denied'") },
      channelEvidence,
      connectors: { whatsappLinkedDevice: getWhatsAppLinkedDeviceStatus(), telegramLinkedDevice: getTelegramLinkedDeviceStatus() },
      privacyNumberMasking: getPrivacyBridgeStatus(),
      brain: {
        localModel: getSmolLM2RuntimeStatus(),
        firstClassPersonaCoordination: { eventType: 'agent.persona.requested', capability: 'first_class_agent_persona', policyReviewed: true, guestSafe: true, ownerCharging: 'authenticated_only' },
        telemetry: await getCoordinatorTelemetry(),
        contextArbitration: await getContextArbitrationTelemetry(),
      },
      deliveryClaims: 'Internal readiness and persisted states only; no external delivery or provider ownership is claimed.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unable to read trust readiness.' });
  }
});

router.get('/connectors/telegram-linked-device/status', authenticateAdmin, (_req: AuthRequest, res) => {
  res.json({ success: true, status: getTelegramLinkedDeviceStatus(), activation: 'Deployment flags and Telegram API credentials remain environment-managed.' });
});

router.post('/connectors/telegram-linked-device/start', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    await startTelegramLinkedDevice();
    res.status(202).json({ success: true, status: getTelegramLinkedDeviceStatus() });
  } catch (error) {
    res.status(503).json({ success: false, error: error instanceof Error ? error.message : 'Telegram linked-device start failed.', status: getTelegramLinkedDeviceStatus() });
  }
});

router.post('/connectors/telegram-linked-device/stop', authenticateAdmin, async (_req: AuthRequest, res) => {
  await stopTelegramLinkedDevice(false);
  res.json({ success: true, status: getTelegramLinkedDeviceStatus() });
});

router.post('/connectors/telegram-linked-device/logout', authenticateAdmin, async (_req: AuthRequest, res) => {
  await stopTelegramLinkedDevice(true);
  res.json({ success: true, status: getTelegramLinkedDeviceStatus() });
});

router.get('/trust/devices/:phone', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const phone = decodeURIComponent(String(req.params.phone || '')).trim();
    if (!phone) return res.status(400).json({ success: false, error: 'Phone is required.' });
    const devices = await listTrustedDevices(phone);
    res.json({ success: true, phone, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unable to list trusted devices.' });
  }
});

router.post('/trust/devices/:phone/:deviceId/revoke', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const phone = decodeURIComponent(String(req.params.phone || '')).trim();
    const deviceRecordId = Number(req.params.deviceId);
    if (!phone || !Number.isInteger(deviceRecordId) || deviceRecordId <= 0) return res.status(400).json({ success: false, error: 'A valid phone and device id are required.' });
    const result = await revokeTrustedDevice({ phone, deviceRecordId });
    res.status(result.revoked ? 200 : 409).json({ success: result.revoked, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unable to revoke trusted device.' });
  }
});

// ── Platform Stats / Observability ──────────────────────────────────────
router.get('/stats', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    let economicRequests = {};
    let reminders = {};
    let checkIns = {};
    let notificationsCount = 0;
    let users = 0;
    let providers = 0;
    let messages = 0;
    let credits = 0;
    let notificationQueue = { total: 0, queued: 0, accepted: 0, sent: 0, delivered: 0, failed: 0, suppressed: 0, deadLetter: 0 } as Awaited<ReturnType<typeof getNotificationQueueStats>>;
    let coordinatorTelemetry: Awaited<ReturnType<typeof getCoordinatorTelemetry>> = { events: { total: 0, byType: {}, byProducer: {} }, runs: { total: 0, byState: {} }, learningArtifacts: { total: 0, byStatus: {} } };
    let contextArbitrationTelemetry: Awaited<ReturnType<typeof getContextArbitrationTelemetry>> = { total: 0, byContext: {}, byRelation: {}, ambiguous: 0, preservedContextObservations: 0 };
    try {
      users = Number(db.exec('SELECT COUNT(*) FROM memory_profiles')[0]?.values?.[0]?.[0] || 0);
      providers = Number(db.exec("SELECT COUNT(*) FROM memory_profiles WHERE provider_type IS NOT NULL AND lower(provider_type) NOT IN ('', 'buyer')")[0]?.values?.[0]?.[0] || 0);
      messages = Number(db.exec('SELECT COUNT(*) FROM messages')[0]?.values?.[0]?.[0] || 0);
      credits = Number(db.exec('SELECT COALESCE(SUM(points_balance), 0) FROM memory_profiles')[0]?.values?.[0]?.[0] || 0);
    } catch {}
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
      const notifRes = db.exec("SELECT COUNT(*) FROM internal_notifications notification WHERE notification.status = 'unread' AND notification.id IN (SELECT MAX(id) FROM internal_notifications GROUP BY phone, title, body, COALESCE(link, ''))");
      notificationsCount = Number(notifRes[0]?.values[0]?.[0] || 0);
      notificationQueue = await getNotificationQueueStats();
      coordinatorTelemetry = await getCoordinatorTelemetry();
      contextArbitrationTelemetry = await getContextArbitrationTelemetry();
    } catch {}

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      users,
      providers,
      messages,
      credits,
      economic_requests: economicRequests,
      reminders,
      check_ins: checkIns,
      unread_internal_notifications: notificationsCount,
      notification_queue: notificationQueue,
      coordinator: {
        ...coordinatorTelemetry,
        contextArbitration: contextArbitrationTelemetry,
        runtime: {
          enabled: process.env.KURUKOO_AGENT_ENABLED === 'true',
          autonomous: process.env.KURUKOO_AGENT_AUTONOMOUS === 'true',
          lowRisk: process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK === 'true',
          teacherEnabled: process.env.KURUKOO_COORDINATOR_TEACHER_ENABLED === 'true',
          promotionEnabled: process.env.KURUKOO_COORDINATOR_PROMOTION_ENABLED === 'true',
          dispatchMode: 'bounded_async_canonical_events',
        },
      },
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

router.get('/ads', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json(await getAdCampaigns()); }
  catch { res.status(500).json({ error: 'Unable to load advertising campaigns' }); }
});

router.patch('/ads/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'A valid campaign id is required.' });
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    const copyFields = ['title', 'desc', 'imageUrl', 'targetKeyword', 'status', 'campaignType', 'disclosure', 'advertiserName', 'ctaText', 'destination', 'placement', 'category', 'country', 'region', 'startAt', 'expiresAt', 'assetStatus'];
    for (const field of copyFields) if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
    if (Object.prototype.hasOwnProperty.call(body, 'creditsBudget')) patch.creditsBudget = Number(body.creditsBudget);
    if (Object.prototype.hasOwnProperty.call(body, 'frequencyCap')) patch.frequencyCap = Number(body.frequencyCap);
    if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = Number(body.priority);
    if (Object.prototype.hasOwnProperty.call(body, 'targeting')) patch.targeting = typeof body.targeting === 'string' ? body.targeting : JSON.stringify(body.targeting || {});
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'At least one campaign field is required.' });
    const actor = String((req.user as any)?.username || 'admin');
    const campaign = await updateAdCampaign(id, patch as any, actor);
    res.json({ success: true, campaign });
  } catch (error: any) {
    const message = error?.message || 'Unable to update advertising campaign';
    res.status(message === 'Campaign not found.' ? 404 : 400).json({ success: false, error: message });
  }
});
router.post('/ads', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim().slice(0, 160);
    const desc = String(body.desc || '').trim().slice(0, 1000);
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);
    const targetKeyword = String(body.targetKeyword || '').trim().toLowerCase().slice(0, 80);
    const creditsBudget = Number(body.creditsBudget);
    const disclosure = String(body.disclosure || '').trim().slice(0, 120);
    if (!title || !desc || !imageUrl || !disclosure || !targetKeyword || !Number.isFinite(creditsBudget) || creditsBudget <= 0) {
      return res.status(400).json({ success: false, error: 'Title, description, approved image asset, disclosure, target keyword, and a positive credits budget are required.' });
    }
    const result = await createAdCampaign({ title, desc, imageUrl, targetKeyword, creditsBudget: Math.floor(creditsBudget), disclosure, advertiserName: String(body.advertiserName || '').trim().slice(0, 160), ctaText: String(body.ctaText || 'Learn more').trim().slice(0, 80), destination: String(body.destination || '/chat').trim().slice(0, 300), placement: String(body.placement || 'public_discovery').trim().slice(0, 80), category: String(body.category || 'community').trim().slice(0, 80), country: String(body.country || 'NG').trim().slice(0, 8), region: String(body.region || '').trim().slice(0, 80), targeting: typeof body.targeting === 'string' ? body.targeting.slice(0, 1200) : JSON.stringify(body.targeting || {}) });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Unable to create advertising campaign' });
  }
});

router.get('/countries', authenticateAdmin, (_req: AuthRequest, res) => {
  res.json({ success: true, countries: listCountryExperiences() });
});

router.get('/pilot-readiness', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json(getPilotReadiness()); }
  catch { res.status(500).json({ error: 'Unable to read pilot readiness' }); }
});

router.get('/external-integrations', authenticateAdmin, (_req: AuthRequest, res) => {
  try { res.json({ success: true, integrations: getExternalIntegrationReadiness() }); }
  catch { res.status(500).json({ success: false, error: 'Unable to read external integration readiness.' }); }
});

router.post('/providers/mistral/test', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const result = await testMistralConnection();
    res.status(result.reachable || !result.configured ? 200 : 502).json({ success: result.reachable, provider: 'mistral', ...result });
  } catch {
    res.status(502).json({ success: false, provider: 'mistral', configured: false, reachable: false, status: 0, note: 'Mistral connection test failed without exposing provider details.' });
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

    const coordinatorRuns = await listCoordinatorRuns(10);
    const learningArtifacts = await listLearningArtifacts(10);
    res.json({
      users: uRes[0]?.values[0][0] || 0,
      providers: pRes[0]?.values[0][0] || 0,
      messages: mRes[0]?.values[0][0] || 0,
      credits: cRes[0]?.values[0][0] || 0,
      coordinator: {
        recentRuns: coordinatorRuns,
        enabled: process.env.KURUKOO_AGENT_ENABLED === 'true',
        autonomous: process.env.KURUKOO_AGENT_AUTONOMOUS === 'true',
        teacherEnabled: process.env.KURUKOO_COORDINATOR_TEACHER_ENABLED === 'true',
        recentLearningArtifacts: learningArtifacts,
      },
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

// ── Celebrity demand ───────────────────────────────────────────────────
router.get('/celebrity', authenticateAdmin, async (_req: AuthRequest, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT name, category, interested_users, threshold, status FROM celebrity_demand ORDER BY interested_users DESC, name ASC');
    const rows = result[0]?.values || [];
    res.json(rows.map((row: any[]) => ({ name: String(row[0] || ''), category: String(row[1] || ''), interested_users: Number(row[2] || 0), threshold: Number(row[3] || 0), status: String(row[4] || 'tracking') })));
  } catch (error) {
    console.error('[Admin] Celebrity demand query failed:', error);
    res.status(500).json({ error: 'Unable to load celebrity demand' });
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



// ── Conversational training curation Control Room ─────────────────────────
router.get('/curation/queue', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await listCurationCandidates({ status: req.query.status ? String(req.query.status) : undefined, limit: Number(req.query.limit || 50), offset: Number(req.query.offset || 0) });
    res.json({ success: true, ...result, acceptanceRule: 'reviewed=true AND accepted=true; scores and teacher confidence never imply acceptance' });
  } catch { res.status(500).json({ success: false, error: 'Unable to load the curation queue' }); }
});
router.get('/curation/stats', authenticateAdmin, async (_req: AuthRequest, res) => {
  try { res.json({ success: true, ...(await getCurationStats()) }); } catch { res.status(500).json({ success: false, error: 'Unable to load curation statistics' }); }
});
router.get('/curation/coverage', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const requirements = req.query.requirements ? JSON.parse(String(req.query.requirements)) : { skill: 1, actor: 1, market: 1, locale: 1, lifecycle: 1 };
    res.json({ success: true, ...(await getAcceptedCorpusGate(requirements)) });
  } catch { res.status(400).json({ success: false, error: 'Invalid coverage requirements' }); }
});
router.get('/curation/candidates/:exampleId', authenticateAdmin, async (req: AuthRequest, res) => {
  const candidate = await getCurationCandidate(String(req.params.exampleId || ''));
  if (!candidate) return res.status(404).json({ success: false, error: 'Candidate not found' });
  return res.json({ success: true, candidate, audit: await getCurationAudit(candidate.exampleId) });
});
router.post('/curation/candidates/:exampleId/decision', authenticateAdmin, async (req: AuthRequest, res) => {
  const reviewerId = String(req.user?.phone || process.env.ADMIN_USERNAME || 'admin');
  const result = await reviewCurationCandidate({ exampleId: String(req.params.exampleId || ''), decision: String(req.body?.decision || '') as any, reviewerId, notes: req.body?.notes ? String(req.body.notes) : undefined, reason: req.body?.reason ? String(req.body.reason) : undefined, datasetVersion: req.body?.datasetVersion ? String(req.body.datasetVersion) : undefined, reviewScores: req.body?.reviewScores && typeof req.body.reviewScores === 'object' ? req.body.reviewScores : undefined });
  if (!result.ok) return res.status(result.status === 'missing' ? 404 : 400).json({ success: false, ...result });
  return res.json({ success: true, ...result });
});
router.post('/curation/candidates/:exampleId/rewrite', authenticateAdmin, async (req: AuthRequest, res) => {
  const reviewerId = String(req.user?.phone || process.env.ADMIN_USERNAME || 'admin');
  const result = await rewriteCurationCandidate({ exampleId: String(req.params.exampleId || ''), trajectory: req.body?.trajectory, reviewerId, notes: req.body?.notes ? String(req.body.notes) : undefined, reason: req.body?.reason ? String(req.body.reason) : undefined });
  if (!result.ok) return res.status(result.status === 'missing' ? 404 : 400).json({ success: false, ...result });
  return res.status(201).json({ success: true, ...result });
});
router.get('/curation/candidates/:exampleId/audit', authenticateAdmin, async (req: AuthRequest, res) => res.json({ success: true, audit: await getCurationAudit(String(req.params.exampleId || '')) }));

export default router;
