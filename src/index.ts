/** Kurukoo composition root. */
import express from 'express';
import path from 'path';
import channelRoutes from './routes/channelRoutes.js';
import circleRoutes from './routes/circleRoutes.js';
import economicRequestRouter from './routes/economicRequestRouter.js';
import adminRoutes from './routes/adminRoutes.js';
import adminUiRoutes from './routes/adminUiRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import chatRouter from './routes/chatRouter.js';
import orderRoutes from './routes/orderRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import discoveryRoutes from './routes/discoveryRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

// Production must never inherit a sandbox payment default.
if (process.env.NODE_ENV === 'production' && process.env.KURUKOO_PAY_PROVIDER === 'sandbox') delete process.env.KURUKOO_PAY_PROVIDER;

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: process.env.CHAT_ATTACHMENT_BODY_LIMIT || '35mb', verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));

// Public infrastructure boundaries are registered before page rendering.
app.use('/', seoRoutes);
app.use('/api', channelRoutes);
app.use('/api', circleRoutes);
app.use('/api/economic-requests', economicRequestRouter);
app.use('/api/admin', adminRoutes);
app.use('/', adminUiRoutes);
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

// Static assets are infrastructure, not route/business logic.
app.use(express.static(path.join(process.cwd(), 'public')));

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
export { app };
if (process.env.KURUKOO_DISABLE_LISTEN !== 'true') { const server = app.listen(port, host, () => console.log(`[Kurukoo] HTTP server listening on ${host}:${port}`)); server.on('error', error => { console.error('[Kurukoo] HTTP server error:', error); process.exitCode = 1; }); }
