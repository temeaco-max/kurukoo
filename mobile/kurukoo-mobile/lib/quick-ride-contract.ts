export const QUICK_RIDE_VEHICLES = [
  { id: 'any', label: 'Any suitable vehicle', icon: '🚗', note: 'Fastest matching across available bike, keke or taxi/car providers.' },
  { id: 'bike', label: 'Bike', icon: '🏍️', note: 'Two-wheel provider where legally permitted.' },
  { id: 'keke', label: 'Keke', icon: '🛺', note: 'Tricycle provider.' },
  { id: 'taxi', label: 'Taxi / Car', icon: '🚕', note: 'Car-based provider.' },
] as const;

export type QuickRideVehicle = typeof QUICK_RIDE_VEHICLES[number]['id'];

export const QUICK_RIDE_API = {
  options: '/api/rides/options',
  request: '/api/rides/quick',
  accept: (leadId: string) => `/api/dispatch-leads/${encodeURIComponent(leadId)}/accept`,
  arrived: (leadId: string) => `/api/dispatch-leads/${encodeURIComponent(leadId)}/arrived`,
  complete: (leadId: string) => `/api/dispatch-leads/${encodeURIComponent(leadId)}/completed`,
  communication: (sessionId: string) => `/api/provider-communication/sessions/${encodeURIComponent(sessionId)}`,
  review: (requestId: string) => `/api/economic-requests/${encodeURIComponent(requestId)}/review`,
} as const;

export interface QuickRideUiState {
  vehicleType: QuickRideVehicle;
  requesting: boolean;
  matched: boolean;
  providerArrived: boolean;
  communicationReady: boolean;
  completed: boolean;
  reviewAvailable: boolean;
}

export const QUICK_RIDE_DEFAULT_STATE: QuickRideUiState = {
  vehicleType: 'any',
  requesting: false,
  matched: false,
  providerArrived: false,
  communicationReady: false,
  completed: false,
  reviewAvailable: false,
};
