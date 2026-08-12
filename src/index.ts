/** Kurukoo composition root. */
import dotenv from 'dotenv';
dotenv.config();

const production = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'super_secret_safe_and_long_jwt_key_32_chars_fallback';
}

import express from 'express';
import path from 'node:path';
import channelRoutes from './routes/channelRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import economicRequestRouter from './routes/economicRequestRouter.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import chatRouter from './routes/chatRouter.js';
import orderRoutes from './routes/orderRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import safetyRoutes from './routes/safetyRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import discoveryRoutes from './routes/discoveryRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import trustRoutes from './routes/trustRoutes.js';
import webrtcRoutes from './routes/webrtcRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import voiceRouter from './routes/voiceRouter.js';
import qrRouter from './routes/qrRouter.js';
import agentRouter from './routes/agentRouter.js';
import { startBackgroundServices } from './startup/backgroundServices.js';

if (process.env.NODE_ENV !== 'production' && !process.env.KURUKOO_PAY_PROVIDER) process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
if (!process.env.CREDIT_ECONOMY_ENABLED) process.env.CREDIT_ECONOMY_ENABLED = 'true';
if (process.env.NODE_ENV === 'production' && process.env.KURUKOO_PAY_PROVIDER === 'sandbox') delete process.env.KURUKOO_PAY_PROVIDER;
console.log(`[Kurukoo Startup] Environment initialized. PORT=${process.env.PORT || 3000}, Pay Provider=${process.env.KURUKOO_PAY_PROVIDER || 'unconfigured'}`);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static(path.join(process.cwd(), 'public'), { index: false, fallthrough: true }));
app.use(express.json({ limit: process.env.CHAT_ATTACHMENT_BODY_LIMIT || '35mb', verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));

// Public system documentation must remain reachable before authenticated /api route boundaries.
app.use('/', systemRoutes);

app.use('/api', channelRoutes);
app.use('/api', circleRoutes);
app.use('/api/economic-requests', economicRequestRouter);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes);
app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/qr', qrRouter);
app.use('/api/agent', agentRouter);
app.use('/api', orderRoutes);
app.use('/api', reminderRoutes);
app.use('/api', notificationRoutes);
app.use('/api', safetyRoutes);
app.use('/api', taskRoutes);
app.use('/api', trustRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/', healthRoutes);
app.use('/', presenceRoutes);
app.use('/', discoveryRoutes);
app.use('/', contentRoutes);
app.use('/', publicRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api', subscriptionRoutes);

const port = Number(process.env.PORT || 3000);
const host = (process.env.HOST && process.env.HOST !== 'localhost' && process.env.HOST !== '127.0.0.1') ? process.env.HOST : '0.0.0.0';

export { app };

if (process.env.KURUKOO_DISABLE_LISTEN !== 'true') {
    const server = app.listen(port, host, () => {
        console.log(`[Kurukoo] HTTP server listening on ${host}:${port}`);
        if (process.env.KURUKOO_WORKERS !== '0') void startBackgroundServices();
    });
    server.on('error', (error) => { console.error('[Kurukoo] HTTP server error:', error); process.exitCode = 1; });
}