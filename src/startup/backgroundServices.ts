import { purgeExpiredData } from '../services/dataRetention.js';
import { seedDemoAdCampaigns } from '../services/adManager.js';
import { ensureAuthenticatedLeftRailDemoAd } from '../services/authenticatedAdvertisingSeed.js';
import { startContactSyncService } from '../services/contactSyncService.js';
import { startDeliveryStatusService } from '../services/deliveryService.js';
import { runEscrowPass } from '../services/tradeEngine.js';
import { drainFcmQueue, isFcmConfigured } from '../services/pushNotifications.js';
import { requeueDueFcmFailures } from '../services/fcmRetryService.js';
import { drainPendingExecutionRequests } from '../services/executionConnector.js';
import { isWhatsAppLinkedDeviceConfigured, startWhatsAppLinkedDevice, stopWhatsAppLinkedDevice } from '../services/whatsappLinkedDeviceService.js';
import { markAgentWorkerCycleCompleted, markAgentWorkerCycleFailed, markAgentWorkerCycleStarted, markAgentWorkerStarted, markAgentWorkerStopped, notifyGoalIfNeeded, recordAgentWorkerRun, reenterDueDeferredGoals, runDueAgentGoals } from '../services/agentRuntime.js';
import { runRecurringSubscriptionBillingPass } from '../services/commercialBillingService.js';
import { runProviderInquiryFollowUpPass } from '../services/providerInquiryFollowUpService.js';

const backgroundTimers: Array<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>> = [];
let backgroundServicesStarted = false;

