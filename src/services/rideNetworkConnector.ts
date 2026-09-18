/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */

/**
 * Unified external ride-network connector seam.
 *
 * On-demand road networks (Bolt, Uber, inDrive, FREE NOW, Gett, Lyft, ...) and
 * scheduled RAIL networks (National Rail, Trainline, Amtrak, ...) plug in as
 * adapters against ONE contract.
 *
 * Road adapters request a live ride and map provider states onto Kurukoo's
 * canonical dispatch lifecycle (offered -> accepted -> arrived ->
 * completion_reported -> completed). Anything a network does not report stays
 * unknown; nothing is inferred.
 *
 * Rail adapters are timetable-based: they search scheduled journeys and return
 * attributed itineraries (operator, times, fare) that still require operator
 * confirmation before any fulfilment claim. Rail search never invents
 * schedules; empty availability stays 'unknown'.
 *
 * Trains, flights, coaches and ferries are transport-discovery domains, not
 * live dispatch mandates: rail search is not dispatch authorization. Aviation
 * and coach booking are out of scope for the connector; they belong to
 * travel-discovery request types that a human/agent fulfilment closes.
 *
 * Without provider credentials every adapter is honest about being
 * credentials_required and never claims availability, prices, or acceptance.
 */

export type CanonicalRideState = 'offered' | 'accepted' | 'arrived' | 'completion_reported' | 'completed' | 'cancelled' | 'unknown';

export interface NetworkDispatchResult {
  adapterId: string;
  /** true only when the network actually accepted the job through its API. */
  accepted: boolean;
  externalReference?: string;
  state: CanonicalRideState;
  /** Raw provider state kept for evidence review; never surfaced as verified. */
  providerState?: string;
  detail: string;
}

export interface NetworkReadiness {
  id: string;
  label: string;
  markets: string[];
  state: 'active' | 'credentials_required';
  missing: string[];
  note: string;
}

function config(keys: string[]): { configured: boolean; missing: string[]; values: Record<string, string> } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) values[key] = value;
    else missing.push(key);
  }
  return { configured: missing.length === 0, missing, values };
}

function unauthorized(adapterId: string): NetworkDispatchResult {
  return {
    adapterId,
    accepted: false,
    state: 'unknown',
    detail: 'External network credentials are not configured in this environment. Configure the adapter keys in production to activate this network. No availability, price, or acceptance is claimed.',
  };
}

export function stateFromNetwork(providerState: string | undefined, accepted: boolean): CanonicalRideState {
  const normalized = String(providerState || '').trim().toLowerCase();
  if (['accepted', 'driver_assigned', 'en_route', 'arriving'].includes(normalized)) return 'accepted';
  if (['arrived', 'at_pickup'].includes(normalized)) return 'arrived';
  if (['completed', 'finished', 'ended'].includes(normalized)) return 'completed';
  if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
  return accepted ? 'accepted' : 'unknown';
}
/** Dispatchable adapters: a network API takes a live ride request (road fleets and driverless fleets). */
type DispatchAdapter = RideNetworkAdapter & { createPath: string };

