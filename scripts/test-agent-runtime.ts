import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDbPath = path.join(os.tmpdir(), `kurukoo-agent-runtime-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = isolatedDbPath;
process.on('exit', () => { try { fs.rmSync(isolatedDbPath, { force: true }); } catch {} });
process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'true';
process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '2';
process.env.KURUKOO_AGENT_MAX_CONCURRENT_GOALS = '2';
process.env.KURUKOO_AGENT_MAX_RETRIES = '1';
process.env.KURUKOO_AGENT_MAX_ELAPSED_MS = '120000';

const { upsertProfile } = await import('../src/routes/authRoutes.js');
const { createEconomicRequest } = await import('../src/services/skillFlows.js');
const { executeAgentTool, listAgentTools } = await import('../src/services/agentToolRegistry.js');
const { cancelAgentGoal, createConversationGoal, getAgentGoal, goalTimeline, listAgentGoals, runAgentGoal, runDueAgentGoals } = await import('../src/services/agentRuntime.js');
const { listAgentExecutionTrace } = await import('../src/services/agentExecutionTrace.js');
const { syncAgentGoalFromCapabilityResult } = await import('../src/services/agentCapabilityOutcomeService.js');
const { getDb } = await import('../src/database.js');
const { executeVoiceTool } = await import('../src/services/voiceToolRegistry.js');

const owner = `+234807${String(Date.now()).slice(-7)}`;
const other = `+234808${String(Date.now()).slice(-7)}`;
await upsertProfile(owner, 'Goal Owner');
await upsertProfile(other, 'Other User');
const request = await createEconomicRequest({ id: `agent-request-${Date.now()}`, phone: owner, skill: 'find_worker', requirements: { location: 'Ikeja', description: 'Car repair' } });

const goal = await createConversationGoal({ phone: owner, conversationId: 'conversation-agent-test', skill: 'find_worker', objective: 'Find a mechanic tomorrow.', economicRequestId: request.id });
assert.ok(goal, 'Enabled runtime must create one bounded owned goal for a canonical request');
assert.equal(goal.plan.riskLevel, 'user_confirmation_required', 'A request-linked plan must declare confirmation-required risk rather than grant autonomous commitment authority');
assert.equal(goal.plan.confirmationRequired, true, 'A request-linked plan must preserve a reusable confirmation gate');
assert.ok(goal.plan.steps.some(step => step.risk === 'read_only') && goal.plan.steps.some(step => step.risk === 'user_confirmation_required'), 'Persistent plans must retain bounded operational steps without hidden reasoning');
const declaredTools = listAgentTools();
assert.ok(declaredTools.every(tool => tool.description && tool.authorization && tool.risk && tool.idempotency && tool.audit === 'goal_event'), 'Every exposed tool must declare its contract, risk, authorization, idempotency and audit behaviour');
assert.equal((await createConversationGoal({ phone: owner, conversationId: 'conversation-agent-test', skill: 'find_worker', objective: 'Duplicate', economicRequestId: request.id }))?.id, goal.id, 'Duplicate conversation goals must be idempotent');
assert.equal(await getAgentGoal(other, goal.id), null, 'A user cannot read another user’s goal');
assert.equal((await listAgentGoals(owner)).filter(item => item.id === goal.id).length, 1, 'Only one active goal must exist for the same conversation and skill');

const inspected = await runAgentGoal(goal.id, owner);
assert.equal(inspected?.status, 'waiting', 'An unresolved canonical request must enter a truthful waiting state');
assert.match(String(inspected?.summary), /waiting/i, 'Waiting status must describe only the existing request state');
const timeline = await goalTimeline(owner, 'conversation-agent-test');
assert.equal(timeline.goal?.id, goal.id, 'Conversation timeline must resolve only the owner’s goal');
assert.ok(timeline.events.some(event => event.tool === 'get_request_state'), 'Runtime evaluation must record concise tool evidence');
const trace = await listAgentExecutionTrace(owner, goal.id);
assert.ok(trace.some(event => event.kind === 'goal_started'), 'Runtime must record a durable goal-start trace');
assert.ok(trace.some(event => event.kind === 'policy_decision'), 'Runtime must record the execution-budget decision');
assert.ok(trace.some(event => event.kind === 'tool_call' && event.tool === 'get_request_state'), 'Runtime must trace the existing Agent Tool Registry call');
assert.ok(trace.some(event => event.kind === 'outcome' && event.status === 'waiting'), 'Runtime must trace the truthful waiting outcome');
assert.ok(trace.every(event => event.ownerPhone === owner && event.goalId === goal.id), 'Trace records must remain owner- and goal-scoped');

const ownRequest = await executeAgentTool('get_request_state', { requestId: request.id }, { phone: owner, conversationId: 'conversation-agent-test', goalId: goal.id });
assert.equal(ownRequest.ok, true, 'Owned request state may be read through the controlled registry');
const foreignRequest = await executeAgentTool('get_request_state', { requestId: request.id }, { phone: other, goalId: 'forged' });
assert.equal(foreignRequest.ok, false, 'Forged or foreign tool arguments must fail ownership checks');
const voiceRouted = await executeVoiceTool('route_user_intent', { text: 'I need repair help in Ikeja' }, { phone: owner, conversationId: 'conversation-voice-agent-test', isGuest: false, sessionId: 'voice-agent-test' });
assert.ok(voiceRouted.agentGoal || voiceRouted.cardData?.type === 'agentic_storefront', 'Voice routing must remain on the canonical intent/storefront path and expose a shared bounded goal when enabled');
const unsafeTool = await executeAgentTool('payment' as any, {}, { phone: owner, goalId: goal.id });
assert.equal(unsafeTool.ok, false, 'High-risk payment or arbitrary tool names are unavailable to the runtime');
assert.equal(goal.plan.steps.some(step => step.tool === ('payment' as any)), false, 'Plans must not contain undeclared high-risk payment actions');

const projectionGoal = await createConversationGoal({ phone: owner, conversationId: 'conversation-capability-projection', skill: 'find_worker', objective: 'Project a canonical capability outcome', persistWhenDisabled: true });
assert.ok(projectionGoal, 'A persistent Goal can be created for capability projection');
await syncAgentGoalFromCapabilityResult({ phone: owner, goalId: projectionGoal!.id, capability: 'skill.find_worker', action: 'observe', idempotencyKey: 'projection-test-1', outcome: { status: 'completed', capability: 'skill.find_worker', action: 'observe', canonicalObjectId: projectionGoal!.id, evidence: 'test:canonical-capability:completed', message: 'Canonical capability outcome recorded.' } });
const projected = await getAgentGoal(owner, projectionGoal!.id);
assert.ok(['active', 'completed'].includes(String(projected?.status)), 'Capability outcomes must update the canonical Agent Goal progression');
assert.match(String(projected?.summary), /Canonical capability outcome recorded/i, 'Capability outcome summary must persist');
assert.ok((await goalTimeline(owner, 'conversation-capability-projection')).events.some(event => event.action === 'skill.find_worker:observe'), 'Capability outcome must create one durable Goal event');

const db = await getDb();
db.run(`UPDATE agent_goals SET next_action_at=datetime('now','-1 minute') WHERE id=?`, [goal.id]);
const due = await runDueAgentGoals();
assert.ok(due.some(item => item.id === goal.id), 'Due goals must re-enter only through the bounded worker pass');
const traceAfterWorker = await listAgentExecutionTrace(owner, goal.id);
assert.ok(traceAfterWorker.some(event => event.metadata && typeof event.metadata.executionId === 'string'), 'Worker execution must carry a durable correlation id in trace metadata');
const cancelled = await cancelAgentGoal(owner, goal.id);
assert.equal(cancelled?.status, 'cancelled', 'The user can stop autonomous follow-up');
assert.equal((await runAgentGoal(goal.id, owner))?.status, 'cancelled', 'Cancelled goals must not resume automatically');

process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
assert.deepEqual(await runDueAgentGoals(), [], 'The worker must remain inactive until the explicit autonomous flag is enabled');
process.env.KURUKOO_AGENT_ENABLED = 'false';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
assert.equal(await createConversationGoal({ phone: owner, skill: 'find_worker', objective: 'Disabled runtime', economicRequestId: request.id }), null, 'Disabled runtime must preserve normal chat behaviour without creating goals');
console.log('Agent runtime regression passed: persistent owned goals, idempotency, bounded tools, waiting and worker re-entry, canonical capability outcome persistence, durable execution trace, budget policy, quality evaluation, cancellation, disabled mode, and high-risk denial.');
