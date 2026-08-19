import { Router } from 'express';
import crypto from 'node:crypto';
import { optionalAuthenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  addWebRTCSignal,
  createWebRTCRoom,
  getRoomPeers,
  getWebRTCSignals,
  getWebRTCStatus,
  leaveWebRTCRoom,
  touchWebRTCPeer,
} from '../services/webrtcSignalling.js';

const router = Router();

function guestId(req: any, res: any): string {
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith('kurukoo_call_peer='));
  if (pair) return decodeURIComponent(pair.slice('kurukoo_call_peer='.length));
  const id = `call_${crypto.randomUUID()}`;
  res.setHeader('Set-Cookie', `kurukoo_call_peer=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800`);
  return id;
}

function identity(req: AuthRequest, res: any): string {
  return req.user?.phone ? String(req.user.phone) : guestId(req, res);
}

router.get('/status', (_req, res) => {
  res.json({ webrtc: getWebRTCStatus() });
});

router.post('/room', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const peerId = identity(req, res);
  const requested = typeof req.body?.roomId === 'string' ? req.body.roomId.trim().slice(0, 160) : '';
  const roomId = requested || `call-${crypto.randomUUID()}`;
  const status = getWebRTCStatus();
  if (!status.available) return res.status(503).json({ error: status.activationRequirement });
  createWebRTCRoom(roomId, peerId);
  const peers = getRoomPeers(roomId).filter(id => id !== peerId);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ roomId, peerId, remotePeerId: peers[0] || null });
});

router.get('/peers', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const peerId = identity(req, res);
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId.slice(0, 160) : '';
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });
  if (!touchWebRTCPeer(roomId, peerId)) return res.status(404).json({ error: 'Call room is unavailable.' });
  res.json({ peers: getRoomPeers(roomId), peerId });
});

router.get('/signals', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const peerId = identity(req, res);
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId.slice(0, 160) : '';
  const after = Number(req.query.after || 0);
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });
  if (!touchWebRTCPeer(roomId, peerId)) return res.status(404).json({ error: 'Call room is unavailable.' });
  const signals = getWebRTCSignals(roomId, peerId, Number.isFinite(after) ? after : 0);
  const latest = signals.reduce((cursor, signal) => Math.max(cursor, signal.createdAt), Number.isFinite(after) ? after : 0);
  const peers = getRoomPeers(roomId).filter(id => id !== peerId);
  res.json({ signals, cursor: latest, remotePeerId: peers[0] || null });
});

router.post('/signal', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const peerId = identity(req, res);
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.slice(0, 160) : '';
  const kind = req.body?.kind;
  const target = typeof req.body?.to === 'string' ? req.body.to.slice(0, 160) : undefined;
  const payload = req.body?.payload;
  if (!roomId || !['offer', 'answer', 'ice', 'hangup'].includes(kind)) return res.status(400).json({ error: 'Invalid signalling request.' });
  try {
    const signal = addWebRTCSignal(roomId, peerId, kind, payload, target);
    res.json({ ok: true, signalId: signal.id });
  } catch (error: any) {
    res.status(409).json({ error: error?.message || 'Unable to relay the call signal.' });
  }
});

router.post('/leave', optionalAuthenticateUser, (req: AuthRequest, res) => {
  const peerId = identity(req, res);
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.slice(0, 160) : '';
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });
  res.json({ left: leaveWebRTCRoom(roomId, peerId) });
});

export default router;
