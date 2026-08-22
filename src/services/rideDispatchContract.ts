export const RIDE_VEHICLE_OPTIONS = [
  { id: 'bike', skills: ['okada_rider', 'rider'], label: 'Bike', passengersMax: 1, notes: 'Fast local two-wheel trip where legally permitted.' },
  { id: 'keke', skills: ['keke_driver'], label: 'Keke', passengersMax: 3, notes: 'Tricycle transport.' },
  { id: 'taxi', skills: ['taxi_quick', 'informal_taxi', 'shuttle_driver'], label: 'Taxi/Car', passengersMax: 4, notes: 'Car-based passenger trip.' },
  { id: 'any', skills: ['okada_rider', 'keke_driver', 'taxi_quick', 'informal_taxi', 'shuttle_driver'], label: 'Any suitable vehicle', passengersMax: 4, notes: 'Let the provider network choose a suitable available vehicle.' },
] as const;

export type RideVehicleType = typeof RIDE_VEHICLE_OPTIONS[number]['id'];

export interface RideDispatchRequestFields {
  vehicleType?: RideVehicleType;
  pickup?: { latitude?: number; longitude?: number; label?: string };
  destination?: { latitude?: number; longitude?: number; label?: string };
  pickupAt?: string;
  passengers?: number;
  note?: string;
}

export function normalizeRideVehicle(value: unknown): RideVehicleType {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'bike' || v === 'motorbike' || v === 'okada' || v === 'motorcycle') return 'bike';
  if (v === 'keke' || v === 'tricycle') return 'keke';
  if (v === 'taxi' || v === 'car' || v === 'cab') return 'taxi';
  return 'any';
}

export function getRideVehicleOptions() {
  return RIDE_VEHICLE_OPTIONS.map((item) => ({ ...item, id: String(item.id) }));
}

export function validateRideDispatchFields(input: RideDispatchRequestFields): { valid: true } | { valid: false; error: string } {
  if (input.passengers !== undefined) {
    if (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > 8) return { valid: false, error: 'Passengers must be a whole number from 1 to 8.' };
    const vehicle = RIDE_VEHICLE_OPTIONS.find((item) => item.id === normalizeRideVehicle(input.vehicleType));
    if (vehicle && input.passengers > vehicle.passengersMax && vehicle.id !== 'any') return { valid: false, error: `${vehicle.label} supports up to ${vehicle.passengersMax} passenger${vehicle.passengersMax === 1 ? '' : 's'}.` };
  }
  for (const point of [input.pickup, input.destination]) {
    if (!point) continue;
    if (point.latitude !== undefined && (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90)) return { valid: false, error: 'A ride location latitude is invalid.' };
    if (point.longitude !== undefined && (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180)) return { valid: false, error: 'A ride location longitude is invalid.' };
  }
  if (input.pickupAt && Number.isNaN(Date.parse(input.pickupAt))) return { valid: false, error: 'Pickup time must be a valid date/time.' };
  return { valid: true };
}
