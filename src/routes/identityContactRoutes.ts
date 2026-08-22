import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { addContact, canCommunicate, getPersonProfile, listContacts, removeContact } from '../services/identityContactService.js';

const router = Router();
function viewer(req: AuthRequest): string | null { const phone = String(req.user?.phone || '').trim(); return phone || null; }

router.get('/contacts', authenticateUser, async (req: AuthRequest, res) => {
  const phone = viewer(req); if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  try { return res.json({ success: true, contacts: await listContacts(phone) }); }
  catch { return res.status(500).json({ success: false, error: 'Unable to load contacts' }); }
});

router.post('/contacts', authenticateUser, async (req: AuthRequest, res) => {
  const phone = viewer(req); if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  try { const personPhone = String(req.body?.personPhone || '').trim(); return res.status(201).json({ success: true, contact: await addContact(phone, personPhone, req.body?.label) }); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unable to add contact' }); }
});

router.delete('/contacts/:personPhone', authenticateUser, async (req: AuthRequest, res) => {
  const phone = viewer(req); if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  try { return res.json({ success: true, removed: await removeContact(phone, String(req.params.personPhone || '').trim()) }); }
  catch { return res.status(500).json({ success: false, error: 'Unable to remove contact' }); }
});

router.get('/people/:personPhone', authenticateUser, async (req: AuthRequest, res) => {
  const phone = viewer(req); if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  const profile = await getPersonProfile(phone, String(req.params.personPhone || '').trim());
  return profile ? res.json({ success: true, profile }) : res.status(404).json({ success: false, error: 'Person is not discoverable in this relationship context' });
});

router.post('/people/:personPhone/communication-check', authenticateUser, async (req: AuthRequest, res) => {
  const phone = viewer(req); if (!phone) return res.status(401).json({ success: false, error: 'Authentication required' });
  const action = req.body?.action === 'call' ? 'call' : 'message';
  const result = await canCommunicate(phone, String(req.params.personPhone || '').trim(), action);
  return res.status(result.allowed ? 200 : 403).json({ success: result.allowed, ...result });
});

export default router;
