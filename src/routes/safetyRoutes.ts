import { Router } from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth.js';
import {
  activateSafetyContact,
  addSafetyContact,
  completeCheckIn,
  listCheckIns,
  listSafetyContacts,
  revokeSafetyContact,
  startCheckIn,
} from '../services/safetyService.js';

const router = Router();
router.use(authenticateUser);

function owner(req: AuthRequest): string { return String(req.user?.phone || ''); }

router.get('/safety/contacts', async (req: AuthRequest, res) => {
  try { res.json({ success: true, contacts: await listSafetyContacts(owner(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message || 'Unable to load safety contacts' }); }
});

router.post('/safety/contacts', async (req: AuthRequest, res) => {
  try {
    const contact = await addSafetyContact(owner(req), {
      name: String(req.body?.name || ''),
      phone: String(req.body?.phone || ''),
      relationship: req.body?.relationship ? String(req.body.relationship) : undefined,
      activate: req.body?.activate === true,
    });
    res.status(201).json({ success: true, contact });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message || 'Unable to save safety contact' }); }
});

router.post('/safety/contacts/:id/activate', async (req: AuthRequest, res) => {
  try {
    const contact = await activateSafetyContact(owner(req), String(req.params.id), req.body?.consentConfirmed === true);
    if (!contact) return res.status(404).json({ success: false, error: 'Pending safety contact not found' });
    res.json({ success: true, contact, message: 'Contact activated by owner consent. No notification has been sent to the contact.' });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message || 'Unable to activate safety contact' }); }
});

router.post('/safety/contacts/:id/revoke', async (req: AuthRequest, res) => {
  try {
    const revoked = await revokeSafetyContact(owner(req), String(req.params.id));
    if (!revoked) return res.status(404).json({ success: false, error: 'Safety contact not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message || 'Unable to revoke safety contact' }); }
});

router.get('/safety/check-ins', async (req: AuthRequest, res) => {
  try { res.json({ success: true, checkIns: await listCheckIns(owner(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message || 'Unable to load check-ins' }); }
});

router.post('/safety/check-ins', async (req: AuthRequest, res) => {
  try {
    const checkIn = await startCheckIn(owner(req), {
      contactId: String(req.body?.contactId || ''),
      durationMinutes: Number(req.body?.durationMinutes || 60),
      routeNote: req.body?.routeNote ? String(req.body.routeNote) : undefined,
    });
    res.status(201).json({ success: true, checkIn, message: 'Check-in started. Kurukoo will keep this as a safety instruction; it does not replace emergency services.' });
  } catch (e: any) { res.status(400).json({ success: false, error: e.message || 'Unable to start check-in' }); }
});

router.post('/safety/check-ins/:id/complete', async (req: AuthRequest, res) => {
  try {
    const completed = await completeCheckIn(owner(req), String(req.params.id));
    if (!completed) return res.status(404).json({ success: false, error: 'Active check-in not found' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message || 'Unable to complete check-in' }); }
});

export default router;
