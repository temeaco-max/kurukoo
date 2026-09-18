/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { requestRide } from '../services/quickRideDispatchService.js';
import { getRideVehicleOptions } from '../services/rideDispatchContract.js';
import { dispatchToExternalNetwork, listTransportReadiness, searchScheduledJourneys } from '../services/rideNetworkConnector.js';

const router = Router();

router.get('/rides/options', authenticateUser, (_req: AuthRequest, res) => {
  res.json({ success: true, options: getRideVehicleOptions(), default: 'any' });
router.get('/rides/networks', authenticateUser, (_req: AuthRequest, res) => {
  res.json({
    success: true,
    modes: listTransportReadiness(),
    note: 'Road and driverless fleets can be dispatched live. Rail, coach and air/charter are scheduled-journey searches; operator confirmation is required before any fulfilment claim.',
  });
});

router.post('/rides/external', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const originLatitude = Number(req.body?.originLatitude), originLongitude = Number(req.body?.originLongitude);
    if (!Number.isFinite(originLatitude) || !Number.isFinite(originLongitude)) return res.status(400).json({ success: false, error: 'Pickup coordinates are required for an external network dispatch.' });
    const result = await dispatchToExternalNetwork({
      networkId: String(req.body?.networkId || ''),
      requestId: String(req.body?.requestId || `ext_${Date.now()}`),
      pickup: { latitude: originLatitude, longitude: originLongitude, label: req.body?.originLabel ? String(req.body.originLabel) : undefined },
      destination: { label: String(req.body?.destinationLabel || '').trim() || 'Destination' },
    });
    res.status(result.accepted ? 201 : 422).json({ success: result.accepted, dispatch: result });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to dispatch through the external network.' });
  }
});

router.post('/rides/journeys/search', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const origin = String(req.body?.origin || '').trim(), destination = String(req.body?.destination || '').trim();
    if (!origin || !destination) return res.status(400).json({ success: false, error: 'Origin and destination are required.' });
    const mode = String(req.body?.mode || 'rail') as 'rail' | 'bus' | 'air';
    if (!['rail', 'bus', 'air'].includes(mode)) return res.status(400).json({ success: false, error: 'mode must be rail, bus, or air.' });
    const result = await searchScheduledJourneys({ networkId: req.body?.networkId ? String(req.body.networkId) : undefined, mode, origin, destination, date: req.body?.date ? String(req.body.date) : undefined, passengers: req.body?.passengers !== undefined ? Number(req.body.passengers) : undefined });
    res.status(result.searched ? 200 : 422).json({ success: result.searched, search: result, evidenceNote: 'Scheduled results are search evidence, not fulfilment. Operator confirmation is still required.' });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to search journeys.' });
  }
});

router.post('/rides/rail/search', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const origin = String(req.body?.origin || '').trim(), destination = String(req.body?.destination || '').trim();
    if (!origin || !destination) return res.status(400).json({ success: false, error: 'Rail origin and destination are required.' });
    const result = await searchScheduledJourneys({ networkId: req.body?.networkId ? String(req.body.networkId) : undefined, mode: 'rail', origin, destination, date: req.body?.date ? String(req.body.date) : undefined, passengers: req.body?.passengers !== undefined ? Number(req.body.passengers) : undefined });
    res.status(result.searched ? 200 : 422).json({ success: result.searched, search: result, evidenceNote: 'Timetable results are search evidence, not fulfilment. Operator confirmation is still required.' });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to search rail journeys.' });
  }
});

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
      budgetMinor: req.body?.budgetMinor ?? req.body?.budget_minor,
      accessibility: req.body?.accessibility,
      safetyRequirements: req.body?.safetyRequirements ?? req.body?.safety_requirements,
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
        notifications: result.notifications,
      },
    });
  } catch (error) {
    res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to request a ride.' });
  }
});

export default router;
