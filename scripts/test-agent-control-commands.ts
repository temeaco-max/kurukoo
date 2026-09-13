/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
process.env.NODE_ENV = 'test';
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
process.env.KURUKOO_DISABLE_LISTEN = 'true';

import fs from 'node:fs';

const { processCanonicalChatTurn } = await import('../src/services/canonicalChatTurnService.js');
const { createConversationGoal, getAgentGoal, listAgentGoals, runAgentGoal } = await import('../src/services/agentRuntime.js');

const phone = `+234701${Date.now().toString().slice(-7)}`;
const conversationId = `control-${Date.now()}`;
const created = await createConversationGoal({ phone, conversationId, skill: 'reminder', objective: 'Keep checking my reminder request', source: 'conversation' });
if (!created) throw new Error('Could not create test autonomous goal');

const paused = await processCanonicalChatTurn({ phone, message: 'pause that', channel: 'web', conversationId });
if (!paused.agentGoal || paused.agentGoal.status !== 'paused' || !/paused/i.test(paused.reply)) throw new Error(`Pause command was not applied: ${JSON.stringify(paused)}`);

const pausedPersisted = await getAgentGoal(phone, created.id);
if (pausedPersisted?.status !== 'paused' || pausedPersisted.nextActionAt) throw new Error(`Paused state must persist without a scheduled action: ${JSON.stringify(pausedPersisted)}`);
if (!(await listAgentGoals(phone)).some((goal) => goal.id === created.id && goal.status === 'paused')) throw new Error('Paused work must remain visible in the default owner-scoped Agent list.');
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
const pausedExecution = await runAgentGoal(created.id, phone);
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
if (pausedExecution?.status !== 'paused') throw new Error(`Paused work must not re-enter autonomous execution: ${JSON.stringify(pausedExecution)}`);
const reused = await createConversationGoal({ phone, conversationId, skill: 'reminder', objective: 'Keep checking my reminder request', source: 'conversation' });
if (!reused || reused.id !== created.id || reused.status !== 'paused') throw new Error(`Paused work must be reused rather than duplicated: ${JSON.stringify(reused)}`);

const resumed = await processCanonicalChatTurn({ phone, message: 'resume that', channel: 'web', conversationId });
if (!resumed.agentGoal || resumed.agentGoal.status !== 'needs_user' || !/resumed/i.test(resumed.reply)) throw new Error(`Resume command was not applied: ${JSON.stringify(resumed)}`);

const cancelled = await processCanonicalChatTurn({ phone, message: 'cancel that', channel: 'web', conversationId });
if (!cancelled.agentGoal || cancelled.agentGoal.status !== 'cancelled' || !/stop following|asked Kurukoo to stop/i.test(cancelled.reply)) throw new Error(`Cancel command was not applied: ${JSON.stringify(cancelled)}`);

const persisted = await getAgentGoal(phone, created.id);
if (persisted?.status !== 'cancelled') throw new Error(`Final goal state was not persisted: ${persisted?.status}`);

const agentSurface = fs.readFileSync('frontend/public/js/kurukoo-agents-convergence.js', 'utf8');
for (const required of ['data-agent-goal-action', '/api/agent/goals/${encodeURIComponent(goalId)}/${action}', 'conversationId=${encodeURIComponent(conversationId)}', "window.confirm('Cancel this work item? This stops further automatic progress.')", "paused: 'Paused by you'", "failed: 'Needs recovery'", "status === 'paused'", "data-agents-live", "Work is paused. Resume when you want Kurukoo to continue.", "Review the decision Kurukoo needs before work can continue.", "!['cancelled', 'completed', 'failed', 'expired'].includes(status)"]) {
  if (!agentSurface.includes(required)) throw new Error(`Native Agent control surface is missing ${required}`);
}
if (agentSurface.includes('g.id?` · ${g.id}`')) throw new Error('Native Agent control surface must not expose raw goal identifiers.');
console.log('Agent control command regression passed: natural-language pause, resume, and cancel remain owner-scoped and persisted; the native Agent surface retains exact Chat continuation and confirmed controls.');
