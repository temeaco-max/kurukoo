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
const { cancelAgentGoal, createConversationGoal, getAgentGoal, goalTimeline, listAgentGoalEvents, listAgentGoals, runAgentGoal, runDueAgentGoals } = await import('../src/services/agentRuntime.js');
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

const projector = `+234809${String(Date.now()).slice(-7)}`;
await upsertProfile(projector, 'Projection User');
const projectionGoal = await createConversationGoal({ phone: projector, conversationId: 'conversation-capability-projection', skill: 'find_worker', objective: 'Project a canonical capability outcome', persistWhenDisabled: true });
assert.ok(projectionGoal, 'A persistent Goal can be created for capability projection');
await syncAgentGoalFromCapabilityResult({ phone: projector, goalId: projectionGoal!.id, capability: 'skill.find_worker', action: 'observe', idempotencyKey: 'projection-test-1', outcome: { status: 'completed', capability: 'skill.find_worker', action: 'observe', canonicalObjectId: projectionGoal!.id, evidence: 'test:canonical-capability:completed', message: 'Canonical capability outcome recorded.' } });
const projected = await getAgentGoal(projector, projectionGoal!.id);
assert.ok(['active', 'completed'].includes(String(projected?.status)), 'Capability outcomes must update the canonical Agent Goal progression');
assert.match(String(projected?.summary), /Canonical capability outcome recorded/i, 'Capability outcome summary must persist');
assert.ok((await goalTimeline(projector, "conversation-capability-projection")).events.some(event => event.action === 'skill.find_worker:observe'), 'Capability outcome must create one durable Goal event');

const db = await getDb();
const checkpointGoal = await createConversationGoal({ phone: owner, conversationId: 'conversation-nonretry-checkpoint', skill: 'find_worker', objective: 'Wait for my explicit confirmation before any consequential action.' });
assert.equal(checkpointGoal?.status, 'needs_user', 'A consequential Goal must begin at an explicit user checkpoint.');
const needsUserEventCount = (await listAgentGoalEvents(owner, checkpointGoal!.id)).length;
assert.equal((await runAgentGoal(checkpointGoal!.id, owner))?.status, 'needs_user', 'Direct runtime re-entry must preserve a needs_user checkpoint.');
assert.equal((await listAgentGoalEvents(owner, checkpointGoal!.id)).length, needsUserEventCount, 'Needs-user re-entry must not record tool activity or create a worker spin.');
db.run(`UPDATE agent_goals SET status='blocked', next_action_at=datetime('now','-1 minute') WHERE id=?`, [checkpointGoal!.id]);
const blockedEventCount = (await listAgentGoalEvents(owner, checkpointGoal!.id)).length;
assert.equal((await runAgentGoal(checkpointGoal!.id, owner))?.status, 'blocked', 'Direct runtime re-entry must preserve a blocked checkpoint.');
assert.equal((await listAgentGoalEvents(owner, checkpointGoal!.id)).length, blockedEventCount, 'Blocked re-entry must not record tool activity or create a worker spin.');