export async function startBackgroundServices(): Promise<void> {
    if (backgroundServicesStarted) return;
    backgroundServicesStarted = true;
    try { await seedDemoAdCampaigns(); } catch (error) { console.error('Error seeding demo ad campaigns:', error); }
    try { await ensureAuthenticatedLeftRailDemoAd(); } catch (error) { console.error('Error seeding authenticated left-rail demo ad:', error); }
    try { await startContactSyncService(); } catch (error) { console.error('Failed to start contact sync service:', error); }
    try { await startDeliveryStatusService(); } catch (error) { console.error('Failed to start delivery status service:', error); }
    try { await runRecurringSubscriptionBillingPass(); } catch (error) { console.error('Failed to run initial recurring subscription billing pass:', error); }
    purgeExpiredData().catch((error) => console.error('Error running initial data retention purge:', error));
    backgroundTimers.push(setInterval(() => purgeExpiredData().catch((error) => console.error('Error running daily data retention purge:', error)), 24 * 60 * 60 * 1000));
    const logHeartbeat = () => { const mem = process.memoryUsage(); console.log(`[Heartbeat] Server healthy. Memory usage: RSS ${(mem.rss / 1024 / 1024).toFixed(2)} MB, Heap ${(mem.heapUsed / 1024 / 1024).toFixed(2)}/${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB.`); };
    logHeartbeat();
    backgroundTimers.push(setInterval(logHeartbeat, 5 * 60 * 1000));

    backgroundTimers.push(setInterval(() => runRecurringSubscriptionBillingPass().then(result => { if (result.attempted) console.log(`[CommercialBilling] attempted=${result.attempted} renewed=${result.renewed} failed=${result.failed}`); }).catch(error => console.error('Error running recurring subscription billing pass:', error)), 60 * 60 * 1000));

    const providerInquiryIntervalMs = Math.max(60_000, Math.min(60 * 60_000, Number(process.env.KURUKOO_PROVIDER_INQUIRY_WORKER_INTERVAL_MS || 5 * 60_000)));
    const runProviderInquiryFollowUp = async () => {
        const result = await runProviderInquiryFollowUpPass({ limit: Number(process.env.KURUKOO_PROVIDER_INQUIRY_WORKER_BATCH || 20) });
        if (result.markedNoResponse) console.log(`[ProviderInquiryWorker] marked_no_response=${result.markedNoResponse}`);
    };
    backgroundTimers.push(setTimeout(() => runProviderInquiryFollowUp().catch((error) => console.error('Error running provider inquiry follow-up:', error)), 5_000));
    backgroundTimers.push(setInterval(() => runProviderInquiryFollowUp().catch((error) => console.error('Error running provider inquiry follow-up:', error)), providerInquiryIntervalMs));

    if (isFcmConfigured()) {
        const runFcmCycle = async () => { await requeueDueFcmFailures(); await drainFcmQueue(); };
        backgroundTimers.push(setInterval(() => runFcmCycle().catch((error) => console.error('Error draining FCM queue:', error instanceof Error ? error.message : error)), 15_000));
    } else console.warn('[Push] FCM external delivery is not configured; internal inbox notifications only.');

    if (process.env.KURUKOO_EXTERNAL_EXECUTION_ENABLED === 'true') {
        const executionIntervalMs = Math.max(5_000, Math.min(60_000, Number(process.env.KURUKOO_EXECUTION_WORKER_INTERVAL_MS || 15_000)));
        const runExecutionCycle = async () => { const result = await drainPendingExecutionRequests(Number(process.env.KURUKOO_EXECUTION_WORKER_BATCH || 20)); if (result.attempted) console.log(`[ExecutionWorker] attempted=${result.attempted} advanced=${result.advanced} failed=${result.failed}`); };
        backgroundTimers.push(setTimeout(() => runExecutionCycle().catch((error) => console.error('Error draining execution requests:', error)), 5_000));
        backgroundTimers.push(setInterval(() => runExecutionCycle().catch((error) => console.error('Error draining execution requests:', error)), executionIntervalMs));
    } else console.warn('[ExecutionWorker] External execution is disabled; pending executions remain durable and inspectable.');

    if (process.env.KURUKOO_WHATSAPP_LINKED_DEVICE_AUTOSTART === 'true' && isWhatsAppLinkedDeviceConfigured()) void startWhatsAppLinkedDevice().catch((error) => console.error('[WhatsApp Linked Device] Startup failed:', error instanceof Error ? error.message : error));
    else console.warn('[WhatsApp Linked Device] Disabled or not configured; no personal WhatsApp session will start.');
    backgroundTimers.push(setTimeout(() => runEscrowPass().catch((error) => console.error('Error running initial escrow pass:', error)), 30000));
    backgroundTimers.push(setInterval(() => runEscrowPass().catch((error) => console.error('Error running daily escrow pass:', error)), 24 * 60 * 60 * 1000));

    if (process.env.KURUKOO_AGENT_ENABLED === undefined) process.env.KURUKOO_AGENT_ENABLED = 'false';
    if (process.env.KURUKOO_AGENT_AUTONOMOUS === undefined) process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
    if (process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK === undefined) process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'false';

    if (process.env.KURUKOO_AGENT_ENABLED === 'true' && process.env.KURUKOO_AGENT_AUTONOMOUS === 'true') {
        const intervalMs = Math.max(30_000, Math.min(15 * 60_000, Number(process.env.KURUKOO_AGENT_WORKER_INTERVAL_MS || 60_000)));
        markAgentWorkerStarted();
        const runAgentFollowUp = async () => {
            if (!markAgentWorkerCycleStarted()) return;
            const startedAt = new Date().toISOString();
            try {
                const dueGoals = await runDueAgentGoals();
                const deferredGoals = await reenterDueDeferredGoals();
                const updates = [...dueGoals, ...deferredGoals];
                for (const goal of updates) await notifyGoalIfNeeded(goal);
                markAgentWorkerCycleCompleted(dueGoals.length + deferredGoals.length, updates.length);
                await recordAgentWorkerRun({ startedAt, completedAt: new Date().toISOString(), status: 'completed', dueGoalCount: dueGoals.length + deferredGoals.length, updatedGoalCount: updates.length });
            } catch (error) {
                markAgentWorkerCycleFailed(error);
                await recordAgentWorkerRun({ startedAt, completedAt: new Date().toISOString(), status: 'failed', dueGoalCount: 0, updatedGoalCount: 0, error: String(error instanceof Error ? error.message : error).slice(0, 500) });
                throw error;
            }
        };
        backgroundTimers.push(setTimeout(() => runAgentFollowUp().catch((error) => console.error('Error running Kurukoo agent follow-up:', error)), 5_000));
        backgroundTimers.push(setInterval(() => runAgentFollowUp().catch((error) => console.error('Error running Kurukoo agent follow-up:', error)), intervalMs));
    }
}

export function stopBackgroundServices(): void {
    void stopWhatsAppLinkedDevice(false).catch(() => undefined);
    while (backgroundTimers.length) { const timer = backgroundTimers.pop(); if (timer) clearTimeout(timer); }
    markAgentWorkerStopped();
    backgroundServicesStarted = false;
}
