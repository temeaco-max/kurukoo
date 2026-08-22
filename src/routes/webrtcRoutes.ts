/**
 * Authenticated WebRTC signalling API. Provider communication rooms are bound
 * to the existing canonical provider-communication session participants.
 */
import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import {
  createWebRTCRoom,
  getRoomPeers,
  addWebRTCSignal,
  getWebRTCSignals,
  leaveWebRTCRoom,
  touchWebRTCPeer,
  destroyWebRTCRoom,
  getWebRTCStatus,
  getWebRTCClientConfig,
} from '../services/webrtcSignalling.js';
import { getProviderCommunicationSession } from '../services/providerCommunicationService.js';

const router = Router();
const PROVIDER_ROOM_PREFIX = 'provider-session:';

function requireWebRTCReadiness(res: any): boolean {
  const readiness = getWebRTCStatus();
  if (readiness.available) return true;
  res.status(503).json({
    success: false,
    error: 'WebRTC is not available in this deployment.',
    readiness: {
      signaling: readiness.signaling,
      enabled: readiness.enabled,
      relayConfigured: readiness.relayConfigured,
      activationRequirement: readiness.activationRequirement,
    },
  });
  return false;
}

async function authorizeProviderSessionRoom(roomId: string, phone: string, res: any, allowClosed = false): Promise<boolean> {
  if (!roomId.startsWith(PROVIDER_ROOM_PREFIX)) return true;
  const sessionId = roomId.slice(PROVIDER_ROOM_PREFIX.length);
  const session = await getProviderCommunicationSession(sessionId);
  if (!session || (session.customerPhone !== phone && session.providerPhone !== phone)) {
    res.status(403).json({ success: false, error: 'Only the authenticated provider communication participants may access this room.' });
    return false;
  }
  if (!allowClosed && ['ended', 'completed', 'failed'].includes(session.state)) {
    res.status(409).json({ success: false, error: 'This provider communication session is no longer active.' });
    return false;
  }
  return true;
}

router.get('/status', authenticateUser, (_req: AuthRequest, res) => {
  const readiness = getWebRTCStatus();
  res.status(readiness.available ? 200 : 503).json({ success: readiness.available, webrtc: readiness });
});

router.get('/config', authenticateUser, (req: AuthRequest, res) => {
  if (!requireWebRTCReadiness(res)) return;
  const phone = String(req.user?.phone || '');
  if (!phone) return res.status(401).json({ success: false, error: 'Authenticated identity is required for ICE configuration.' });
  res.json({ success: true, webrtc: getWebRTCClientConfig(phone) });
});

router.post('/create', authenticateUser, async (req: AuthRequest, res) => {
  if (!requireWebRTCReadiness(res)) return;
  const roomId = String(req.body?.roomId || '').trim();
  const phone = String(req.user?.phone || '');
  if (!roomId || !phone) return res.status(400).json({ success: false, error: 'roomId required; phone taken from session' });
  if (!(await authorizeProviderSessionRoom(roomId, phone, res))) return;
  createWebRTCRoom(roomId, phone);
  res.json({ success: true, roomId, phone, peers: getRoomPeers(roomId) });
});

router.get('/peers', authenticateUser, async (req: AuthRequest, res) => {
  if (!requireWebRTCReadiness(res)) return;
  const roomId = String(req.query.roomId || '').trim();
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
  const phone = String(req.user?.phone || '');
  if (!(await authorizeProviderSessionRoom(roomId, phone, res))) return;
  if (!getRoomPeers(roomId).includes(phone)) return res.status(403).json({ success: false, error: 'Not a member of this room' });
  res.json({ success: true, peers: getRoomPeers(roomId) });
});

router.post('/signal', authenticateUser, async (req: AuthRequest, res) => {
  if (!requireWebRTCReadiness(res)) return;
  const roomId = String(req.body?.roomId || '').trim();
  const kind = String(req.body?.kind || '') as 'offer' | 'answer' | 'ice' | 'hangup';
  const to = req.body?.to ? String(req.body.to) : undefined;
  const payload = req.body?.payload;
  const from = String(req.user?.phone || '');
  if (!roomId || !['offer', 'answer', 'ice', 'hangup'].includes(kind)) return res.status(400).json({ success: false, error: 'roomId and valid kind required' });
  if (!(await authorizeProviderSessionRoom(roomId, from, res))) return;
  try {
    const signal = addWebRTCSignal(roomId, from, kind, payload, to);
    res.json({ success: true, signal });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Signal rejected' });
  }
});

router.get('/signals', authenticateUser, async (req: AuthRequest, res) => {
  if (!requireWebRTCReadiness(res)) return;
  const roomId = String(req.query.roomId || '').trim();
  const after = req.query.after ? Number(req.query.after) : undefined;
  const phone = String(req.user?.phone || '');
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
  if (!(await authorizeProviderSessionRoom(roomId, phone, res))) return;
  const signals = getWebRTCSignals(roomId, phone, after);
  touchWebRTCPeer(roomId, phone);
  res.json({ success: true, signals });
});

router.post('/leave', authenticateUser, async (req: AuthRequest, res) => {
  const roomId = String(req.body?.roomId || '').trim();
  const phone = String(req.user?.phone || '');
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
  if (!(await authorizeProviderSessionRoom(roomId, phone, res, true))) return;
  leaveWebRTCRoom(roomId, phone);
  res.json({ success: true });
});

router.post('/destroy', authenticateUser, async (req: AuthRequest, res) => {
  const roomId = String(req.body?.roomId || '').trim();
  const phone = String(req.user?.phone || '');
  if (!roomId) return res.status(400).json({ success: false, error: 'roomId required' });
  if (!(await authorizeProviderSessionRoom(roomId, phone, res, true))) return;
  const peers = getRoomPeers(roomId);
  if (!peers.includes(phone)) return res.status(403).json({ success: false, error: 'Not a room member' });
  destroyWebRTCRoom(roomId);
  res.json({ success: true });
});

export default router;
