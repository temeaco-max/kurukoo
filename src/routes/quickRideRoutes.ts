import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { requestRide } from '../services/quickRideDispatchService.js';
import { getRideVehicleOptions } from '../services/rideDispatchContract.js';

const router = Router();

router.get('/rides/options', authenticateUser, (_req, res) => res.json({ success: true, vehicles: getRideVehicleOptions(), dispatchModel: 'broadcast_then_provider_accept', leadCharge: 'on_provider_accept', communication: 'request_scoped_webrtc', locationModel: 'interval_gps_plus_trickbridge' }));
router.post('/rides/request', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const result = await requestRide({
      ownerPhone: String(req.user?.phone || ''),
      originLatitude: req.body?.originLatitude ?? req.body?.latitude,
      originLongitude: req.body?.originLongitude ?? req.body?.longitude,
      originLabel: req.body?.originLabel,
      destinationLabel: req.body?.destinationLabel ?? req.body?.destination,
      destinationLatitude: req.body?.destinationLatitude,
      destinationLongitude: req.body?.destinationLongitude,
      vehicleType: req.body?.vehicleType,
      pickupAt: req.body?.pickupAt,
      passengers: req.body?.passengers,
      note: req.body?.note,
      maxProviders: req.body?.maxProviders,
    });
    res.status(201).json({ success: true, ride: result, providerLeadCharge: 'charged_on_acceptance' });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to request a ride.' });
  }
});

export default router;