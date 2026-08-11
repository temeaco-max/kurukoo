import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();
const startedAt = Date.now();

router.get('/health', async (_req, res) => {
  try {
    const db = await getDb();
    db.exec('SELECT 1');
    res.json({
      status: 'ok',
      service: 'kurukoo',
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      database: 'ok',
      payment_provider: process.env.KURUKOO_PAY_PROVIDER || 'unconfigured',
      economic_payments_enabled: process.env.NODE_ENV !== 'production' && process.env.KURUKOO_PAY_PROVIDER === 'sandbox'
        ? false
        : Boolean(process.env.KURUKOO_PAY_PROVIDER && process.env.ECONOMIC_PAYMENT_ADAPTER === 'verified'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Health] check failed:', error);
    res.status(503).json({ status: 'degraded', service: 'kurukoo', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

export default router;
