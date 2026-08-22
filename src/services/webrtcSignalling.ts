import crypto from 'node:crypto';

type SignalKind = 'offer' | 'answer' | 'ice' | 'hangup';
type Peer = { id: string; joinedAt: number; lastSeenAt: number };
type Signal = { id: string; from: string; to?: string; kind: SignalKind; payload: unknown; createdAt: number };
type Room = { id: string; createdAt: number; expiresAt: number; peers: Map<string, Peer>; signals: Signal[] };
type IceServer = { urls: string | string[]; username?: string; credential?: string; credentialType?: 'password' };

const rooms = new Map<string, Room>();
const ROOM_TTL_MS = 30 * 60 * 1000;
const SIGNAL_TTL_MS = 2 * 60 * 1000;
const DEFAULT_TURN_CREDENTIAL_TTL_SECONDS = 600;

function now() { return Date.now(); }
function roomFor(roomId: string) {
    const room = rooms.get(roomId);
    if (!room || room.expiresAt <= now()) {
        if (room) rooms.delete(roomId);
        return null;
    }
    room.signals = room.signals.filter(signal => signal.createdAt + SIGNAL_TTL_MS > now());
    return room;
}

export function createWebRTCRoom(roomId: string, phone: string): void {
    if (!roomId || !phone) return;
    let room = roomFor(roomId);
    if (!room) {
        room = { id: roomId, createdAt: now(), expiresAt: now() + ROOM_TTL_MS, peers: new Map(), signals: [] };
        rooms.set(roomId, room);
    }
    room.expiresAt = now() + ROOM_TTL_MS;
    const existing = room.peers.get(phone);
    room.peers.set(phone, existing || { id: phone, joinedAt: now(), lastSeenAt: now() });
    if (existing) existing.lastSeenAt = now();
}

export function touchWebRTCPeer(roomId: string, peerId: string): boolean {
    const room = roomFor(roomId);
    const peer = room?.peers.get(peerId);
    if (!room || !peer) return false;
    peer.lastSeenAt = now();
    room.expiresAt = now() + ROOM_TTL_MS;
    return true;
}

export function leaveWebRTCRoom(roomId: string, peerId: string): boolean {
    const room = roomFor(roomId);
    if (!room) return false;
    const deleted = room.peers.delete(peerId);
    if (room.peers.size === 0) rooms.delete(roomId);
    return deleted;
}

export function getRoomPeers(roomId: string): string[] {
    const room = roomFor(roomId);
    if (!room) return [];
    return Array.from(room.peers.values())
        .filter(peer => peer.lastSeenAt + ROOM_TTL_MS > now())
        .map(peer => peer.id);
}

export function addWebRTCSignal(roomId: string, from: string, kind: SignalKind, payload: unknown, to?: string): Signal {
    const room = roomFor(roomId);
    if (!room) throw new Error('WebRTC room not found or expired');
    if (!room.peers.has(from)) throw new Error('Peer is not a member of this room');
    if (to && !room.peers.has(to)) throw new Error('Target peer is not a member of this room');
    const signal: Signal = {
        id: `${now()}_${Math.random().toString(36).slice(2, 10)}`,
        from,
        to,
        kind,
        payload,
        createdAt: now()
    };
    room.signals.push(signal);
    touchWebRTCPeer(roomId, from);
    return signal;
}

export function getWebRTCSignals(roomId: string, peerId: string, after?: number): Signal[] {
    const room = roomFor(roomId);
    if (!room || !room.peers.has(peerId)) return [];
    const cursor = Number.isFinite(after) ? Number(after) : 0;
    return room.signals.filter(signal =>
        signal.createdAt > cursor && signal.from !== peerId && (!signal.to || signal.to === peerId)
    );
}

export function destroyWebRTCRoom(roomId: string): boolean {
    return rooms.delete(roomId);
}

