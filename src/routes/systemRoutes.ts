/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * System documentation boundary. Health remains owned by healthRoutes.
 */
import { Router } from 'express';
import path from 'path';
import { EXECUTION_NETWORK_CONTRACT_VERSION, listExecutionNetworkPillars, validateExecutionNetworkContract } from '../services/executionNetworkContract.js';

const router = Router();

router.get('/api/docs', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'frontend/public', 'api-docs.html'));
});

/**
 * Publicly inspectable product contract. This endpoint exposes strategy and
 * readiness metadata only; it does not expose user, provider, payment or
 * execution records and does not create a second execution authority.
 */
router.get('/api/execution-network', (_req, res) => {
  const validation = validateExecutionNetworkContract();
  res.status(validation.valid ? 200 : 500).json({
    success: validation.valid,
    protocol: 'kurukoo-execution-network-v1',
    contractVersion: EXECUTION_NETWORK_CONTRACT_VERSION,
    product: 'Kurukoo — the execution network for people and AI',
    consumerPromise: 'AI that gets things done.',
    interaction: ['ask', 'decide', 'done'],
    lifecycle: ['requested', 'clarifying', 'awaiting_match', 'quoted', 'awaiting_confirmation', 'accepted', 'executing', 'evidence_pending', 'completed', 'cancelled', 'failed', 'disputed', 'abandoned', 'waiting'],
    validation,
    pillars: listExecutionNetworkPillars(),
  });
});

export default router;
