import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { requestRide } from '../services/quickRideDispatchService.js';
import { getRideVehicleOptions } from '../services/rideDispatchContract.js';

const router = Router();

router.get('/rides/options', authenticateUser, (_req: AuthRequest, res) => {
  res.json({ success: true, options: getRideVehicleOptions(), default: 'any' });
});

router.post('/rides/quick', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const ownerPhone = String(req.user?.phone || '');
    const result = await requestRide({
      ownerPhone,
      originLatitude: req.body?.originLatitude ?? req.body?.latitude,
      originLongitude: req.body?.originLongitude ?? req.body?.longitude,
      originLabel: req.body?.originLabel ?? req.body?.pickupLabel,
      destinationLabel: req.body?.destinationLabel ?? req.body?.destination,
      destinationLatitude: req.body?.destinationLatitude,
      destinationLongitude: req.body?.destinationLongitude,
      vehicleType: req.body?.vehicleType,
      pickupAt: req.body?.pickupAt,
      passengers: req.body?.passengers,
      note: req.body?.note,
      maxProviders: req.body?.maxProviders,
    });
    res.status(201).json({
      success: true,
      request: result,
      dispatch: {
        mode: 'live_broadcast',
        defaultVehicleChoice: result.vehicleType === 'any',
        leadChargingEvent: 'provider_acceptance',
        communication: 'WebRTC provider session after acceptance',
      },
    });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to request a ride.' });
  }
});

export default router;