function dispatchAdapter(input: { id: string; label: string; mode: 'road' | 'autonomous'; markets: string[]; requiredEnv: string[]; createPath: string }): DispatchAdapter {
  return {
    id: input.id,
    label: input.label,
    mode: input.mode,
    markets: input.markets,
    requiredEnv: input.requiredEnv,
    createPath: input.createPath,
    async requestRide(job) {
      const cfg = config(input.requiredEnv);
      if (!cfg.configured) return unauthorized(input.id);
      const base = cfg.values[input.requiredEnv[1]];
      if (!/^https:\/\//.test(base)) {
        return { adapterId: input.id, accepted: false, state: 'unknown', detail: `${input.requiredEnv[1]} must be an HTTPS API base URL provided by the network's partner programme.` };
      }
      const secret = cfg.values[input.requiredEnv[0]];
      const response = await fetch(`${base.replace(/\/$/, '')}${input.createPath}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_reference: job.requestId, pickup: job.pickup, destination: job.destination }),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        return { adapterId: input.id, accepted: false, state: 'unknown', providerState: String(payload?.state || ''), detail: `The ${input.label} network rejected the dispatch (HTTP ${response.status}).` };
      }
      const externalReference = String(payload?.id || payload?.ride_id || payload?.job_id || payload?.trip_id || '');
      const providerState = String(payload?.state || payload?.status || 'accepted');
      return {
        adapterId: input.id,
        accepted: true,
        ...(externalReference ? { externalReference } : {}),
        providerState,
        state: stateFromNetwork(providerState, true),
        detail: `The ${input.label} network accepted the dispatch through its API. Provider progress maps onto the canonical lifecycle exactly as reported; unreported states stay unknown.`,
      };
    },
  };
}

export const ROAD_NETWORK_DEFINITIONS = [
  { id: 'bolt', label: 'Bolt', markets: ['ng', 'gb', 'ke', 'gh', 'za'] },
  { id: 'uber', label: 'Uber', markets: ['gb', 'us', 'ca', 'ng'] },
  { id: 'indrive', label: 'inDrive', markets: ['ng', 'gh'] },
  { id: 'freenow', label: 'FREE NOW', markets: ['gb', 'ie'] },
  { id: 'gett', label: 'Gett', markets: ['gb'] },
  { id: 'lyft', label: 'Lyft', markets: ['us', 'ca'] },
] as const;

function envFor(id: string): string[] {
  return [`KURUKOO_${id.toUpperCase()}_API_TOKEN`, `KURUKOO_${id.toUpperCase()}_API_BASE_URL`];
}

let dispatchersCache: DispatchAdapter[] | null = null;

/** Built lazily so module import order cannot hit a temporal-dead-zone reference. */
function dispatchAdapters(): DispatchAdapter[] {
  if (dispatchersCache) return dispatchersCache;
  dispatchersCache = [
    ...ROAD_NETWORK_DEFINITIONS.map((definition) => dispatchAdapter({
      id: definition.id,
      label: definition.label,
      mode: 'road',
      markets: [...definition.markets],
      requiredEnv: envFor(definition.id),
      createPath: '/rides',
    })),
    ...AUTONOMOUS_NETWORK_DEFINITIONS.map((definition) => dispatchAdapter({
      id: definition.id,
      label: definition.label,
      mode: 'autonomous',
      markets: definition.markets,
      requiredEnv: definition.requiredEnv,
      createPath: '/rides',
    })),
  ];
  return dispatchersCache;
}

export function listRideNetworkReadiness(): NetworkReadiness[] {
  return dispatchAdapters().map((adapter) => {
    const cfg = config(adapter.requiredEnv);
    const driverless = adapter.mode === 'autonomous';
    return {
      id: adapter.id,
      label: adapter.label,
      markets: adapter.markets,
      state: cfg.configured ? 'active' : 'credentials_required',
      missing: cfg.missing,
      note: cfg.configured
        ? `${adapter.label} credentials are present. ${driverless ? 'Driverless fleet dispatch still requires operator acceptance per ride.' : 'Live dispatch still requires partner-programme access and verified evidence per ride.'}`
        : `Configure ${adapter.requiredEnv.join(' and ')} in production to activate ${adapter.label}.`,
    };
  });
}

export function activeRideNetworkIds(): string[] {
  return dispatchAdapters().filter((adapter) => config(adapter.requiredEnv).configured).map((adapter) => adapter.id);
}

/** Request a live ride from a road or driverless fleet. Fails closed without credentials. */
export async function dispatchToExternalNetwork(input: { networkId: string; requestId: string; pickup: { latitude: number; longitude: number; label?: string }; destination: { label: string; latitude?: number; longitude?: number } }): Promise<NetworkDispatchResult> {
  const adapter = dispatchAdapters().find((item) => item.id === String(input.networkId || '').trim().toLowerCase());
  if (!adapter) throw new Error('Unknown external ride network. Scheduled modes (rail, coach, air) use the journey search instead of live dispatch.');
  try {
    return await adapter.requestRide(input);
  } catch (error) {
    return {
      adapterId: adapter.id,
      accepted: false,
      state: 'unknown',
      detail: `The ${adapter.label} adapter could not reach its network: ${error instanceof Error ? error.message.slice(0, 200) : 'request failed'}.`,
    };
  }
}
export type RideNetworkMode = 'road' | 'rail' | 'bus' | 'air' | 'autonomous';

export interface RideNetworkAdapter {
  id: string;
  label: string;
  /** On-demand road-hailing vs scheduled rail. Aviation/coach are explicitly out of scope. */
  mode: RideNetworkMode;
  /** Markets where this network plausibly operates. */
  markets: string[];
  requiredEnv: string[];
  requestRide(input: { requestId: string; pickup: { latitude: number; longitude: number; label?: string }; destination: { label: string; latitude?: number; longitude?: number } }): Promise<NetworkDispatchResult>;
  /** Rail-only: search scheduled journeys. Road adapters return not_supported. */
  searchJourneys?(input: { origin: string; destination: string; date?: string; passengers?: number }): Promise<NetworkJourneySearchResult>;
}

export interface NetworkJourney {
  journeyId: string;
  operator?: string;
  origin: string;
  destination: string;
  departsAt?: string;
  arrivesAt?: string;
  durationMinutes?: number;
  changes?: number;
  fareMinor?: number;
  currency?: string;
  /** Nothing here is verified until the operator confirms it. */
  availability: 'available' | 'limited' | 'unknown';
  evidence: Record<string, unknown>;
}

export interface NetworkJourneySearchResult {
  adapterId: string;
  mode: RideNetworkMode;
  searched: boolean;
  journeys: NetworkJourney[];
  detail: string;
}

function journeysUnauthorized(adapterId: string, mode: RideNetworkMode, label: string): NetworkJourneySearchResult {
  const noun = mode === 'air' ? 'flight and charter' : mode === 'bus' ? 'coach' : 'timetable';
  return {
    adapterId,
    mode,
    searched: false,
    journeys: [],
    detail: `${label} ${noun} credentials are not configured in this environment. Configure the provider key in production. No journeys, availability, or fares are claimed.`,
  };
}

type ScheduledJourneyAdapter = Omit<RideNetworkAdapter, 'requestRide'> & {
  mode: 'rail' | 'bus' | 'air';
  searchJourneys(input: { origin: string; destination: string; date?: string; passengers?: number }): Promise<NetworkJourneySearchResult>;
};

function scheduledJourneyAdapter(input: { id: string; label: string; mode: 'rail' | 'bus' | 'air'; markets: string[]; requiredEnv: string[]; apiBaseEnv: string; searchPath: string }): ScheduledJourneyAdapter {
  return {
    id: input.id,
    label: input.label,
    mode: input.mode,
    markets: input.markets,
    requiredEnv: input.requiredEnv,
    async searchJourneys(job) {
      const cfg = config(input.requiredEnv);
      if (!cfg.configured) return journeysUnauthorized(input.id, input.mode, input.label);
      const base = cfg.values[input.apiBaseEnv];
      if (!/^https:\/\//.test(base)) {
        return { adapterId: input.id, mode: input.mode, searched: false, journeys: [], detail: `${input.apiBaseEnv} must be an HTTPS provider API base URL.` };
      }
      const origin = String(job.origin || '').trim();
      const destination = String(job.destination || '').trim();
      if (!origin || !destination) {
        return { adapterId: input.id, mode: input.mode, searched: false, journeys: [], detail: 'Origin and destination are required before a journey search can run.' };
      }
      const authHeader = cfg.values[input.requiredEnv.find((key) => /TOKEN|KEY|SECRET/i.test(key)) || input.requiredEnv[0]];
      const params = new URLSearchParams({ origin, destination });
      if (job.date) params.set('date', job.date);
      if (job.passengers) params.set('passengers', String(job.passengers));
      const response = await fetch(`${base.replace(/\/$/, '')}${input.searchPath}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authHeader}` },
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        return { adapterId: input.id, mode: input.mode, searched: false, journeys: [], detail: `The ${input.label} service rejected the search (HTTP ${response.status}).` };
      }
      const raw = Array.isArray(payload?.journeys) ? (payload.journeys as Record<string, unknown>[]) : [];
      const journeys: NetworkJourney[] = raw.slice(0, 20).map((item, index) => ({
        journeyId: String(item?.journey_id || item?.id || `${input.id}-journey-${index}`),
        operator: item?.operator ? String(item.operator) : undefined,
        origin,
        destination,
        departsAt: item?.departs_at ? String(item.departs_at) : undefined,
        arrivesAt: item?.arrives_at ? String(item.arrives_at) : undefined,
        durationMinutes: typeof item?.duration_minutes === 'number' ? item.duration_minutes : undefined,
        changes: typeof item?.changes === 'number' ? item.changes : undefined,
        fareMinor: typeof item?.fare_minor === 'number' ? item.fare_minor : undefined,
        currency: item?.currency ? String(item.currency) : undefined,
        availability: item?.availability === 'available' ? 'available' : item?.availability === 'limited' ? 'limited' : 'unknown',
        evidence: { provider: input.id, mode: input.mode, provider_response: item },
      }));
      const noun = input.mode === 'air' ? 'flight' : input.mode === 'bus' ? 'coach' : 'rail';
      return {
        adapterId: input.id,
        mode: input.mode,
        searched: true,
        journeys,
        detail: journeys.length
          ? `${journeys.length} ${noun} journey(s) returned by ${input.label}. Schedules must be confirmed by the operator before any fulfilment claim.`
          : `The ${input.label} service returned no journeys for this route and date. Availability stays unknown, not zero.`,
      };
    },
  };
}


export interface TransportNetworkDefinition {
  id: string;
  label: string;
  mode: RideNetworkMode;
  markets: string[];
  requiredEnv: string[];
  /** Dispatchable modes take a live ride; scheduled modes search timetables/charters. */
  dispatchable: boolean;
  note?: string;
}

export const RAIL_NETWORK_DEFINITIONS: TransportNetworkDefinition[] = [
  { id: 'national_rail_enquiries', label: 'National Rail Enquiries', mode: 'rail', markets: ['gb'], requiredEnv: ['KURUKOO_NATIONAL_RAIL_API_KEY', 'KURUKOO_NATIONAL_RAIL_API_BASE_URL'], dispatchable: false },
  { id: 'trainline', label: 'Trainline', mode: 'rail', markets: ['gb'], requiredEnv: ['KURUKOO_TRAINLINE_API_KEY', 'KURUKOO_TRAINLINE_API_BASE_URL'], dispatchable: false },
  { id: 'amtrak', label: 'Amtrak', mode: 'rail', markets: ['us'], requiredEnv: ['KURUKOO_AMTRAK_API_KEY', 'KURUKOO_AMTRAK_API_BASE_URL'], dispatchable: false },
  { id: 'via_rail', label: 'VIA Rail', mode: 'rail', markets: ['ca'], requiredEnv: ['KURUKOO_VIA_RAIL_API_KEY', 'KURUKOO_VIA_RAIL_API_BASE_URL'], dispatchable: false },
];

export const BUS_NETWORK_DEFINITIONS: TransportNetworkDefinition[] = [
  { id: 'flixbus', label: 'FlixBus', mode: 'bus', markets: ['gb', 'us', 'ca'], requiredEnv: ['KURUKOO_FLIXBUS_API_KEY', 'KURUKOO_FLIXBUS_API_BASE_URL'], dispatchable: false },
  { id: 'national_express', label: 'National Express', mode: 'bus', markets: ['gb'], requiredEnv: ['KURUKOO_NATIONAL_EXPRESS_API_KEY', 'KURUKOO_NATIONAL_EXPRESS_API_BASE_URL'], dispatchable: false },
  { id: 'megabus', label: 'Megabus', mode: 'bus', markets: ['gb', 'us', 'ca'], requiredEnv: ['KURUKOO_MEGABUS_API_KEY', 'KURUKOO_MEGABUS_API_BASE_URL'], dispatchable: false },
  { id: 'greyhound', label: 'Greyhound', mode: 'bus', markets: ['us', 'ca'], requiredEnv: ['KURUKOO_GREYHOUND_API_KEY', 'KURUKOO_GREYHOUND_API_BASE_URL'], dispatchable: false },
  { id: 'chisco_transport', label: 'Chisco Transport', mode: 'bus', markets: ['ng'], requiredEnv: ['KURUKOO_CHISCO_API_KEY', 'KURUKOO_CHISCO_API_BASE_URL'], dispatchable: false },
  { id: 'abc_transport', label: 'ABC Transport', mode: 'bus', markets: ['ng'], requiredEnv: ['KURUKOO_ABC_TRANSPORT_API_KEY', 'KURUKOO_ABC_TRANSPORT_API_BASE_URL'], dispatchable: false },
];

export const AIR_NETWORK_DEFINITIONS: TransportNetworkDefinition[] = [
  { id: 'duffel', label: 'Duffel (air aggregator)', mode: 'air', markets: ['gb', 'ng', 'us', 'ca'], requiredEnv: ['KURUKOO_DUFFEL_API_KEY', 'KURUKOO_DUFFEL_API_BASE_URL'], dispatchable: false, note: 'Scheduled airline content through an aggregator; fares require airline confirmation before any booking claim.' },
  { id: 'amadeus', label: 'Amadeus', mode: 'air', markets: ['gb', 'ng', 'us', 'ca'], requiredEnv: ['KURUKOO_AMADEUS_API_KEY', 'KURUKOO_AMADEUS_API_BASE_URL'], dispatchable: false, note: 'Scheduled airline content; availability and fares require airline confirmation.' },
  { id: 'private_jet_charter', label: 'Private jet charter', mode: 'air', markets: ['gb', 'ng', 'us', 'ca'], requiredEnv: ['KURUKOO_PRIVATE_JET_API_KEY', 'KURUKOO_PRIVATE_JET_API_BASE_URL'], dispatchable: false, note: 'Charter inquiry only: an operator must quote and confirm the aircraft before any booking or payment.' },
  { id: 'helicopter_charter', label: 'Helicopter charter', mode: 'air', markets: ['gb', 'ng', 'us'], requiredEnv: ['KURUKOO_HELICOPTER_API_KEY', 'KURUKOO_HELICOPTER_API_BASE_URL'], dispatchable: false, note: 'Charter inquiry only, subject to operator availability, airspace clearance and weather.' },
];

/**
 * Driverless/autonomous fleets are dispatchable like road networks: a partner
 * API accepts a ride request. Where no fleet API is authorised, Kurukoo's own
 * autonomous participants are reached through the canonical physical-execution
 * participant path instead, never through this connector.
 */
export const AUTONOMOUS_NETWORK_DEFINITIONS: TransportNetworkDefinition[] = [
  { id: 'waymo', label: 'Waymo', mode: 'autonomous', markets: ['us'], requiredEnv: ['KURUKOO_WAYMO_API_TOKEN', 'KURUKOO_WAYMO_API_BASE_URL'], dispatchable: true },
  { id: 'zoox', label: 'Zoox', mode: 'autonomous', markets: ['us'], requiredEnv: ['KURUKOO_ZOOX_API_TOKEN', 'KURUKOO_ZOOX_API_BASE_URL'], dispatchable: true },
  { id: 'baidu_apollo_go', label: 'Baidu Apollo Go', mode: 'autonomous', markets: ['cn'], requiredEnv: ['KURUKOO_APOLLO_GO_API_TOKEN', 'KURUKOO_APOLLO_GO_API_BASE_URL'], dispatchable: true },
  { id: 'pony_ai', label: 'Pony.ai', mode: 'autonomous', markets: ['cn', 'us'], requiredEnv: ['KURUKOO_PONY_AI_API_TOKEN', 'KURUKOO_PONY_AI_API_BASE_URL'], dispatchable: true },
  { id: 'autox', label: 'AutoX', mode: 'autonomous', markets: ['cn'], requiredEnv: ['KURUKOO_AUTOX_API_TOKEN', 'KURUKOO_AUTOX_API_BASE_URL'], dispatchable: true },
];

export const SCHEDULED_TRANSPORT_DEFINITIONS: TransportNetworkDefinition[] = [...RAIL_NETWORK_DEFINITIONS, ...BUS_NETWORK_DEFINITIONS, ...AIR_NETWORK_DEFINITIONS];

function adaptersFor(definitions: TransportNetworkDefinition[], mode: 'rail' | 'bus' | 'air'): ScheduledJourneyAdapter[] {
  return definitions.map((definition) => scheduledJourneyAdapter({
    id: definition.id,
    label: definition.label,
    mode,
    markets: definition.markets,
    requiredEnv: definition.requiredEnv,
    apiBaseEnv: definition.requiredEnv[1] || definition.requiredEnv[0],
    searchPath: mode === 'air' ? '/offers/search' : '/journeys/search',
  }));
}

const RAIL_ADAPTERS: ScheduledJourneyAdapter[] = adaptersFor(RAIL_NETWORK_DEFINITIONS, 'rail');
const BUS_ADAPTERS: ScheduledJourneyAdapter[] = adaptersFor(BUS_NETWORK_DEFINITIONS, 'bus');
const AIR_ADAPTERS: ScheduledJourneyAdapter[] = adaptersFor(AIR_NETWORK_DEFINITIONS, 'air');
const SCHEDULED_ADAPTERS: ScheduledJourneyAdapter[] = [...RAIL_ADAPTERS, ...BUS_ADAPTERS, ...AIR_ADAPTERS];

function readinessFor(definitions: TransportNetworkDefinition[]): NetworkReadiness[] {
  return definitions.map((definition) => {
    const cfg = config(definition.requiredEnv);
    return {
      id: definition.id,
      label: definition.label,
      markets: definition.markets,
      state: cfg.configured ? 'active' : 'credentials_required',
      missing: cfg.missing,
      note: cfg.configured
        ? `${definition.label} credentials are present. ${definition.note || 'Provider confirmation is still required per journey.'}`
        : `Configure ${definition.requiredEnv.join(' and ')} in production to activate ${definition.label}. ${definition.note || ''}`.trim(),
    };
  });
}

export function listRailNetworkReadiness(): NetworkReadiness[] { return readinessFor(RAIL_NETWORK_DEFINITIONS); }
export function listBusNetworkReadiness(): NetworkReadiness[] { return readinessFor(BUS_NETWORK_DEFINITIONS); }
export function listAirNetworkReadiness(): NetworkReadiness[] { return readinessFor(AIR_NETWORK_DEFINITIONS); }
export function listAutonomousNetworkReadiness(): NetworkReadiness[] { return readinessFor(AUTONOMOUS_NETWORK_DEFINITIONS); }

/** Every transport mode the connector knows, with honest activation state. */
export function listTransportReadiness(): { mode: RideNetworkMode; networks: NetworkReadiness[] }[] {
  return [
    { mode: 'road', networks: listRideNetworkReadiness() },
    { mode: 'autonomous', networks: listAutonomousNetworkReadiness() },
    { mode: 'rail', networks: listRailNetworkReadiness() },
    { mode: 'bus', networks: listBusNetworkReadiness() },
    { mode: 'air', networks: listAirNetworkReadiness() },
  ];
}

/** Search any scheduled transport mode (rail, coach, air/charter). Fails closed without credentials. */
export async function searchScheduledJourneys(input: { networkId?: string; mode?: RideNetworkMode; origin: string; destination: string; date?: string; passengers?: number }): Promise<NetworkJourneySearchResult> {
  const requestedId = String(input.networkId || '').trim().toLowerCase();
  const adapter = requestedId
    ? SCHEDULED_ADAPTERS.find((item) => item.id === requestedId)
    : SCHEDULED_ADAPTERS.find((item) => item.mode === (input.mode || 'rail') && config(item.requiredEnv).configured);
  if (!adapter) throw new Error(requestedId ? 'Unknown scheduled transport network.' : 'No scheduled transport network is configured for that mode yet.');
  try {
    return await adapter.searchJourneys(input);
  } catch (error) {
    return {
      adapterId: adapter.id,
      mode: adapter.mode,
      searched: false,
      journeys: [],
      detail: `The ${adapter.label} adapter could not reach its provider: ${error instanceof Error ? error.message.slice(0, 200) : 'request failed'}.`,
    };
  }
}

/** Search rail timetables. Fails closed without credentials; never invents schedules. */
export async function searchRailJourneys(input: { networkId: string; origin: string; destination: string; date?: string; passengers?: number }): Promise<NetworkJourneySearchResult> {
  return searchScheduledJourneys({ ...input, mode: 'rail' });
}