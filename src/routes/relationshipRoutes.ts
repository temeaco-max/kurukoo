import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  createRelationship,
  getRelationshipForActor,
  listRelationshipsForActor,
  revokeRelationship,
  setRelationshipNotificationPreference,
} from '../services/relationshipService.js';

const router = Router();

function actor(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

router.get('/relationships', authenticateUser, async (req: AuthRequest, res) => {
  const phone = actor(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const relationships = await listRelationshipsForActor(phone, {
      status: req.query.status === 'revoked' || req.query.status === 'suppressed' ? req.query.status : 'active',
      relationshipType: req.query.relationshipType === 'subscribe' ? 'subscribe' : req.query.relationshipType === 'follow' ? 'follow' : undefined,
      limit: Number(req.query.limit || 50),
    });
    return res.json({ relationships });
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to list relationships' });
  }
});

router.get('/relationships/:targetType/:targetId', authenticateUser, async (req: AuthRequest, res) => {
  const phone = actor(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const relationship = await getRelationshipForActor(phone, req.params.targetType, req.params.targetId, req.query.relationshipType || 'follow');
    return res.json({ relationship });
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to read relationship' });
  }
});

router.post('/relationships', authenticateUser, async (req: AuthRequest, res) => {
  const phone = actor(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const result = await createRelationship(phone, {
      targetType: req.body?.targetType,
      targetId: req.body?.targetId,
      relationshipType: req.body?.relationshipType,
      notificationPreference: req.body?.notificationPreference,
      visibility: req.body?.visibility,
      context: req.body?.context,
    });
    return res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to create relationship' });
  }
});

router.patch('/relationships/:targetType/:targetId/preferences', authenticateUser, async (req: AuthRequest, res) => {
  const phone = actor(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const relationship = await setRelationshipNotificationPreference(phone, req.params.targetType, req.params.targetId, req.body?.relationshipType || 'follow', req.body?.notificationPreference);
    if (!relationship) return res.status(404).json({ error: 'Active relationship not found' });
    return res.json({ relationship });
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to update relationship preference' });
  }
});

router.delete('/relationships/:targetType/:targetId', authenticateUser, async (req: AuthRequest, res) => {
  const phone = actor(req);
  if (!phone) return res.status(401).json({ error: 'Authentication required' });
  try {
    const result = await revokeRelationship(phone, req.params.targetType, req.params.targetId, req.query.relationshipType || 'follow');
    return res.json(result);
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Unable to remove relationship' });
  }
});

export default router;
