import { seedDemoAdCampaigns } from '../services/adManager.js';
import { startDeliveryStatusService } from '../services/deliveryService.js';
import { startBackgroundWorkers } from '../services/backgroundWorkers.js';

/**
 * Single-instance startup composition. All recurring domain work is scheduled
 * by backgroundWorkers; this boundary only initializes services and starts it.
 */
export async function startBackgroundServices(): Promise<void> {
  try { await seedDemoAdCampaigns(); } catch (error) { console.error('Error seeding demo ad campaigns:', error); }
  try { await startDeliveryStatusService(); } catch (error) { console.error('Failed to start delivery status service:', error); }
  try { startBackgroundWorkers(); } catch (error) { console.error('Failed to start canonical background workers:', error); }
}
