import dotenv from 'dotenv';
dotenv.config();

// Validate and set defaults for critical environment variables from .env.example.
// Sandbox is a development/test default only; production must fail closed until
// a real payment provider is explicitly configured.
if (process.env.NODE_ENV !== 'production' && !process.env.KURUKOO_PAY_PROVIDER) process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
if (!process.env.CREDIT_ECONOMY_ENABLED) process.env.CREDIT_ECONOMY_ENABLED = 'true';

console.log(`[Kurukoo Startup] Environment initialized. PORT=${process.env.PORT || 3000}, Pay Provider=${process.env.KURUKOO_PAY_PROVIDER || 'unconfigured'}`);

import { purgeExpiredData, exportUserData, deleteUserData } from './services/dataRetention.js';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { getDb, saveDb, searchUserMessages, searchMessagesByKeyword, getSystemSetting, setSystemSetting } from './database.js';
import { authenticateUser, authenticateAdmin, AuthRequest } from './middleware/auth.js';
import jwt from 'jsonwebtoken';
import { routeIntent } from './services/intentRouter.js';
import { finalizeOrder } from './services/orderFinalizer.js';
import { addPoints, deductPoints, getPointsBalance, addCredits } from './services/pointsEngine.js';
import { handleUssdRequest } from './ussd/menus.js';
import { handleWhatsAppWebhook } from './channels/whatsapp.js';
import { handleTelegramWebhook } from './channels/telegram.js';
import { handleSmsWebhook } from './channels/sms.js';
import { dispatchWebhook } from './channels/channelRegistry.js';
import { activatePulse, endPulseSession, getActivePulseProviders, canActivatePulse } from './services/nearbyPulse.js';
import { isOnboarding, handleOnboardingInput, onboardNewUser } from './services/progressiveOnboarding.js';
import { runEscrowPass } from './services/tradeEngine.js';
import { createWebRTCRoom, getRoomPeers } from './services/webrtcSignalling.js';
import { submitSurveyResponse } from './services/surveyEngine.js';
import { getAllBlogArticles, getBlogArticleBySlug } from './services/contentManager.js';
import { getAdCampaigns, createAdCampaign, spendAdCampaign, matchAdCampaigns, seedDemoAdCampaigns } from './services/adManager.js';
import { getCategoryTrends, getGeographicDensity, getMarketIntelData } from './services/analyticsEngine.js';
import { getPricing, getAllPricing, getPlan, updatePlan, createPlan, deletePlan } from './services/pricingService.js';
import { getAllCommissions, getCommission, updateCommission } from './services/commissionService.js';
import { updateSessionInteraction, startSessionManagerScheduler, checkAndTriggerKeepAlives } from './services/sessionManager.js';
import { recordKeepAliveEvent, getKeepAliveAnalyticsStats } from './services/analytics.js';
import fcmRouter from './server.js';
import { schedulePost } from './services/socialScheduler.js';
import { getAvailableTasks, acceptTask, completeTask } from './services/microTasks.js';
import { getProfile, updateProfile } from './services/memoryProfile.js';
import { generateReferralCode, trackReferral, claimReferral } from './services/referralService.js';
import { submitRating } from './services/ratingService.js';
import { createMoneyCircle, joinMoneyCircle, recordContribution, getCircleDetails, processBuyingCircleDiscount, broadcastSafetyCircleAlert } from './services/moneyCircle.js';
import { getQuickReplies } from './services/quickRepliesService.js';
import { getDailyPick } from './services/dailyPicks.js';
import { getAllAIAgents, getAIAgentById, createAIAgent, updateAIAgent, deleteAIAgent, cloneAIAgent, executeAgentTask } from './services/aiAgentService.js';
import { bookAppointment } from './services/appointmentService.js';
import { createDispute, getDisputeStatus, resolveDispute, escalateDispute } from './services/disputeResolution.js';
import { createEscrow, releaseEscrow, refundEscrow } from './services/escrow.js';
import { sourceProduct } from './services/productSourcing.js';
import { startContactSyncService } from './services/contactSyncService.js';
import { startDeliveryStatusService, updateDeliveryStatus } from './services/deliveryService.js';
import { streamUnifiedAI } from './services/unifiedAiEngine.js';
import { getGitHubSyncStatus, listGitHubFiles, getGitHubDiff, pullFromGitHub, pushToGitHub } from './services/githubService.js';

