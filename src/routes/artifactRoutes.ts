import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { completeGoogleDriveConnection, createArtifact, deleteArtifactReference, getArtifact, getDriveConnectionStatus, listArtifacts, readManagedArtifact, revokeGoogleDriveConnection, startGoogleDriveConnection } from '../services/artifactService.js';
import { completeGoogleSheetsConnection, getGoogleSheetsConnectionStatus, readGoogleSheet, revokeGoogleSheetsConnection, startGoogleSheetsConnection } from '../services/googleSheetsSourceService.js';
import { completeNotionConnection, getNotionConnectionStatus, revokeNotionConnection, searchNotion, startNotionConnection } from '../services/notionSourceService.js';
import { completeMicrosoftConnection, getMicrosoftSourceStatus, listMicrosoftSource, revokeMicrosoftConnection, startMicrosoftConnection } from '../services/microsoftGraphSourceService.js';

const router = Router();
// This router is mounted at `/api`; scope authentication to its own namespace so it cannot intercept unrelated public or guest API routes.
router.use('/artifacts', authenticateUser);

function phone(req: AuthRequest): string { return String(req.user?.phone || '').trim(); }
function base64Data(value: unknown): Buffer | null {
  const raw = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw || !/^[A-Za-z0-9+/=]+$/.test(raw)) return null;
  try { const data = Buffer.from(raw, 'base64'); return data.length ? data : null; } catch { return null; }
}
function responseError(res: any, error: unknown) {
  const code = String((error as { code?: string })?.code || 'ARTIFACT_ERROR');
  const status = code.includes('OWNER') ? 403 : code.includes('NOT_CONNECTED') || code.includes('OAUTH_NOT_CONFIGURED') || code.includes('FEATURE_DISABLED') ? 503 : code.includes('STATE') || code.includes('EXCHANGE') || code.includes('SCOPE') || code.includes('INVALID') ? 400 : 502;
  return res.status(status).json({ success: false, code, error: error instanceof Error ? error.message : 'Artifact operation failed.' });
}

router.get('/artifacts', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, storage: await getDriveConnectionStatus(phone(req)), artifacts: await listArtifacts(phone(req)) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/drive/connect', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, provider: 'google_drive', ...(await startGoogleDriveConnection(phone(req))) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/drive/callback', async (req: AuthRequest, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || !code) return res.status(400).json({ success: false, code: 'DRIVE_OAUTH_CALLBACK_INVALID', error: 'Google Drive authorization did not return a valid state and code.' });
  try {
    const completed = await completeGoogleDriveConnection(phone(req), state, code);
    if (req.accepts('html')) return res.redirect(302, '/connect?drive=connected');
    return res.json({ success: true, ...completed });
  } catch (error) { return responseError(res, error); }
});

router.post('/artifacts/drive/revoke', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, revoked: await revokeGoogleDriveConnection(phone(req)) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/sheets', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await getGoogleSheetsConnectionStatus(phone(req)) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/sheets/connect', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, provider: 'google_sheets', ...(await startGoogleSheetsConnection(phone(req))) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/sheets/callback', async (req: AuthRequest, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || !code) return res.status(400).json({ success: false, code: 'SHEETS_OAUTH_CALLBACK_INVALID', error: 'Google Sheets authorization did not return a valid state and code.' });
  try {
    const completed = await completeGoogleSheetsConnection(phone(req), state, code);
    if (req.accepts('html')) return res.redirect(302, '/connect?sheets=connected');
    return res.json({ success: true, ...completed });
  } catch (error) { return responseError(res, error); }
});

router.post('/artifacts/sheets/revoke', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, revoked: await revokeGoogleSheetsConnection(phone(req)) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/sheets/read', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await readGoogleSheet(phone(req), { spreadsheetId: req.body?.spreadsheetId, range: req.body?.range }) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/notion', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await getNotionConnectionStatus(phone(req)) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/notion/connect', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, provider: 'notion', ...(await startNotionConnection(phone(req))) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/notion/callback', async (req: AuthRequest, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || !code) return res.status(400).json({ success: false, code: 'NOTION_OAUTH_CALLBACK_INVALID', error: 'Notion authorization did not return a valid state and code.' });
  try {
    const completed = await completeNotionConnection(phone(req), state, code);
    if (req.accepts('html')) return res.redirect(302, '/connect?notion=connected');
    return res.json({ success: true, ...completed });
  } catch (error) { return responseError(res, error); }
});

