/**
 * Idempotent wiring: mount all extracted route modules into src/index.ts and
 * neutralize dangerous / duplicated legacy handlers in the monolith.
 *
 * ChatGPT audit discipline:
 *   extract exact handler → contract test → mount → CI → remove original later
 *
 * Run: node scripts/wire-security-routes.mjs  (also prebuild)
 */
import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'src', 'index.ts');
let src = fs.readFileSync(indexPath, 'utf8');

const fullImportBlock = `import authRoutes from './routes/authRoutes.js';
import webrtcRoutes from './routes/webrtcRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import economicRequestRouter from './routes/economicRequestRouter.js';
import createDiscoveryRouter from './routes/discoveryRoutes.js';
import createPresenceRouter from './routes/presenceRoutes.js';
import createContentRouter from './routes/contentRoutes.js';
import createPublicRouter from './routes/publicRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import seoAdminRoutes from './routes/seoAdminRoutes.js';
import { aiRateLimit, webhookRateLimit, paymentRateLimit } from './middleware/rateLimit.js';
import { authenticateUser } from './middleware/auth.js';
`;

// Ensure imports after chatRouter
if (!src.includes("from './routes/authRoutes.js'")) {
  src = src.replace(
    "import chatRouter from './routes/chatRouter.js';",
    `import chatRouter from './routes/chatRouter.js';\n${fullImportBlock}`
  );
} else {
  const ensureImport = (needle, block) => {
    if (!src.includes(needle)) {
      if (src.includes("from './routes/adminRoutes.js'")) {
        src = src.replace(
          "import adminRoutes from './routes/adminRoutes.js';",
          `import adminRoutes from './routes/adminRoutes.js';\n${block}`
        );
      } else if (src.includes("from './routes/webrtcRoutes.js'")) {
        src = src.replace(
          "import webrtcRoutes from './routes/webrtcRoutes.js';",
          `import webrtcRoutes from './routes/webrtcRoutes.js';\n${block}`
        );
      } else if (src.includes("from './routes/authRoutes.js'")) {
        src = src.replace(
          "import authRoutes from './routes/authRoutes.js';",
          `import authRoutes from './routes/authRoutes.js';\n${block}`
        );
      }
    }
  };
  ensureImport("from './routes/pricingRoutes.js'", "import pricingRoutes from './routes/pricingRoutes.js';\nimport subscriptionRoutes from './routes/subscriptionRoutes.js';\nimport paymentRoutes from './routes/paymentRoutes.js';");
  ensureImport("from './routes/userRoutes.js'", "import userRoutes from './routes/userRoutes.js';");
  ensureImport("from './routes/economicRequestRouter.js'", "import economicRequestRouter from './routes/economicRequestRouter.js';");
  ensureImport("from './routes/discoveryRoutes.js'", "import createDiscoveryRouter from './routes/discoveryRoutes.js';\nimport createPresenceRouter from './routes/presenceRoutes.js';\nimport createContentRouter from './routes/contentRoutes.js';\nimport createPublicRouter from './routes/publicRoutes.js';");
  ensureImport("from './routes/channelRoutes.js'", "import channelRoutes from './routes/channelRoutes.js';\nimport systemRoutes from './routes/systemRoutes.js';");
  ensureImport("from './routes/adminRoutes.js'", "import adminRoutes from './routes/adminRoutes.js';");
  ensureImport("from './routes/seoAdminRoutes.js'", "import seoAdminRoutes from './routes/seoAdminRoutes.js';");
  if (!src.includes("from './middleware/rateLimit.js'")) {
    src = src.replace(
      "import chatRouter from './routes/chatRouter.js';",
      `import chatRouter from './routes/chatRouter.js';\nimport { aiRateLimit, webhookRateLimit, paymentRateLimit } from './middleware/rateLimit.js';`
    );
  }
}

const mountBlock = `app.use('/api/chat', chatRouter);
app.use('/api/auth', authRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api', paymentRoutes);
app.use('/api', userRoutes);
app.use('/api/economic', authenticateUser, economicRequestRouter);
app.use(createDiscoveryRouter());
app.use(createPresenceRouter());
app.use(createContentRouter());
app.use(createPublicRouter());
app.use(channelRoutes);
app.use(systemRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/seo', seoAdminRoutes);
app.use(['/api/chat/stream', '/api/chat'], aiRateLimit);
app.use(['/webhook', '/ussd'], webhookRateLimit);
app.use(['/api/escrow', '/api/points/topup', '/api/credits/topup', '/api/subscription'], paymentRateLimit);`;