const budgetOwner = `+234810${String(Date.now()).slice(-7)}`;
await upsertProfile(budgetOwner, 'Budget Checkpoint Owner');
const budgetRequest = await createEconomicRequest({ id: `agent-budget-${Date.now()}`, phone: budgetOwner, skill: 'find_worker', requirements: { location: 'Ikeja', description: 'Budget checkpoint proof' } });
const budgetGoal = await createConversationGoal({ phone: budgetOwner, conversationId: 'conversation-budget-checkpoint', skill: 'find_worker', objective: 'Stop safely when the bounded action budget is exhausted.', economicRequestId: budgetRequest.id });
assert.equal(budgetGoal?.status, 'active', 'A request-linked budget fixture must begin on the canonical active path.');
const exhaustedContext = {
  executionId: `budget-exhausted-${Date.now()}`,
  budget: { maxActions: 1, maxRetries: 1, maxElapsedMs: 120000, maxConcurrentGoals: 10 },
  usage: { actions: 1, retries: 0, startedAtMs: Date.now(), estimatedCostMinor: 0 },
};
const budgetStopped = await runAgentGoal(budgetGoal!.id, budgetOwner, exhaustedContext as any);
assert.equal(budgetStopped?.status, 'needs_user', 'Action-budget exhaustion must become a durable explicit user checkpoint.');
assert.equal(budgetStopped?.nextActionAt, undefined, 'A budget checkpoint must be unscheduled rather than retried automatically.');
const budgetTrace = await listAgentExecutionTrace(budgetOwner, budgetGoal!.id);
assert.ok(budgetTrace.some(event => event.kind === 'execution_stopped' && event.status === 'needs_user' && event.reason === 'max_actions'), 'Action-budget exhaustion must retain a durable, correlated stop trace.');
const budgetEventCount = (await listAgentGoalEvents(budgetOwner, budgetGoal!.id)).length;
assert.equal((await runAgentGoal(budgetGoal!.id, budgetOwner, exhaustedContext as any))?.status, 'needs_user', 'A budget checkpoint must not re-enter without an explicit canonical resume.');
assert.equal((await listAgentGoalEvents(budgetOwner, budgetGoal!.id)).length, budgetEventCount, 'Re-entering an action-budget checkpoint must not create a worker spin.');

const concurrencyOwner = `+234811${String(Date.now()).slice(-7)}`;
await upsertProfile(concurrencyOwner, 'Concurrency Checkpoint Owner');
const occupiedRequest = await createEconomicRequest({ id: `agent-concurrency-occupied-${Date.now()}`, phone: concurrencyOwner, skill: 'find_worker', requirements: { location: 'Ikeja', description: 'Occupy concurrency budget' } });
const occupiedGoal = await createConversationGoal({ phone: concurrencyOwner, conversationId: 'conversation-concurrency-occupied', skill: 'find_worker', objective: 'Occupy one owned concurrency slot.', economicRequestId: occupiedRequest.id });
assert.equal(occupiedGoal?.status, 'active', 'The concurrency fixture must retain one separate active Goal.');
const concurrencyRequest = await createEconomicRequest({ id: `agent-concurrency-${Date.now()}`, phone: concurrencyOwner, skill: 'find_worker', requirements: { location: 'Ikeja', description: 'Concurrency checkpoint proof' } });
const concurrencyGoal = await createConversationGoal({ phone: concurrencyOwner, conversationId: 'conversation-concurrency-checkpoint', skill: 'find_worker', objective: 'Stop safely when another owned goal occupies the concurrency budget.', economicRequestId: concurrencyRequest.id });
assert.equal(concurrencyGoal?.status, 'active', 'A concurrency fixture must begin on the canonical active path.');
const concurrencyStopped = await runAgentGoal(concurrencyGoal!.id, concurrencyOwner, {
  executionId: `concurrency-exhausted-${Date.now()}`,
  budget: { maxActions: 2, maxRetries: 1, maxElapsedMs: 120000, maxConcurrentGoals: 1 },
  usage: { actions: 0, retries: 0, startedAtMs: Date.now(), estimatedCostMinor: 0 },
} as any);
assert.equal(concurrencyStopped?.status, 'blocked', 'Concurrent-goal exhaustion must become a durable blocked checkpoint.');
assert.equal(concurrencyStopped?.nextActionAt, undefined, 'A concurrency checkpoint must not be scheduled for automatic re-entry.');
const concurrencyTrace = await listAgentExecutionTrace(concurrencyOwner, concurrencyGoal!.id);
assert.ok(concurrencyTrace.some(event => event.kind === 'execution_stopped' && event.status === 'blocked' && event.reason === 'max_concurrent_goals'), 'Concurrent-goal exhaustion must retain a durable stop trace.');

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
console.log('Agent runtime regression passed: persistent owned goals, idempotency, bounded tools, waiting-only worker re-entry, non-retry checkpoints, durable action/concurrency budget checkpoints, canonical capability outcome persistence, durable execution trace, quality evaluation, cancellation, disabled mode, and high-risk denial.');
