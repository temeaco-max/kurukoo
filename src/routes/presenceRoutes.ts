import express, { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { activatePulse, endPulseSession, getActivePulseProviders } from '../services/nearbyPulse.js';

/** Presence/Pulse HTTP boundary. Presence identity comes from the authenticated
 * session; discovery consumes this shared presence state read-only. */
export function createPresenceRouter(): Router {
    const router = express.Router();

    router.get('/api/stats/pulse', async (_req, res) => {
        const providers = await getActivePulseProviders();
        const pulses = providers.map((provider: any) => ({
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
        if (req.body?.phone && String(req.body.phone) !== phone) {
            return res.status(403).json({ success: false, error: 'Forbidden: presence belongs to the authenticated user' });
        }
        const skill = String(req.body?.skill || '').trim();
        const lat = Number(req.body?.lat);
        const lng = Number(req.body?.lng);
        if (!skill || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ success: false, error: 'skill, valid lat and valid lng are required' });
        }
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

    router.get('/api/pulse/status', authenticateUser, async (req: AuthRequest, res) => {
        const phone = sessionPhone(req);
        if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
        if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
        const providers = await getActivePulseProviders();
        const active = providers.some((provider: any) => String(provider.phone) === phone);
        res.json({ active });
    });

    router.get('/api/pulse/providers', async (_req, res) => {
        const providers = await getActivePulseProviders();
        res.json({ providers });
    });

    return router;
}

export default createPresenceRouter();