if (!src.includes("app.use('/api/auth'")) {
  src = src.replace("app.use('/api/chat', chatRouter);", mountBlock);
} else {
  if (!src.includes("app.use('/api/subscription'")) {
    src = src.replace(
      "app.use('/api/webrtc', webrtcRoutes);",
      `app.use('/api/webrtc', webrtcRoutes);\napp.use('/api/pricing', pricingRoutes);\napp.use('/api/subscription', subscriptionRoutes);\napp.use('/api', paymentRoutes);`
    );
  }
  if (!src.includes("app.use('/api', userRoutes)")) {
    const anchor = src.includes("app.use('/api', paymentRoutes)")
      ? "app.use('/api', paymentRoutes);"
      : "app.use('/api/subscription', subscriptionRoutes);";
    src = src.replace(
      anchor,
      `${anchor}\napp.use('/api', userRoutes);\napp.use('/api/economic', authenticateUser, economicRequestRouter);\napp.use(createDiscoveryRouter());\napp.use(createPresenceRouter());\napp.use(createContentRouter());\napp.use(createPublicRouter());\napp.use(channelRoutes);\napp.use(systemRoutes);`
    );
  }
  if (!src.includes("app.use('/api/admin'")) {
    const adminAnchor = src.includes('app.use(systemRoutes)')
      ? 'app.use(systemRoutes);'
      : src.includes('app.use(channelRoutes)')
        ? 'app.use(channelRoutes);'
        : "app.use('/api/chat', chatRouter);";
    src = src.replace(adminAnchor, `${adminAnchor}\napp.use('/api/admin', adminRoutes);`);
  }
  if (!src.includes("app.use('/api/admin/seo'")) {
    const seoAnchor = src.includes("app.use('/api/admin', adminRoutes)")
      ? "app.use('/api/admin', adminRoutes);"
      : 'app.use(systemRoutes);';
    src = src.replace(seoAnchor, `${seoAnchor}\napp.use('/api/admin/seo', seoAdminRoutes);`);
  }
}

// ── Neutralize legacy dangerous / duplicate handlers ───────────────────

if (src.includes("// API: Auth Login & SSO Synchronization") && src.includes("app.post('/api/auth/login'")) {
  src = src.replace(
    "// API: Auth Login & SSO Synchronization\napp.post('/api/auth/login'",
    "// Legacy login superseded by authRoutes OTP. Path renamed so /api/auth/* is owned by authRoutes.\napp.post('/api/auth/login-legacy'"
  );
}

if (src.includes("app.post('/api/webrtc/create'") && !src.includes("/api/webrtc/create-legacy")) {
  src = src.replace(
    "// WebRTC Signaling API\napp.post('/api/webrtc/create'",
    "// Legacy WebRTC superseded by webrtcRoutes (JWT required).\napp.post('/api/webrtc/create-legacy'"
  );
  src = src.replace("app.get('/api/webrtc/peers'", "app.get('/api/webrtc/peers-legacy'");
}