import {
    getRobotsTxt, getLlmsTxt, getSitemapIndex, getChildSitemap,
    getSeoPage, getSeoSettings, updateSeoSettings, getSchemaForPage, getFaqForPage,
    getRedirects, addRedirect, deleteRedirect, matchRedirect,
    log404, get404Log, ignore404,
    getAllSeoPages, upsertSeoPage, deleteSeoPage,
    getFaqForPage as getFaqs, addFaq, updateFaq, deleteFaq, getAllFaqForPage,
    getSchemaTemplates, upsertSchemaTemplate, deleteSchemaTemplate,
    getInternalLinks, addInternalLink, deleteInternalLink, getOrphanPages,
    getKeywords, upsertKeyword, deleteKeyword, getRankings,
    getBacklinks, addBacklink, deleteBacklink,
    getContentCalendar, addContentCalendar, updateContentCalendar, deleteContentCalendar,
    getContentBriefs, addContentBrief, deleteContentBrief,
    runSeoAudit, getAuditResults, getLatestAudits, getSeoDashboard, getHealthScore, runFullAudit,
    getImageMeta, upsertImageMeta, deleteImageMeta,
    generateFaqsForPageWithAI, generateContentBriefWithAI, generateAltTextForImage, generateSeoTitle, generateSeoDescription
} from './services/seoService.js';
import { queryGroq } from './services/groqService.js';
import { createOpenIntention, resolveOpenIntention, getIntentions, incrementAttempt } from './services/deferredRequestService.js';
import { getOpportunitiesForFeed, actOnOpportunity, dismissOpportunity } from './services/opportunityEngine.js';