router.post('/artifacts/notion/search', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await searchNotion(phone(req), req.body?.query) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/notion/revoke', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, ...(await revokeNotionConnection(phone(req))) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/microsoft/:kind', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await getMicrosoftSourceStatus(phone(req), req.params.kind) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/microsoft/:kind/connect', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, ...(await startMicrosoftConnection(phone(req), req.params.kind)) }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/microsoft/:kind/callback', async (req: AuthRequest, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || !code) return res.status(400).json({ success: false, code: 'MICROSOFT_OAUTH_CALLBACK_INVALID', error: 'Microsoft authorization did not return a valid state and code.' });
  try {
    const completed = await completeMicrosoftConnection(phone(req), req.params.kind, state, code);
    if (req.accepts('html')) return res.redirect(302, `/connect?${encodeURIComponent(String(req.params.kind || 'microsoft'))}=connected`);
    return res.json({ success: true, ...completed });
  } catch (error) { return responseError(res, error); }
});

router.post('/artifacts/microsoft/:kind/list', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, source: await listMicrosoftSource(phone(req), req.params.kind, req.body?.query) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts/microsoft/:kind/revoke', async (req: AuthRequest, res) => {
  try { return res.json({ success: true, ...(await revokeMicrosoftConnection(phone(req), req.params.kind)) }); }
  catch (error) { return responseError(res, error); }
});

router.post('/artifacts', async (req: AuthRequest, res) => {
  const data = base64Data(req.body?.dataBase64);
  if (!data) return res.status(400).json({ success: false, code: 'ARTIFACT_DATA_INVALID', error: 'dataBase64 is required.' });
  try {
    const artifact = await createArtifact({ phone: phone(req), filename: req.body?.filename, mimeType: req.body?.mimeType, data, transcript: typeof req.body?.transcript === 'string' ? req.body.transcript : undefined, transcriptStatus: typeof req.body?.transcript === 'string' ? 'available' : 'not_requested' });
    return res.status(201).json({ success: true, artifact });
  } catch (error) { return responseError(res, error); }
});

router.get('/artifacts/:id', async (req: AuthRequest, res) => {
  try { const artifact = await getArtifact(phone(req), String(req.params.id)); return artifact ? res.json({ success: true, artifact }) : res.status(404).json({ success: false, error: 'Artifact not found.' }); }
  catch (error) { return responseError(res, error); }
});

router.get('/artifacts/:id/open', async (req: AuthRequest, res) => {
  try {
    const artifact = await getArtifact(phone(req), String(req.params.id));
    if (!artifact) return res.status(404).json({ success: false, error: 'Artifact not found.' });
    if (artifact.externalUrl) return res.redirect(302, artifact.externalUrl);
    const local = await readManagedArtifact(phone(req), artifact.id);
    if (!local) return res.status(404).json({ success: false, error: 'Managed artifact content is unavailable.' });
    res.set({ 'Content-Type': local.artifact.mimeType, 'Content-Length': String(local.data.length), 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="${local.artifact.filename.replace(/"/g, '')}"` });
    return res.send(local.data);
  } catch (error) { return responseError(res, error); }
});

router.delete('/artifacts/:id', async (req: AuthRequest, res) => {
  const deleteExternal = String(req.query.external || '').toLowerCase() === 'true';
  try { const result = await deleteArtifactReference(phone(req), String(req.params.id), deleteExternal); return result.deleted ? res.json({ success: true, ...result, externalDeletionRequested: deleteExternal }) : res.status(404).json({ success: false, error: 'Artifact not found.' }); }
  catch (error) { return responseError(res, error); }
});

export default router;