if (src.includes("app.post('/api/subscription/upgrade'") && src.includes("const { phone, plan, country } = req.body;")) {
  src = src.replace(
    /app\.post\('\/api\/subscription\/upgrade', async \(req, res\) => \{[\s\S]*?const \{ phone, plan, country \} = req\.body;[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Failed to upgrade subscription' \}\);\n    \}\n\}\);/,
    `// DISABLED_CLIENT_TRUSTED_SUBSCRIPTION — identity + payment gated in subscriptionRoutes
app.post('/api/subscription/upgrade-legacy-disabled', async (req, res) => {
    return res.status(410).json({
        error: 'Gone. Use authenticated POST /api/subscription/upgrade (JWT). Phone from session only; payment_ref required outside sandbox.',
    });
});`
  );
}

if (src.includes("app.post('/api/provider/subscribe'") && src.includes("const { phone, tier } = req.body;")) {
  src = src.replace(
    /app\.post\('\/api\/provider\/subscribe', async \(req, res\) => \{[\s\S]*?const \{ phone, tier \} = req\.body;[\s\S]*?res\.status\(500\)\.json\(\{ success: false, error: 'Internal error' \}\);\n    \}\n\}\);/,
    `// DISABLED_CLIENT_TRUSTED_PROVIDER_SUB
app.post('/api/provider/subscribe', async (req, res) => {
    return res.status(410).json({
        success: false,
        error: 'Gone. Use authenticated POST /api/subscription/provider with JWT.',
    });
});`
  );
}

const pulseRenames = [
  ["app.post('/api/pulse/live'", "app.post('/api/pulse/live-legacy'"],
  ["app.post('/api/pulse/activate'", "app.post('/api/pulse/activate-legacy'"],
  ["app.post('/api/pulse/deactivate'", "app.post('/api/pulse/deactivate-legacy'"],
  ["app.get('/api/pulse/status'", "app.get('/api/pulse/status-legacy'"],
  ["app.get('/api/pulse/providers'", "app.get('/api/pulse/providers-legacy'"],
  ["app.get('/api/stats/pulse'", "app.get('/api/stats/pulse-legacy'"],
  ["app.get('/api/blog'", "app.get('/api/blog-legacy'"],
  ["app.get('/api/blog/:slug'", "app.get('/api/blog-legacy/:slug'"],
  ["app.get('/api/discover/map'", "app.get('/api/discover/map-legacy'"],
  ["app.get('/health'", "app.get('/health-legacy'"],
  ["app.post('/webhook/whatsapp'", "app.post('/webhook/whatsapp-legacy'"],
  ["app.post('/webhook/telegram'", "app.post('/webhook/telegram-legacy'"],
  ["app.post('/webhook/sms'", "app.post('/webhook/sms-legacy'"],
  ["app.post('/ussd'", "app.post('/ussd-legacy'"],
  ["app.get('/api/profile'", "app.get('/api/profile-legacy'"],
  ["app.post('/api/profile/update'", "app.post('/api/profile/update-legacy'"],
  ["app.post('/api/profile/availability'", "app.post('/api/profile/availability-legacy'"],
  ["app.get('/api/points/balance'", "app.get('/api/points/balance-legacy'"],
  ["app.post('/api/points/topup'", "app.post('/api/points/topup-legacy'"],
  ["app.post('/api/credits/topup'", "app.post('/api/credits/topup-legacy'"],
  ["app.post('/api/admin/auth'", "app.post('/api/admin/auth-legacy'"],
  ["app.get('/api/admin/tickets'", "app.get('/api/admin/tickets-legacy'"],
  ["app.post('/api/admin/tickets/reply'", "app.post('/api/admin/tickets/reply-legacy'"],
  ["app.post('/api/admin/disputes/resolve'", "app.post('/api/admin/disputes/resolve-legacy'"],
  ["app.post('/api/admin/disputes/escalate'", "app.post('/api/admin/disputes/escalate-legacy'"],
  ["app.get('/api/admin/stats'", "app.get('/api/admin/stats-legacy'"],
  ["app.get('/api/admin/analytics/trends'", "app.get('/api/admin/analytics/trends-legacy'"],
  ["app.get('/api/admin/analytics/sales'", "app.get('/api/admin/analytics/sales-legacy'"],
  ["app.get('/api/admin/users'", "app.get('/api/admin/users-legacy'"],
  ["app.post('/api/admin/users/bulk-update'", "app.post('/api/admin/users/bulk-update-legacy'"],
  ["app.get('/api/admin/skill-flows'", "app.get('/api/admin/skill-flows-legacy'"],
  ["app.post('/api/admin/skill-flows'", "app.post('/api/admin/skill-flows-legacy'"],
  ["app.delete('/api/admin/skill-flows/:skill'", "app.delete('/api/admin/skill-flows-legacy/:skill'"],
  ["app.get('/api/admin/pulse-sessions'", "app.get('/api/admin/pulse-sessions-legacy'"],
  ["app.get('/api/admin/artists'", "app.get('/api/admin/artists-legacy'"],
  ["app.post('/api/admin/artists/verify'", "app.post('/api/admin/artists/verify-legacy'"],
  ["app.get('/api/admin/referrals'", "app.get('/api/admin/referrals-legacy'"],
  ["app.get('/api/admin/revenue'", "app.get('/api/admin/revenue-legacy'"],
  ["app.get('/api/admin/marketing'", "app.get('/api/admin/marketing-legacy'"],
  ["app.get('/api/admin/social'", "app.get('/api/admin/social-legacy'"],
  ["app.post('/api/admin/social'", "app.post('/api/admin/social-legacy'"],
  ["app.get('/api/admin/partnerships'", "app.get('/api/admin/partnerships-legacy'"],
  ["app.post('/api/admin/verify_provider'", "app.post('/api/admin/verify_provider-legacy'"],
  ["app.get('/api/admin/scam_reports'", "app.get('/api/admin/scam_reports-legacy'"],
  ["app.get('/api/admin/content'", "app.get('/api/admin/content-legacy'"],
  ["app.get('/api/admin/content/:slug'", "app.get('/api/admin/content-legacy/:slug'"],
  ["app.post('/api/admin/content'", "app.post('/api/admin/content-legacy'"],
  ["app.post('/api/admin/content/generate'", "app.post('/api/admin/content/generate-legacy'"],
  ["app.get('/api/admin/future_plans'", "app.get('/api/admin/future_plans-legacy'"],
  ["app.get('/api/admin/settings'", "app.get('/api/admin/settings-legacy'"],
  ["app.post('/api/admin/settings'", "app.post('/api/admin/settings-legacy'"],
  ["app.get('/api/admin/ai-agents'", "app.get('/api/admin/ai-agents-legacy'"],
  ["app.get('/api/admin/ai-agents/:id'", "app.get('/api/admin/ai-agents-legacy/:id'"],
  ["app.post('/api/admin/ai-agents'", "app.post('/api/admin/ai-agents-legacy'"],
  ["app.put('/api/admin/ai-agents/:id'", "app.put('/api/admin/ai-agents-legacy/:id'"],
  ["app.delete('/api/admin/ai-agents/:id'", "app.delete('/api/admin/ai-agents-legacy/:id'"],
  ["app.post('/api/admin/ai-agents/:id/clone'", "app.post('/api/admin/ai-agents-legacy/:id/clone'"],
  ["app.post('/api/admin/ai-agents/:id/execute'", "app.post('/api/admin/ai-agents-legacy/:id/execute'"],
  ["app.get('/api/admin/commissions'", "app.get('/api/admin/commissions-legacy'"],
  ["app.put('/api/admin/commissions/:id'", "app.put('/api/admin/commissions-legacy/:id'"],
  // SEO admin → seoAdminRoutes
  ["app.get('/api/admin/seo/dashboard'", "app.get('/api/admin/seo/dashboard-legacy'"],
  ["app.get('/api/admin/seo/health'", "app.get('/api/admin/seo/health-legacy'"],
  ["app.get('/api/admin/seo/settings'", "app.get('/api/admin/seo/settings-legacy'"],
  ["app.post('/api/admin/seo/settings'", "app.post('/api/admin/seo/settings-legacy'"],
  ["app.get('/api/admin/seo/pages'", "app.get('/api/admin/seo/pages-legacy'"],
  ["app.post('/api/admin/seo/pages'", "app.post('/api/admin/seo/pages-legacy'"],
  ["app.delete('/api/admin/seo/pages'", "app.delete('/api/admin/seo/pages-legacy'"],
  ["app.get('/api/admin/seo/faqs'", "app.get('/api/admin/seo/faqs-legacy'"],
  ["app.post('/api/admin/seo/faqs'", "app.post('/api/admin/seo/faqs-legacy'"],
  ["app.put('/api/admin/seo/faqs/:id'", "app.put('/api/admin/seo/faqs-legacy/:id'"],
  ["app.delete('/api/admin/seo/faqs/:id'", "app.delete('/api/admin/seo/faqs-legacy/:id'"],
  ["app.get('/api/admin/seo/keywords'", "app.get('/api/admin/seo/keywords-legacy'"],
  ["app.post('/api/admin/seo/keywords'", "app.post('/api/admin/seo/keywords-legacy'"],
  ["app.delete('/api/admin/seo/keywords/:id'", "app.delete('/api/admin/seo/keywords-legacy/:id'"],
  ["app.get('/api/admin/seo/redirects'", "app.get('/api/admin/seo/redirects-legacy'"],
  ["app.post('/api/admin/seo/redirects'", "app.post('/api/admin/seo/redirects-legacy'"],
  ["app.delete('/api/admin/seo/redirects/:id'", "app.delete('/api/admin/seo/redirects-legacy/:id'"],
  ["app.get('/api/admin/seo/schemas'", "app.get('/api/admin/seo/schemas-legacy'"],
  ["app.post('/api/admin/seo/schemas'", "app.post('/api/admin/seo/schemas-legacy'"],
  ["app.delete('/api/admin/seo/schemas/:id'", "app.delete('/api/admin/seo/schemas-legacy/:id'"],
  ["app.get('/api/admin/seo/internal-links'", "app.get('/api/admin/seo/internal-links-legacy'"],
  ["app.post('/api/admin/seo/internal-links'", "app.post('/api/admin/seo/internal-links-legacy'"],
  ["app.delete('/api/admin/seo/internal-links/:id'", "app.delete('/api/admin/seo/internal-links-legacy/:id'"],
  ["app.get('/api/admin/seo/backlinks'", "app.get('/api/admin/seo/backlinks-legacy'"],
  ["app.post('/api/admin/seo/backlinks'", "app.post('/api/admin/seo/backlinks-legacy'"],
  ["app.delete('/api/admin/seo/backlinks/:id'", "app.delete('/api/admin/seo/backlinks-legacy/:id'"],
  ["app.get('/api/admin/seo/content-calendar'", "app.get('/api/admin/seo/content-calendar-legacy'"],
  ["app.post('/api/admin/seo/content-calendar'", "app.post('/api/admin/seo/content-calendar-legacy'"],
  ["app.put('/api/admin/seo/content-calendar/:id'", "app.put('/api/admin/seo/content-calendar-legacy/:id'"],
  ["app.delete('/api/admin/seo/content-calendar/:id'", "app.delete('/api/admin/seo/content-calendar-legacy/:id'"],
  ["app.get('/api/admin/seo/content-briefs'", "app.get('/api/admin/seo/content-briefs-legacy'"],
  ["app.post('/api/admin/seo/content-briefs'", "app.post('/api/admin/seo/content-briefs-legacy'"],
  ["app.delete('/api/admin/seo/content-briefs/:id'", "app.delete('/api/admin/seo/content-briefs-legacy/:id'"],
  ["app.get('/api/admin/seo/404-log'", "app.get('/api/admin/seo/404-log-legacy'"],
  ["app.post('/api/admin/seo/404-log/ignore/:id'", "app.post('/api/admin/seo/404-log/ignore-legacy/:id'"],
  ["app.post('/api/admin/seo/generate-alt-text'", "app.post('/api/admin/seo/generate-alt-text-legacy'"],
  ["app.post('/api/admin/seo/generate-faqs'", "app.post('/api/admin/seo/generate-faqs-legacy'"],
  ["app.post('/api/admin/seo/generate-brief'", "app.post('/api/admin/seo/generate-brief-legacy'"],
  ["app.post('/api/admin/seo/run-audit'", "app.post('/api/admin/seo/run-audit-legacy'"],
  ["app.get('/api/admin/seo/audits'", "app.get('/api/admin/seo/audits-legacy'"],
  ["app.get('/api/admin/seo/rankings'", "app.get('/api/admin/seo/rankings-legacy'"],
  ["app.get('/api/admin/seo/orphans'", "app.get('/api/admin/seo/orphans-legacy'"],
  ["app.get('/api/admin/seo/image-meta'", "app.get('/api/admin/seo/image-meta-legacy'"],
  ["app.post('/api/admin/seo/image-meta/generate-alt'", "app.post('/api/admin/seo/image-meta/generate-alt-legacy'"],
  ["app.delete('/api/admin/seo/image-meta/:id'", "app.delete('/api/admin/seo/image-meta-legacy/:id'"],
];

for (const [from, to] of pulseRenames) {
  if (src.includes(from) && !src.includes(to)) {
    src = src.replace(from, to);
  }
}

if (src.includes('subscription_tier = COALESCE(?, subscription_tier)') && !src.includes('// TIER_NOT_CLIENT_SETTABLE')) {
  src = src.replace(
    `const { 
        phone, name, location, country, subscription_tier, 
        skills, operation_mode, hourly_rate, service_radius_km, 
        transport_mode, pricing_model, payment_method, equipment, is_available
    } = req.body;`,
    `// TIER_NOT_CLIENT_SETTABLE — subscription_tier only via subscriptionService after payment
    const { 
        phone, name, location, country, 
        skills, operation_mode, hourly_rate, service_radius_km, 
        transport_mode, pricing_model, payment_method, equipment, is_available
    } = req.body;`
  );
  src = src.replace(
    `db.run(\`INSERT INTO memory_profiles (phone, name, location, country, subscription_tier) VALUES (?, ?, ?, ?, ?)\`, 
                [phone, name || 'New User', location || 'Ibadan', country || 'ng', subscription_tier || 'Base']);`,
    `db.run(\`INSERT INTO memory_profiles (phone, name, location, country, subscription_tier) VALUES (?, ?, ?, ?, ?)\`, 
                [phone, name || 'New User', location || 'Ibadan', country || 'ng', 'Base']);`
  );
  src = src.replace(
    `db.run(\`UPDATE memory_profiles SET name = COALESCE(?, name), location = COALESCE(?, location), country = COALESCE(?, country), subscription_tier = COALESCE(?, subscription_tier) WHERE phone = ?\`,
                [name, location, country, subscription_tier, phone]);`,
    `db.run(\`UPDATE memory_profiles SET name = COALESCE(?, name), location = COALESCE(?, location), country = COALESCE(?, country) WHERE phone = ?\`,
                [name, location, country, phone]);`
  );
}

fs.writeFileSync(indexPath, src);
console.log('Wired all extracted routers (admin + seoAdmin); neutralized legacy handlers.');
