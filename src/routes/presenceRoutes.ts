import express, { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import { activatePulse, endPulseSession, getActivePulseProviders, getPulseState, updatePulsePresence } from '../services/nearbyPulse.js';
import { isControlledPilotEnabled } from '../services/providerCoordination.js';
import { providerMayBeDiscovered } from '../services/providerVerification.js';

/**
 * Authenticated Go Live boundary. Presence identity always comes from the session.
 * Pulse aliases are retained for existing clients, but all writes use the same
 * time-bounded Pulse + provider_presence + Trick Bridge lifecycle.
 */
export function createPresenceRouter(): Router {
  const router = express.Router();
  const sessionPhone = (req: AuthRequest): string | null => req.user?.phone ? String(req.user.phone) : null;

  async function assertPilotPresenceEligibility(phone: string): Promise<void> {
    if (isControlledPilotEnabled() && !await providerMayBeDiscovered(phone)) {
      throw new Error('Evidence-verified provider eligibility is required for controlled-pilot Go Live');
    }
  }

  router.get('/api/stats/pulse', async (_req, res, next) => {
    try {
      const providers = await getActivePulseProviders();
      const counts = providers.reduce((acc: Record<string, number>, provider: any) => {
        const source = provider.source === 'stationary' ? 'stationary' : 'mobile';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});
      res.json({
        success: true,
        activeProviderCount: providers.length,
        sourceCounts: counts,
        pulses: providers.map((provider: any) => ({
          text: `${provider.source === 'mobile' ? 'Mobile' : 'Stationary'} provider active on Pulse`,
          age: 'Live',
          source: provider.source === 'stationary' ? 'stationary' : 'mobile',
        })),
      });
    } catch (error) { next(error); }
  });

  const activate = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const phone = sessionPhone(req);
      if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
      if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden: presence belongs to the authenticated user' });
      const skill = String(req.body?.skill || '').trim();
      const operationMode = String(req.body?.operationMode || 'mobile');
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!skill || !['mobile', 'stationary'].includes(operationMode) || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, error: 'skill, operationMode (mobile or stationary), valid current lat and valid current lng are required' });
      }
      await assertPilotPresenceEligibility(phone);
      const result = await activatePulse(phone, skill, lat, lng, operationMode as 'mobile' | 'stationary');
      return res.status(result.success ? 200 : 409).json(result);
    } catch (error) { next(error); }
  };

  const update = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const phone = sessionPhone(req);
      if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
      if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden: presence belongs to the authenticated user' });
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      const movementMeters = req.body?.movementMeters === undefined ? 100 : Number(req.body.movementMeters);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(movementMeters) || movementMeters < 0 || movementMeters > 100000) {
        return res.status(400).json({ success: false, error: 'valid current lat, lng and movementMeters are required' });
      }
      await assertPilotPresenceEligibility(phone);
      const result = await updatePulsePresence(phone, lat, lng, movementMeters);
      return res.status(result.success ? 200 : 409).json(result);
    } catch (error) { next(error); }
  };

  const deactivate = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const phone = sessionPhone(req);
      if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
      if (req.body?.phone && String(req.body.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
      await endPulseSession(phone);
      return res.json({ success: true, message: 'Go Live ended. Kurukoo will no longer present this Pulse session as active.' });
    } catch (error) { next(error); }
  };

  router.post('/api/presence/go-live', authenticateUser, activate);
  router.post('/api/presence/update', authenticateUser, update);
  router.post('/api/presence/end', authenticateUser, deactivate);
  router.get('/api/presence/me', authenticateUser, async (req: AuthRequest, res, next) => {
    try {
      const phone = sessionPhone(req);
      if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
      return res.json({ success: true, presence: await getPulseState(phone) });
    } catch (error) { next(error); }
  });

  router.post('/api/pulse/live', authenticateUser, activate);
  router.post('/api/pulse/activate', authenticateUser, activate);
  router.post('/api/pulse/update', authenticateUser, update);
  router.post('/api/pulse/deactivate', authenticateUser, deactivate);
  router.get('/api/pulse/status', authenticateUser, async (req: AuthRequest, res, next) => {
    try {
      const phone = sessionPhone(req);
      if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
      if (req.query.phone && String(req.query.phone) !== phone) return res.status(403).json({ success: false, error: 'Forbidden' });
      return res.json(await getPulseState(phone));
    } catch (error) { next(error); }
  });

  router.get('/api/pulse/providers', async (_req, res, next) => {
    try {
      const providers = await getActivePulseProviders();
      return res.json({
        providers: providers.map((provider: any) => ({
          source: provider.source === 'stationary' ? 'stationary' : 'mobile',
          skill: String(provider.skill || 'service provider'),
          displayName: String(provider.name || 'Verified provider'),
          liveUntil: String(provider.live_until || ''),
        })),
      });
    } catch (error) { next(error); }
  });

  return router;
}

export default createPresenceRouter();
