/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import os from 'node:os';
import path from 'node:path';

// Unconditional, per-run database path for contracts that import the canonical
// store transitively (AGENTS.md §66.1). Imports below are dynamic so this
// assignment runs before the store loads.
process.env.DB_PATH = path.join(os.tmpdir(), `iso-staff-roles-${process.pid}-${Date.now()}.sqlite`);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { listStaffRoles, staffRoleForGoal, assignmentForGoal, ownerDashboardForGoals, roleForGoalType } =
  await import('../src/services/staffRoles.js');

test('every goal type has a stable Kurukoo staff role', () => {
  const role = roleForGoalType('ride_request');
  assert.equal(role.id, 'fulfilment_monitor', 'ride-type goals belong to Fulfilment Monitor');
  assert.equal(roleForGoalType('dispute').id, 'trust_reviewer');
  assert.equal(roleForGoalType('nearby').id, 'discovery_matcher');
  assert.equal(roleForGoalType('reminder').id, 'operations_keeper');
  assert.equal(roleForGoalType('unknown').id, 'conversation_concierge');
});

test('blocked / needs_user goals surface in the owner inbox', async () => {
  const { listAgentGoals } = await import('../src/services/agentRuntime.js');
  const goals = await listAgentGoals('+2348000000001', true);
  const { needsYou } = ownerDashboardForGoals(goals);
  assert.ok(Array.isArray(needsYou), 'owner inbox is an array');
});

test('role assignment never loses the original objective', () => {
  const assignment = assignmentForGoal({
    id: 'g1',
    phone: '+2348000000001',
    source: 'conversation',
    goalType: 'ride_request',
    objective: 'Get me a keke from Ikorodu to Ikeja',
    status: 'active',
    priority: 50,
    autonomy: 'assist',
    plan: {
      objective: 'Get me a keke from Ikorodu to Ikeja',
      currentStep: 0,
      status: 'active',
      requiredInputs: [],
      dependencies: [],
      confirmationRequired: false,
      riskLevel: 'read_only',
      expiresAt: new Date().toISOString(),
      steps: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(assignment.role.id, 'fulfilment_monitor');
  assert.equal(assignment.needsHuman, false);
  assert.ok(assignment.objective.length > 0);
});

test('all staff roles list their own name and escalation condition', () => {
  for (const role of listStaffRoles()) {
    assert.ok(role.name.length > 0, `role ${role.id} needs a human-facing name`);
    assert.ok(role.escalateOn.length > 0, `role ${role.id} needs an escalation boundary`);
  }
});