function parseList(value: string | undefined): string[] {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 8);
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function turnSettings() {
    const urls = parseList(process.env.TURN_URL || process.env.TURN_SERVER_URL);
    const sharedSecret = String(process.env.TURN_SHARED_SECRET || process.env.COTURN_SHARED_SECRET || '').trim();
    const ttlSeconds = boundedInteger(process.env.TURN_CREDENTIAL_TTL_SECONDS, DEFAULT_TURN_CREDENTIAL_TTL_SECONDS, 60, 3600);
    const staticCredentialsPresent = Boolean(String(process.env.TURN_USERNAME || '').trim() || String(process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD || '').trim());
    return { urls, sharedSecret, ttlSeconds, staticCredentialsPresent };
}

function stableTurnSubject(identity: string): string {
    return crypto.createHash('sha256').update(String(identity || '').trim()).digest('base64url').slice(0, 24);
}

function createEphemeralTurnCredential(identity: string, sharedSecret: string, ttlSeconds: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresAt}:${stableTurnSubject(identity)}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
    return { username, credential, expiresAt };
}

/**
 * Returns browser-safe ICE configuration. TURN credentials use coturn's REST
 * shared-secret format and are regenerated per authenticated identity. Static
 * TURN usernames/passwords are deliberately never returned to a browser.
 */
export function getWebRTCClientConfig(identity?: string) {
    const configuredStun = parseList(process.env.STUN_SERVERS);
    const turn = turnSettings();
    const iceServers: IceServer[] = configuredStun.map(url => ({ urls: url }));
    let expiresAt: number | undefined;

    if (turn.urls.length && turn.sharedSecret && identity) {
        const credential = createEphemeralTurnCredential(identity, turn.sharedSecret, turn.ttlSeconds);
        expiresAt = credential.expiresAt;
        iceServers.push({
            urls: turn.urls.length === 1 ? turn.urls[0] : turn.urls,
            username: credential.username,
            credential: credential.credential,
            credentialType: 'password',
        });
    }

    const credentialedTurn = Boolean(turn.urls.length && turn.sharedSecret && identity);
    return {
        iceServers,
        transport: credentialedTurn ? (configuredStun.length ? 'stun-turn' : 'turn') : configuredStun.length ? 'stun' : 'host-candidate-only',
        credentialedTurn,
        credentialMode: credentialedTurn ? 'ephemeral' as const : 'none' as const,
        expiresAt,
        directStunConfigured: configuredStun.length > 0,
        staticTurnCredentialsRefused: turn.staticCredentialsPresent,
    };
}

setInterval(() => {
    const cutoff = now();
    for (const [id, room] of rooms) {
        if (room.expiresAt <= cutoff) rooms.delete(id);
    }
}, 60_000).unref();

export function getWebRTCStatus() {
    const configuredStun = parseList(process.env.STUN_SERVERS);
    const turn = turnSettings();
    const directStunConfigured = configuredStun.length > 0;
    const turnEndpointConfigured = turn.urls.length > 0;
    const relayConfigured = Boolean(turnEndpointConfigured && turn.sharedSecret);
    const iceConfigured = directStunConfigured || relayConfigured;
    const enabled = process.env.FF_WEBRTC === 'true' && iceConfigured;
    let activationRequirement: string;
    if (turnEndpointConfigured && !turn.sharedSecret) {
        activationRequirement = 'TURN is configured without a shared secret for ephemeral credentials; static client credentials are refused.';
    } else if (!iceConfigured) {
        activationRequirement = 'Configure approved STUN servers and, where relay fallback is required, a TURN endpoint with TURN_SHARED_SECRET before explicitly enabling FF_WEBRTC.';
    } else if (!enabled) {
        activationRequirement = 'ICE is configured but WebRTC remains disabled until FF_WEBRTC is explicitly enabled after security review.';
    } else if (!relayConfigured) {
        activationRequirement = 'Direct STUN ICE is active. TURN fallback remains unavailable until an approved TURN endpoint and ephemeral credential shared secret are configured.';
    } else {
        activationRequirement = 'Independent relay/provider connectivity, authenticated participant consent, and browser interoperability checks remain required.';
    }
    return {
        signaling: 'repository_ready' as const,
        enabled,
        relayConfigured,
        directStunConfigured,
        turnEndpointConfigured,
        credentialMode: relayConfigured ? 'ephemeral' as const : 'none' as const,
        staticTurnCredentialsRefused: turn.staticCredentialsPresent,
        available: enabled,
        activationRequirement,
    };
}