export function registerLegacyRoutes(app: express.Application) {
    app.set('trust proxy', 1);
    app.use('/api/chat/attachments', express.json({ limit: process.env.CHAT_ATTACHMENT_BODY_LIMIT || '35mb' }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Chat is mounted by the composition root. LegacyApp does not own /api/chat.
    app.set('view engine', 'ejs');
    app.set('views', path.join(process.cwd(), 'views'));

    app.use(async (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/webhook') || req.path.startsWith('/ussd') || req.path.includes('.')) return next();
        try { const redirect = await matchRedirect(req.path); if (redirect) return res.redirect(redirect.status_code, redirect.to_url); }
        catch (e) { console.error('SEO redirect middleware error:', e); }
        next();
    });

    app.get('/robots.txt', async (_req, res) => { try { res.header('Content-Type', 'text/plain'); res.header('Cache-Control', 'public, max-age=3600'); res.send(await getRobotsTxt()); } catch (e) { console.error('robots.txt error:', e); res.status(500).send('Error generating robots.txt'); } });
    app.get('/llms.txt', async (_req, res) => { try { res.header('Content-Type', 'text/plain'); res.header('Cache-Control', 'public, max-age=3600'); res.send(await getLlmsTxt()); } catch (e) { console.error('llms.txt error:', e); res.status(500).send('Error generating llms.txt'); } });

    app.get('/*.md', async (req, res, next) => {
        try {
            const rawPath = req.path.slice(0, -3); if (rawPath === '/llms') return next();
            const seoData = await fetchSeoData(rawPath); const title = seoData.seo?.title || 'Kurukoo Page'; const description = seoData.seo?.meta_description || ''; const faqs = seoData.faqs || [];
            let mdContent = `# ${title}\n\n${description}\n\n`;
            if (faqs.length) { mdContent += `## Frequently Asked Questions\n\n`; for (const f of faqs) mdContent += `### ${f.question}\n${f.answer}\n\n`; }
            mdContent += `\n---\n*Source: https://kurukoo.com${rawPath}*`;
            res.header('Content-Type', 'text/markdown; charset=utf-8'); res.header('Cache-Control', 'public, max-age=3600'); res.send(mdContent);
        } catch { next(); }
    });

    app.get('/sitemap.xml', async (_req, res) => { try { res.header('Content-Type', 'application/xml'); res.header('Cache-Control', 'public, max-age=3600'); res.send(await getSitemapIndex()); } catch (e) { console.error('Sitemap index error:', e); res.status(500).send('Error generating sitemap index'); } });
    for (const type of ['pages', 'categories', 'blog', 'programmatic']) {
        app.get(`/sitemap-${type}.xml`, async (_req, res) => { try { res.header('Content-Type', 'application/xml'); res.header('Cache-Control', 'public, max-age=3600'); res.send(await getChildSitemap(type)); } catch (e) { console.error(`sitemap-${type} error:`, e); res.status(500).send('Error'); } });
    }

    app.use(express.static(path.join(process.cwd(), 'public')));
    app.get('/admin', (_req, res) => res.redirect('/admin/login.html'));
    app.get('/admin/', (_req, res) => res.redirect('/admin/login.html'));
    app.get('/admin/:page', (req, res, next) => { const page = req.params.page; if (!page.endsWith('.html')) { const filePath = path.join(process.cwd(), 'public', 'admin', `${page}.html`); if (fs.existsSync(filePath)) return res.sendFile(filePath); } next(); });

    function getLocale(lang: string = 'en') {
        const filePath = path.join(process.cwd(), 'locales', `${lang}.json`); const fallbackPath = path.join(process.cwd(), 'locales', 'en.json');
        try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8')); if (fs.existsSync(fallbackPath)) return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8')); } catch {}
        return { tagline: 'Your everyday, sorted.' };
    }

    app.post('/api/referral/code', async (req, res) => { const { phone } = req.body; if (!phone) return res.status(400).json({ error: 'Missing phone' }); const code = await generateReferralCode(phone); res.json({ success: true, code }); });
    app.post('/api/referral/claim', async (req, res) => { const { phone, referral_code } = req.body; if (!phone || !referral_code) return res.status(400).json({ error: 'Missing data' }); try { const { findReferrerByCode, trackReferral } = await import('./services/referralService.js'); const referrer_phone = await findReferrerByCode(referral_code.trim().toUpperCase()); if (!referrer_phone) return res.status(400).json({ error: 'Invalid referral code' }); if (referrer_phone === phone) return res.status(400).json({ error: 'You cannot refer yourself' }); await trackReferral(referrer_phone, phone, referral_code.trim().toUpperCase()); res.json({ success: true, message: 'Referral registered successfully. 200 Points reward will activate on your first subscription payment.' }); } catch { res.status(500).json({ error: 'Failed to register referral code' }); } });
    app.post('/api/referral/share-reward', async (req, res) => { const { phone } = req.body; if (!phone) return res.status(400).json({ error: 'Missing phone' }); try { const { awardShareReward } = await import('./services/referralService.js'); res.json({ success: true, rewarded: await awardShareReward(phone) }); } catch { res.status(500).json({ error: 'Failed to award sharing reward' }); } });
    app.post('/api/referral/resolve', async (req, res) => { const { code } = req.body; if (!code) return res.status(400).json({ error: 'Missing code' }); try { const { findReferrerByCode } = await import('./services/referralService.js'); const phone = await findReferrerByCode(code.trim().toUpperCase()); res.json(phone ? { success: true, phone } : { success: false, error: 'Invalid referral code' }); } catch { res.status(500).json({ error: 'Failed to resolve referral code' }); } });
    app.get('/api/referral/stats/:phone', async (req, res) => { const { phone } = req.params; if (!phone) return res.status(400).json({ error: 'Missing phone' }); try { const { getReferralStats } = await import('./services/referralService.js'); res.json({ success: true, stats: await getReferralStats(phone) }); } catch { res.status(500).json({ error: 'Failed to get referral stats' }); } });
    app.post('/api/referral/track', async (req, res) => { const { referrer_phone, referred_phone, referral_code } = req.body; if (!referrer_phone || !referred_phone || !referral_code) return res.status(400).json({ error: 'Missing data' }); try { await trackReferral(referrer_phone, referred_phone, referral_code); res.json({ success: true }); } catch { res.status(500).json({ error: 'Failed to track referral' }); } });
    app.post('/api/referral/claim-reward', async (req, res) => { const { phone, referral_code } = req.body; if (!phone || !referral_code) return res.status(400).json({ error: 'Missing data' }); try { res.json({ success: true, result: await claimReferral(phone, referral_code) }); } catch { res.status(500).json({ error: 'Failed to claim referral reward' }); } });

    // Preserve the extracted legacy module boundary. New platform capabilities must
    // be added to canonical route/domain modules rather than growing this group.
    void getLocale;
    void getSeoPage; void getSeoSettings; void updateSeoSettings; void getSchemaForPage; void getFaqForPage; void getRedirects; void addRedirect; void deleteRedirect; void log404; void get404Log; void ignore404; void getAllSeoPages; void upsertSeoPage; void deleteSeoPage; void getFaqs; void addFaq; void updateFaq; void deleteFaq; void getAllFaqForPage; void getSchemaTemplates; void upsertSchemaTemplate; void deleteSchemaTemplate; void getInternalLinks; void addInternalLink; void deleteInternalLink; void getOrphanPages; void getKeywords; void upsertKeyword; void deleteKeyword; void getRankings; void getBacklinks; void addBacklink; void deleteBacklink; void getContentCalendar; void addContentCalendar; void updateContentCalendar; void deleteContentCalendar; void getContentBriefs; void addContentBrief; void deleteContentBrief; void runSeoAudit; void getAuditResults; void getLatestAudits; void getSeoDashboard; void getHealthScore; void runFullAudit; void getImageMeta; void upsertImageMeta; void deleteImageMeta; void generateFaqsForPageWithAI; void generateContentBriefWithAI; void generateAltTextForImage; void generateSeoTitle; void generateSeoDescription;
    void purgeExpiredData; void exportUserData; void deleteUserData; void searchUserMessages; void searchMessagesByKeyword; void getDb; void saveDb; void getSystemSetting; void setSystemSetting; void authenticateUser; void authenticateAdmin; void AuthRequest; void jwt; void routeIntent; void finalizeOrder; void addPoints; void deductPoints; void getPointsBalance; void addCredits; void handleUssdRequest; void handleWhatsAppWebhook; void handleTelegramWebhook; void handleSmsWebhook; void dispatchWebhook; void activatePulse; void endPulseSession; void getActivePulseProviders; void canActivatePulse; void isOnboarding; void handleOnboardingInput; void onboardNewUser; void runEscrowPass; void createWebRTCRoom; void getRoomPeers; void submitSurveyResponse; void getAllBlogArticles; void getBlogArticleBySlug; void getAdCampaigns; void createAdCampaign; void spendAdCampaign; void matchAdCampaigns; void seedDemoAdCampaigns; void getCategoryTrends; void getGeographicDensity; void getMarketIntelData; void getPricing; void getAllPricing; void getPlan; void updatePlan; void createPlan; void deletePlan; void getAllCommissions; void getCommission; void updateCommission; void updateSessionInteraction; void startSessionManagerScheduler; void checkAndTriggerKeepAlives; void recordKeepAliveEvent; void getKeepAliveAnalyticsStats; void fcmRouter; void schedulePost; void getAvailableTasks; void acceptTask; void completeTask; void getProfile; void updateProfile; void generateReferralCode; void trackReferral; void claimReferral; void submitRating; void createMoneyCircle; void joinMoneyCircle; void recordContribution; void getCircleDetails; void processBuyingCircleDiscount; void broadcastSafetyCircleAlert; void getQuickReplies; void getDailyPick; void getAllAIAgents; void getAIAgentById; void createAIAgent; void updateAIAgent; void deleteAIAgent; void cloneAIAgent; void executeAgentTask; void bookAppointment; void createDispute; void getDisputeStatus; void resolveDispute; void escalateDispute; void createEscrow; void releaseEscrow; void refundEscrow; void sourceProduct; void startContactSyncService; void startDeliveryStatusService; void updateDeliveryStatus; void streamUnifiedAI; void getGitHubSyncStatus; void listGitHubFiles; void getGitHubDiff; void pullFromGitHub; void pushToGitHub; void queryGroq; void createOpenIntention; void resolveOpenIntention; void getIntentions; void incrementAttempt; void getOpportunitiesForFeed; void actOnOpportunity; void dismissOpportunity;
}

async function fetchSeoData(pathname: string): Promise<any> {
    try { return { seo: await getSeoPage(pathname), faqs: await getFaqForPage(pathname) }; }
    catch { return { seo: null, faqs: [] }; }
}
