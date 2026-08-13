import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import {
  acceptSelectedProviderQuote,
  getCoordinationEvents,
  getOwnerHandoff,
  inviteEligibleProviders,
  listOperatorHandoffs,
  listOwnerProviderResponses,
  listProviderInvitations,
  requestOperatorHandoff,
  respondToProviderInvitation,
  selectProviderResponse,
  setControlledPilotAccount,
  setProviderCoordinationAvailability,
  updateOperatorHandoff,
} from '../services/providerCoordination.js';

const router = Router();

function phone(req: AuthRequest): string | null {
  return req.user?.phone ? String(req.user.phone) : null;
}

function operatorId(req: AuthRequest): string {
  return String(req.user?.username || req.user?.id || req.user?.phone || 'admin');
}

router.get('/provider/invitations', authenticateUser, async (req: AuthRequest, res) => {
  const providerPhone = phone(req);
  if (!providerPhone) return res.status(401).json({ success: false, error: 'Authenticated provider identity is required' });
  try {
    const invitations = await listProviderInvitations(providerPhone, Number(req.query.limit) || 30);
    res.json({ success: true, invitations, delivery: 'internal_queue_only', external_delivery_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider coordination queue';
    res.status(/verified provider/.test(message) ? 403 : 422).json({ success: false, error: message });
  }
});

router.post('/provider/invitations/:id/respond', authenticateUser, async (req: AuthRequest, res) => {
  const providerPhone = phone(req);
  if (!providerPhone) return res.status(401).json({ success: false, error: 'Authenticated provider identity is required' });
  try {
    const invitation = await respondToProviderInvitation({
      invitationId: String(req.params.id || ''), providerPhone,
      response: req.body?.response,
      quoteMinor: req.body?.quoteMinor,
      currency: req.body?.currency,
      note: req.body?.note,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.json({ success: true, invitation, external_delivery_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to record provider response';
    const status = /verified provider/.test(message) ? 403 : /not found/.test(message) ? 404 : /already|no longer|positive/.test(message) ? 409 : 422;
    res.status(status).json({ success: false, error: message });
  }
});

router.post('/provider/availability', authenticateUser, async (req: AuthRequest, res) => {
  const providerPhone = phone(req);
  if (!providerPhone) return res.status(401).json({ success: false, error: 'Authenticated provider identity is required' });
  try {
    await setProviderCoordinationAvailability({ phone: providerPhone, skill: req.body?.skill, serviceArea: req.body?.serviceArea, timezone: req.body?.timezone, state: req.body?.state, availableForMinutes: req.body?.availableForMinutes });
    res.json({ success: true, message: 'Availability recorded with a bounded freshness window. It is not a booking, dispatch, or fulfilment claim.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider availability';
    res.status(/not enrolled|verified provider/.test(message) ? 403 : 422).json({ success: false, error: message });
  }
});

router.post('/requests/:id/invite-providers', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    const result = await inviteEligibleProviders({ requestId: String(req.params.id || ''), ownerPhone, max: req.body?.max });
    res.status(201).json({ success: true, ...result, external_delivery_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to invite providers';
    res.status(/ownership/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.get('/requests/:id/provider-responses', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    const responses = await listOwnerProviderResponses({ requestId: String(req.params.id || ''), ownerPhone });
    res.json({ success: true, responses, external_delivery_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider responses';
    res.status(/ownership/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.post('/requests/:id/select-provider', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    const request = await selectProviderResponse({ requestId: String(req.params.id || ''), ownerPhone, invitationId: req.body?.invitationId });
    res.json({ success: true, request, payment_confirmed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to select provider response';
    res.status(/ownership|not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

router.post('/requests/:id/accept-provider-quote', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    const request = await acceptSelectedProviderQuote({ requestId: String(req.params.id || ''), ownerPhone });
    res.json({ success: true, request, payment_confirmed: false, next_step: 'Payment remains unavailable until a configured provider verifies settlement.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to accept provider quote';
    res.status(/ownership|not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

router.post('/requests/:id/handoff', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    const handoff = await requestOperatorHandoff({ requestId: String(req.params.id || ''), ownerPhone, reason: req.body?.reason });
    res.status(201).json({ success: true, handoff, operator_contacted: false, message: 'Your request is in the internal coordinator queue. Kurukoo does not claim an external contact or intervention until an operator records it.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to request coordinator help';
    res.status(/ownership/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.get('/requests/:id/handoff', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    res.json({ success: true, handoff: await getOwnerHandoff({ requestId: String(req.params.id || ''), ownerPhone }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load coordinator handoff';
    res.status(/ownership/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.get('/requests/:id/events', authenticateUser, async (req: AuthRequest, res) => {
  const ownerPhone = phone(req);
  if (!ownerPhone) return res.status(401).json({ success: false, error: 'Authenticated request owner is required' });
  try {
    res.json({ success: true, events: await getCoordinationEvents(String(req.params.id || ''), ownerPhone) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load coordination events';
    res.status(/ownership/.test(message) ? 404 : 422).json({ success: false, error: message });
  }
});

router.post('/admin/pilot-accounts', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await setControlledPilotAccount({ phone: req.body?.phone, role: req.body?.role, state: req.body?.state, operatorId: operatorId(req) });
    res.status(201).json({ success: true, message: 'Controlled-pilot account state recorded. No external invitation was sent.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update controlled-pilot account';
    res.status(422).json({ success: false, error: message });
  }
});

router.get('/admin/handoffs', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    res.json({ success: true, handoffs: await listOperatorHandoffs(Number(req.query.limit) || 50), private_owner_identifiers: 'omitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to load coordinator queue' });
  }
});

router.patch('/admin/handoffs/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const handoff = await updateOperatorHandoff({ handoffId: String(req.params.id || ''), operatorId: operatorId(req), status: req.body?.status });
    res.json({ success: true, handoff });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update coordinator handoff';
    res.status(/not found/.test(message) ? 404 : 409).json({ success: false, error: message });
  }
});

export default router;
