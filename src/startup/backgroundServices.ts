import { purgeExpiredData } from '../services/dataRetention.js';
import { seedDemoAdCampaigns } from '../services/adManager.js';
import { startContactSyncService } from '../services/contactSyncService.js';
import { startDeliveryStatusService } from '../services/deliveryService.js';
import { runEscrowPass } from '../services/tradeEngine.js';
import { notifyGoalIfNeeded, reenterDueDeferredGoals, runDueAgentGoals } from '../services/agentRuntime.js';

export async function startBackgroundServices(): Promise<void> {
    try { await seedDemoAdCampaigns(); } catch (error) { console.error('Error seeding demo ad campaigns:', error); }
    try { await startContactSyncService(); } catch (error) { console.error('Failed to start contact sync service:', error); }
    try { await startDeliveryStatusService(); } catch (error) { console.error('Failed to start delivery status service:', error); }
    purgeExpiredData().catch((error) => console.error('Error running initial data retention purge:', error));
    setInterval(() => purgeExpiredData().catch((error) => console.error('Error running daily data retention purge:', error)), 24 * 60 * 60 * 1000);
    const logHeartbeat = () => { const mem = process.memoryUsage(); console.log(`[Heartbeat] Server healthy. Memory usage: RSS ${(mem.rss / 1024 / 1024).toFixed(2)} MB, Heap ${(mem.heapUsed / 1024 / 1024).toFixed(2)}/${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB.`); };
    logHeartbeat();
    setInterval(logHeartbeat, 5 * 60 * 1000);
    setTimeout(() => runEscrowPass().catch((error) => console.error('Error running initial escrow pass:', error)), 30000);
    setInterval(() => runEscrowPass().catch((error) => console.error('Error running daily escrow pass:', error)), 24 * 60 * 60 * 1000);

    if (process.env.KURUKOO_AGENT_ENABLED === 'true') {
        const intervalMs = Math.max(30_000, Math.min(15 * 60_000, Number(process.env.KURUKOO_AGENT_WORKER_INTERVAL_MS || 60_000)));
        const runAgentFollowUp = async () => {
            const updates = [...await runDueAgentGoals(), ...await reenterDueDeferredGoals()];
            for (const goal of updates) await notifyGoalIfNeeded(goal);
        };
        setTimeout(() => runAgentFollowUp().catch((error) => console.error('Error running Kurukoo agent follow-up:', error)), 5_000);
        setInterval(() => runAgentFollowUp().catch((error) => console.error('Error running Kurukoo agent follow-up:', error)), intervalMs);
    }
}
