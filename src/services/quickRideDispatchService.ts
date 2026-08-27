import crypto from 'node:crypto';
import { createEconomicRequest, getEconomicRequest } from './skillFlows.js';
import { broadcastDispatch, type DispatchLead } from './economicDispatchCoordinator.js';
import { normalizeRideVehicle, validateRideDispatchFields, type RideVehicleType } from './rideDispatchContract.js';
import { syncCanonicalFulfilmentForEconomicRequest } from './canonicalFulfilmentService.js';

export interface QuickRideRequest {
  requestId: string;
  fulfilmentId?: string;
  vehicleType: RideVehicleType;
  origin: { latitude: number; longitude: number; label?: string };
  destination: { label: string; latitude?: number; longitude?: number };
  offers: DispatchLead[];
  state: string;
}

function coordinate(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error('Valid coordinates are required.');
  return number;
}

function compactText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
}

/**
 * Create a transport request on the existing Economic Request lifecycle,
 * attach it to canonical fulfillment, then reuse the shared provider-dispatch
 * network. The quick route adds transport context; it does not own a separate
 * transport fulfillment model.
 */
export async function requestRide(input: {
  ownerPhone: string;
  originLatitude: unknown;
  originLongitude: unknown;
  originLabel?: string;
  destinationLabel: string;
  destinationLatitude?: unknown;
  destinationLongitude?: unknown;
  vehicleType?: RideVehicleType | string;
  pickupAt?: string;
  passengers?: number;
  budgetMinor?: number;
  accessibility?: string;
  safetyRequirements?: string;
  note?: string;
  maxProviders?: number;
}): Promise<QuickRideRequest> {
  const ownerPhone = String(input.ownerPhone || '').trim();
  if (!ownerPhone || ownerPhone.startsWith('anon_')) throw new Error('Authenticated rider is required.');
  const vehicleType = normalizeRideVehicle(input.vehicleType || 'any');
  const origin = {
    latitude: coordinate(input.originLatitude, -90, 90),
    longitude: coordinate(input.originLongitude, -180, 180),
    label: compactText(input.originLabel, 180),
  };
  const destinationLabel = String(input.destinationLabel || '').trim().slice(0, 180);
  if (!destinationLabel) throw new Error('Destination is required.');
  const destination: QuickRideRequest['destination'] = { label: destinationLabel };
  if (input.destinationLatitude !== undefined || input.destinationLongitude !== undefined) {
    if (input.destinationLatitude === undefined || input.destinationLongitude === undefined) throw new Error('Destination latitude and longitude must be supplied together.');
    destination.latitude = coordinate(input.destinationLatitude, -90, 90);
    destination.longitude = coordinate(input.destinationLongitude, -180, 180);
  }
  const validation = validateRideDispatchFields({ vehicleType, pickup: origin, destination, pickupAt: input.pickupAt, passengers: input.passengers, note: input.note });
  if (!validation.valid) throw new Error(validation.error);

  const originReference = origin.label || `${origin.latitude},${origin.longitude}`;
  const departureTime = compactText(input.pickupAt, 120) || 'now';
  const requirements = {
    origin: originReference,
    origin_latitude: origin.latitude,
    origin_longitude: origin.longitude,
    destination: destination.label,
    destination_latitude: destination.latitude,
    destination_longitude: destination.longitude,
    departure_time: departureTime,
    pickup_at: compactText(input.pickupAt, 120),
    timing: departureTime,
    location: originReference,
    description: `Ride from ${originReference} to ${destination.label}`,
    vehicle_type: vehicleType,
    passengers: input.passengers,
    budget_minor: Number.isInteger(input.budgetMinor) && Number(input.budgetMinor) > 0 ? Number(input.budgetMinor) : undefined,
    accessibility: compactText(input.accessibility, 240),
    safety_requirements: compactText(input.safetyRequirements, 240),
    note: compactText(input.note, 500),
    dispatch_mode: 'live_broadcast',
    location_beacon_mode: 'request_origin_only',
  };
  const requestId = `ride_${crypto.randomUUID()}`;
  const request = await createEconomicRequest({
    id: requestId,
    phone: ownerPhone,
    skill: 'ride_request',
    requirements,
  });
  const fulfilment = await syncCanonicalFulfilmentForEconomicRequest({
    ownerPhone,
    economicRequestId: request.id,
    skill: request.skill,
    requirements,
  });
  const result = await broadcastDispatch({
    requestId: request.id,
    ownerPhone,
    skill: 'ride_request',
    vehicleType,
    location: originReference,
    latitude: origin.latitude,
    longitude: origin.longitude,
    maxProviders: input.maxProviders,
  });
  const fresh = await getEconomicRequest(request.id);
  return {
    requestId: request.id,
    fulfilmentId: fulfilment?.id,
    vehicleType,
    origin,
    destination,
    offers: result.offers,
    state: String(fresh?.status || request.status),
  };
}
