import crypto from 'node:crypto';
import { createEconomicRequest, getEconomicRequest } from './skillFlows.js';
import { broadcastDispatch, type DispatchLead } from './economicDispatchCoordinator.js';

export type RideVehicleType = 'bike' | 'keke' | 'taxi' | 'car' | 'motorbike' | 'tricycle';

export interface QuickRideRequest {
  requestId: string;
  vehicleType?: RideVehicleType;
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

export async function requestRide(input: {
  ownerPhone: string;
  originLatitude: unknown;
  originLongitude: unknown;
  originLabel?: string;
  destinationLabel: string;
  destinationLatitude?: unknown;
  destinationLongitude?: unknown;
  vehicleType?: RideVehicleType;
  maxProviders?: number;
}): Promise<QuickRideRequest> {
  const ownerPhone = String(input.ownerPhone || '').trim();
  if (!ownerPhone || ownerPhone.startsWith('anon_')) throw new Error('Authenticated rider is required.');
  const origin = {
    latitude: coordinate(input.originLatitude, -90, 90),
    longitude: coordinate(input.originLongitude, -180, 180),
    label: input.originLabel ? String(input.originLabel).trim().slice(0, 180) : undefined,
  };
  const destinationLabel = String(input.destinationLabel || '').trim().slice(0, 180);
  if (!destinationLabel) throw new Error('Destination is required.');
  let destination: QuickRideRequest['destination'] = { label: destinationLabel };
  if (input.destinationLatitude !== undefined || input.destinationLongitude !== undefined) {
    if (input.destinationLatitude === undefined || input.destinationLongitude === undefined) throw new Error('Destination latitude and longitude must be supplied together.');
    destination.latitude = coordinate(input.destinationLatitude, -90, 90);
    destination.longitude = coordinate(input.destinationLongitude, -180, 180);
  }
  const requestId = `ride_${crypto.randomUUID()}`;
  const request = await createEconomicRequest({
    id: requestId,
    phone: ownerPhone,
    skill: 'ride_request',
    requirements: {
      origin: origin.label || `${origin.latitude},${origin.longitude}`,
      origin_latitude: origin.latitude,
      origin_longitude: origin.longitude,
      destination: destination.label,
      destination_latitude: destination.latitude,
      destination_longitude: destination.longitude,
      vehicle_type: input.vehicleType || 'any',
      dispatch_mode: 'live_broadcast',
    },
  });
  const result = await broadcastDispatch({
    requestId: request.id,
    ownerPhone,
    skill: 'ride_request',
    vehicleType: input.vehicleType,
    location: origin.label || `${origin.latitude},${origin.longitude}`,
    latitude: origin.latitude,
    longitude: origin.longitude,
    maxProviders: input.maxProviders,
  });
  const fresh = await getEconomicRequest(request.id);
  return {
    requestId: request.id,
    vehicleType: input.vehicleType,
    origin,
    destination,
    offers: result.offers,
    state: String(fresh?.status || request.status),
  };
}
