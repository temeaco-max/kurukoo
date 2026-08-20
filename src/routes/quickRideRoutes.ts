import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { requestRide, type RideVehicleType } from '../services/quickRideDispatchService.js';

const router = Router();

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
      vehicleType: req.body?.vehicleType ? String(req.body.vehicleType).toLowerCase() as RideVehicleType : undefined,
      maxProviders: req.body?.maxProviders,
    });
    res.status(201).json({ success: true, ride: result });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to request a ride.' });
  }
});

export default router;
