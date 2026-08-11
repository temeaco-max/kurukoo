/** Kurukoo composition root. */
import express from 'express';
import { registerLegacyRoutes } from './legacyApp.js';
import channelRoutes from './routes/channelRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import economicRequestRouter from './routes/economicRequestRouter.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import chatRouter from './routes/chatRouter.js';
import orderRoutes from './routes/orderRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import discoveryRoutes from './routes/discoveryRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

// Production must never inherit a sandbox payment default from a legacy module.
if (process.env.NODE_ENV === 'production' && process.env.KURUKOO_PAY_PROVIDER === 'sandbox') delete process.env.KURUKOO_PAY_PROVIDER;

const app = express();
app.use(express.json({ limit: process.env.CHAT_ATTACHMENT_BODY_LIMIT || '35mb', verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));
app.use('/api', channelRoutes);
app.use('/api', circleRoutes);
app.use('/api/economic-requests', economicRequestRouter);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes);
app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRouter);
app.use('/api', orderRoutes);
app.use('/', healthRoutes);
app.use('/', presenceRoutes);
app.use('/', discoveryRoutes);
app.use('/', contentRoutes);
app.use('/', publicRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api', subscriptionRoutes);
registerLegacyRoutes(app);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
export { app };
if (process.env.KURUKOO_DISABLE_LISTEN !== 'true') { const server = app.listen(port, host, () => console.log(`[Kurukoo] HTTP server listening on ${host}:${port}`)); server.on('error', error => { console.error('[Kurukoo] HTTP server error:', error); process.exitCode = 1; }); }
