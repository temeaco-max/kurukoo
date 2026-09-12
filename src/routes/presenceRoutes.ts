/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import express, { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { activatePulse, endPulseSession, getActivePulseProviders, getPulseReadiness, toPublicPulseProviders } from '../services/nearbyPulse.js';
import { listContacts } from '../services/identityContactService.js';

/** Presence/Pulse HTTP boundary. Presence identity comes from the authenticated
 * session; public discovery consumes only the sanitized Pulse projection. */
export function createPresenceRouter(): Router {
    const router = express.Router();

    router.get('/api/stats/pulse', async (_req, res) => {
        const providers = await getActivePulseProviders();
        const pulses = providers.map((provider) => ({
            text: `${provider.source === 'mobile' ? 'Mobile' : 'Stationary'} provider active on Pulse`,
            age: 'Live',
            source: provider.source,
        }));
        res.json({ success: true, activeProviderCount: providers.length, pulses });
    });

    const sessionPhone = (req: AuthRequest): string | null => req.user?.phone ? String(req.user.phone) : null;

    const activate = async (req: AuthRequest, res: express.Response) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden: presence belongs to the authenticated user' });
        const skill = String(req.body?.skill || '').trim();
        const lat = Number(req.body?.lat); const lng = Number(req.body?.lng);
        if (!skill || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ success: false, error: 'skill, valid lat and valid lng are required' });
        return res.json(await activatePulse(phone, skill, lat, lng));
    };

    router.post('/api/pulse/live', authenticateUser, activate);
    router.post('/api/pulse/activate', authenticateUser, activate);

    router.post('/api/pulse/deactivate', authenticateUser, async (req: AuthRequest, res) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
        await endPulseSession(phone);
        res.json({ success: true, message: 'Pulse session deactivated.' });
    });

    router.get('/api/pulse/readiness', authenticateUser, async (req: AuthRequest, res) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
        res.json({ success: true, ...(await getPulseReadiness(phone)) });
    });

    router.get('/api/pulse/status', authenticateUser, async (req: AuthRequest, res) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
        const providers = await getActivePulseProviders();
        res.json({ active: providers.some((provider) => provider.phone === phone) });
    });

    router.get('/api/pulse/providers', async (_req, res) => {
        const providers = await getActivePulseProviders();
        // Never return exact provider coordinates or phone identifiers to anonymous consumers.
        res.json({ providers: toPublicPulseProviders(providers) });
    });

    /** Authenticated Radar/Pulse projection. It reuses relationship-visible
     * contacts and the existing live Pulse store; no parallel presence store. */
    router.get('/api/presence/overview', authenticateUser, async (req: AuthRequest, res) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        try {
            const [contacts, pulseProviders] = await Promise.all([listContacts(phone), getActivePulseProviders()]);
            const human = contacts.filter((contact) => contact.participantKind === 'human');
            const providers = contacts.filter((contact) => contact.participantKind === 'provider' || contact.provider?.verified);
            const agents = contacts.filter((contact) => contact.participantKind === 'agent');
            return res.json({
                success: true,
                self: { pulseActive: pulseProviders.some((provider) => provider.phone === phone) },
                counts: {
                    contacts: contacts.length,
                    human: human.length,
                    providers: providers.length,
                    agents: agents.length,
                    available: contacts.filter((contact) => contact.presence === 'available').length,
                    offline: contacts.filter((contact) => contact.presence === 'offline').length,
                    unknown: contacts.filter((contact) => contact.presence === 'unknown').length,
                    livePulseProviders: pulseProviders.length,
                },
                contacts: contacts.map((contact) => ({
                    identityId: contact.identityId,
                    displayName: contact.displayName,
                    participantKind: contact.participantKind,
                    presence: contact.presence,
                    provider: contact.provider ? { verified: contact.provider.verified, type: contact.provider.type, available: contact.provider.available } : null,
                    communication: contact.communication,
                })),
                privacy: { relationshipScoped: true, exactLocationExposed: false, phoneIdentifiersExposed: false, publicPulseProviderIdentitiesExposed: false },
            });
        } catch {
            return res.status(500).json({ success: false, error: 'Unable to load presence overview' });
        }
    });

    return router;
}

export default createPresenceRouter();
