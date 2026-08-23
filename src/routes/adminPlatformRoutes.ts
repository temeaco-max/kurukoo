import { Router } from 'express';
import { authenticateAdmin, type AuthRequest } from '../middleware/auth.js';
import { getAdminModules, getAdminPlatformOverview } from '../services/adminPlatformService.js';
import { getScaleTransitionReport } from '../services/scaleTransition.js';
import { getDb } from '../database.js';
import { getExternalIntegrationOperationalStatus } from '../services/externalIntegrationOperationalStatus.js';
import { activateConfiguredExternalProviders, probeConfiguredExternalProviders } from '../services/externalActivationService.js';
import { listAiProviderHealth } from '../services/aiProviderHealth.js';
import { getAiUsageSummary } from '../services/aiCostTelemetry.js';
import { listUnknownIntentReviewCandidates, reviewUnknownIntentCandidate } from '../services/unknownIntentReviewService.js';
import { getAdminConfigDefinitions, getAdminConfigStatus } from '../services/adminConfigMetadata.js';

const router = Router();
router.use(authenticateAdmin);

router.get('/overview', async (_req: AuthRequest, res) => {
  try { res.json(await getAdminPlatformOverview()); }
  catch (error) { console.error('[AdminPlatform] overview failed:', error); res.status(500).json({ success: false, error: 'Unable to load platform operations state.' }); }
});

router.get('/surfaces', async (_req: AuthRequest, res) => {
  try { const overview = await getAdminPlatformOverview(); res.json({ success: true, contractVersion: overview.contractVersion, generatedAt: overview.generatedAt, surfaces: overview.surfaces, readinessSummary: overview.readinessSummary, clientContract: overview.clientContract }); }
  catch (error) { console.error('[AdminPlatform] surfaces failed:', error); res.status(500).json({ success: false, error: 'Unable to load client surface state.' }); }
});

router.get('/modules', (_req: AuthRequest, res) => { res.json({ success: true, contractVersion: 'admin-platform-v2', modules: getAdminModules() }); });
router.get('/scale-readiness', (_req: AuthRequest, res) => { res.json({ success: true, contractVersion: 'scale-readiness-v1', report: getScaleTransitionReport() }); });

router.get('/activation-matrix', (_req: AuthRequest, res) => {
  res.json({ success: true, contractVersion: 'external-activation-matrix-v2', checkedAt: new Date().toISOString(), integrations: getExternalIntegrationOperationalStatus(), aiProviderHealth: listAiProviderHealth(), claims: 'Configured/connected/runtime-ready describe repository-side state. Use /activate to run authenticated external-provider activation calls.' });
});

router.post('/activate', async (_req: AuthRequest, res) => {
  try { res.json({ success: true, contractVersion: 'external-activation-v1', ...(await activateConfiguredExternalProviders()), aiProviderHealth: listAiProviderHealth() }); }
  catch (error) { console.error('[AdminPlatform] external activation failed:', error); res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'External activation failed.' }); }
});

router.get('/external-probe', async (req: AuthRequest, res) => {
  try { const phone = String(req.query.phone || '').trim(); res.json({ success: true, contractVersion: 'external-probe-v1', ...(await probeConfiguredExternalProviders(phone)), aiProviderHealth: listAiProviderHealth() }); }
  catch (error) { console.error('[AdminPlatform] external probe failed:', error); res.status(502).json({ success: false, error: error instanceof Error ? error.message : 'External probe failed.' }); }
});

router.get('/ai-usage', async (req: AuthRequest, res) => {
  try { const since = req.query.since ? String(req.query.since) : undefined; res.json({ success: true, contractVersion: 'ai-usage-v1', since: since || null, providerHealth: listAiProviderHealth(), summary: await getAiUsageSummary(since) }); }
  catch (error) { console.error('[AdminPlatform] AI usage failed:', error); res.status(500).json({ success: false, error: 'Unable to load AI usage telemetry.' }); }
});

router.get('/ai-learning/unknown-intents', async (req: AuthRequest, res) => {
  try { res.json({ success: true, contractVersion: 'ai-learning-unknown-intents-v1', candidates: await listUnknownIntentReviewCandidates(String(req.query.status || 'pending'), Number(req.query.limit || 100)) }); }
  catch (error) { console.error('[AdminPlatform] unknown-intent queue failed:', error); res.status(500).json({ success: false, error: 'Unable to load unknown-intent review queue.' }); }
});

router.post('/ai-learning/unknown-intents/:id/review', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const decision = req.body?.decision === 'accepted' ? 'accepted' : 'rejected';
    const ok = await reviewUnknownIntentCandidate(id, String((req as any).admin?.username || (req as any).user?.phone || 'admin'), decision, req.body?.category, req.body?.skill, req.body?.trainingExample, req.body?.note);
    res.status(ok ? 200 : 404).json({ success: ok, contractVersion: 'ai-learning-review-v1', id, decision });
  } catch (error) { console.error('[AdminPlatform] unknown-intent review failed:', error); res.status(500).json({ success: false, error: 'Unable to review unknown intent.' }); }
});

router.get('/config/catalog', (_req: AuthRequest, res) => {
  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    contractVersion: 'admin-config-catalog-v1',
    policy: { secretValues: 'never_returned', sourceOfTruth: 'process_environment', mutation: 'deployment_or_secret_manager_only' },
    definitions: getAdminConfigDefinitions(),
    status: getAdminConfigStatus(),
  });
});

router.get('/config/readiness', (_req: AuthRequest, res) => {
  const status = getAdminConfigStatus();
  const requiredMissing = status.filter(item => item.required && !item.configured).map(item => item.key);
  const optionalMissing = status.filter(item => !item.required && !item.configured).map(item => item.key);
  res.json({ success: true, contractVersion: 'admin-config-readiness-v1', ready: requiredMissing.length === 0, requiredMissing, optionalMissing, configuredCount: status.filter(item => item.configured).length, totalCount: status.length, secretPolicy: 'Secret values are never exposed through this API.' });
});

router.get('/health', async (_req: AuthRequest, res) => {
  const checks: Record<string, 'ok' | 'degraded' | 'blocked'> = { database: 'blocked', adminAuthentication: 'ok', clientSurfaceRegistry: 'ok', platformProjection: 'blocked' };
  try { const db = await getDb(); db.exec('SELECT 1'); checks.database = 'ok'; } catch { checks.database = 'blocked'; }
  try { await getAdminPlatformOverview(); checks.platformProjection = checks.database === 'ok' ? 'ok' : 'degraded'; } catch { checks.platformProjection = 'blocked'; }
  const status = Object.values(checks).includes('blocked') ? 503 : 200;
  res.status(status).json({ success: status === 200, contractVersion: 'admin-platform-health-v3', checkedAt: new Date().toISOString(), checks, deployment: { nodeEnv: process.env.NODE_ENV || 'development', databaseMode: process.env.KURUKOO_DATABASE_MODE || 'sqljs', jobMode: process.env.KURUKOO_JOB_MODE || 'in_process', workers: Number(process.env.KURUKOO_WORKERS || 1), externalPaymentConfigured: Boolean(process.env.KURUKOO_PAY_PROVIDER) }, externalIntegrations: getExternalIntegrationOperationalStatus(), aiProviderHealth: listAiProviderHealth(), aiUsage: await getAiUsageSummary(), scaleTransition: getScaleTransitionReport(), claims: 'Internal platform health plus current external integration and AI-provider connectivity projections.' });
});

export default router;
