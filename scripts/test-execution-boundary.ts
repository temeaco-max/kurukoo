import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `kurukoo-execution-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.KURUKOO_PAY_PROVIDER = 'sandbox';
process.env.FF_PRIVATE_NUMBER_MASKING = 'true';
process.env.NUMBER_MASKING_PROVIDER = 'test-proxy-provider';

const { getDb, saveDb } = await import('../src/database.js');
const { createEconomicRequest, getEconomicRequest } = await import('../src/services/skillFlows.js');
const { addEconomicParticipant } = await import('../src/services/economicParticipants.js');
const { getRealNumber, getPrivacyBridgeStatus } = await import('../src/services/privacyBridge.js');
const {
  authorizeProviderConnector,
  revokeProviderConnector,
  authorizeProviderExecution,
  createExecutionRequest,
  dispatchExecutionRequest,
  completeDevelopmentExecution,
  getExecutionRequest,
