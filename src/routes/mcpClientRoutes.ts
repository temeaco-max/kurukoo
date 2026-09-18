/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { callMcpTool, listMcpServers, registerMcpServer, setMcpServerStatus, testMcpServer } from '../services/mcpClientService.js';

const router = Router();
const phone = (req: AuthRequest): string => String(req.user?.phone || '').trim();

router.get('/mcp/servers', authenticateUser, async (req: AuthRequest, res) => {
  try { res.json({ success: true, servers: await listMcpServers(phone(req)) }); }
  catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to list MCP servers.' }); }
});

router.post('/mcp/servers', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const server = await registerMcpServer({ ownerPhone: phone(req), label: String(req.body?.label || ''), endpoint: String(req.body?.endpoint || ''), authHeader: typeof req.body?.authHeader === 'string' ? req.body.authHeader : undefined });
    res.status(201).json({ success: true, server });
  } catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to register the MCP server.' }); }
});

router.post('/mcp/servers/:id/status', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['active', 'disabled', 'revoked'].includes(status)) return res.status(400).json({ success: false, error: 'status must be active, disabled, or revoked.' });
    await setMcpServerStatus({ ownerPhone: phone(req), serverId: String(req.params.id), status: status as 'active' | 'disabled' | 'revoked' });
    res.json({ success: true, status });
  } catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to update the MCP server.' }); }
});

router.post('/mcp/servers/:id/test', authenticateUser, async (req: AuthRequest, res) => {
  try { res.json({ success: true, ...(await testMcpServer({ ownerPhone: phone(req), serverId: String(req.params.id) })) }); }
  catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to test the MCP server.' }); }
});

router.post('/mcp/servers/:id/tools/call', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const result = await callMcpTool({ ownerPhone: phone(req), serverId: String(req.params.id), toolName: String(req.body?.toolName || ''), toolInput: req.body?.toolInput });
    res.status(result.ok ? 200 : 422).json({ success: result.ok, ...result });
  } catch (error) { res.status(422).json({ success: false, error: error instanceof Error ? error.message : 'Unable to call the MCP tool.' }); }
});

export default router;