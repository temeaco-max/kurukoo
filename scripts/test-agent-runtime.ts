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
const { cancelAgentGoal, createConversationGoal, getAgentGoal, goalTimeline, listAgentGoals, runAgentGoal, runDueAgentGoals, resumeAgentGoal, completeAgentGoal } = await import('../src/services/agentRuntime.js');
const { listAgentExecutionTrace } = await import('../src/services/agentExecutionTrace.js');
const { syncAgentGoalFromCapabilityResult } = await import('../src/services/agentCapabilityOutcomeService.js');
const { createCompoundGoalIfRecognized } = await import('../src/services/compoundGoalLifecycle.js');
const { syncSubGoalStatusesWithDependencies } = await import('../src/services/agentEconomicRequestOrchestrator.js');
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
assert.ok(trace.some(event => event.kind === 'budget_checked'), 'Runtime must record the execution-budget decision');
assert.ok(trace.some(event => event.kind === 'tool_completed' && event.tool === 'get_request_state'), 'Runtime must trace the existing Agent Tool Registry call');
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
assert.equal(projected?.status, 'active', 'Capability outcomes must remain active until the canonical quality gate verifies the Agent Goal');
assert.match(String(projected?.summary), /Canonical capability outcome recorded/i, 'Capability outcome summary must persist');
assert.ok((await goalTimeline(owner, 'conversation-capability-projection')).events.some(event => event.action === 'skill.find_worker:observe'), 'Capability outcome must create one durable Goal event');

// Actual runtime execution proof: a deterministic reminder capability is selected
// by the Agent plan, invoked through the Tool Registry, projected through the
// canonical capability outcome service, and completed only after the quality gate.
const reminderGoal = await createConversationGoal({
  phone: owner,
  conversationId: 'conversation-agent-reminder-execution',
  skill: 'reminder',
  objective: 'Remind me tomorrow to call John.',
  executionArguments: { title: 'Call John', dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
  persistWhenDisabled: true,
});
assert.ok(reminderGoal, 'Reminder execution goal must persist through the canonical Agent runtime');
const reminderCompleted = await runAgentGoal(reminderGoal!.id, owner);
assert.equal(reminderCompleted?.status, 'completed', 'Agent runtime must complete a deterministic reminder through registry -> canonical executor -> quality gate');
const reminderTrace = await listAgentExecutionTrace(owner, reminderGoal!.id);
assert.ok(reminderTrace.some(event => event.kind === 'tool_selected' && event.tool === 'inspect_capability_plan'), 'Runtime must record tool selection');
assert.ok(reminderTrace.some(event => event.kind === 'tool_started' && event.tool === 'execute_capability'), 'Runtime must record canonical capability execution start');
assert.ok(reminderTrace.some(event => event.kind === 'tool_completed' && event.tool === 'execute_capability'), 'Runtime must record canonical capability execution completion');
assert.ok(reminderTrace.some(event => event.kind === 'evidence_recorded'), 'Runtime must record canonical capability evidence');
assert.ok(reminderTrace.some(event => event.kind === 'quality_evaluated' && event.status === 'pass'), 'Runtime must evaluate quality before completing the Goal');
assert.ok(reminderTrace.some(event => event.kind === 'goal_completed'), 'Runtime must record terminal Goal completion');
const reminderAgain = await runAgentGoal(reminderGoal!.id, owner);
assert.equal(reminderAgain?.status, 'completed', 'Completed capability execution must not repeat on worker re-entry');

// Explicit approval proof: resume without approval is insufficient; authenticated
// explicit approval resumes the exact Goal and the same canonical execution path.
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'false';
const approvalGoal = await createConversationGoal({
  phone: owner,
  conversationId: 'conversation-agent-approval',
  skill: 'reminder',
  objective: 'Create an approved reminder.',
  executionArguments: { title: 'Approved reminder', dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
  persistWhenDisabled: true,
});
assert.equal(approvalGoal?.status, 'needs_user', 'Consequential/non-autonomous capability work must enter needs_user');
assert.equal((await resumeAgentGoal(owner, approvalGoal!.id)).status, 'needs_user', 'Resume without explicit approval must not authorize the action');
assert.equal((await resumeAgentGoal(owner, approvalGoal!.id, true)).status, 'active', 'Explicit authenticated approval must resume the exact Goal');
assert.equal((await runAgentGoal(approvalGoal!.id, owner))?.status, 'completed', 'Approved Goal must continue through the canonical executor and quality gate');
process.env.KURUKOO_AGENT_AUTONOMOUS_LOW_RISK = 'true';

// Durable budget proof: usage belongs to the Goal execution state, so worker
// re-entry does not reset max-actions and silently perform another action.
process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '1';
const budgetGoal = await createConversationGoal({ phone: owner, conversationId: 'conversation-agent-budget', skill: 'find_worker', objective: 'Wait for the existing request.', economicRequestId: request.id, persistWhenDisabled: true });
const firstBudgetRun = await runAgentGoal(budgetGoal!.id, owner);
assert.equal(firstBudgetRun?.status, 'waiting', 'First bounded execution may consume its single action and wait');
const persistedBudgetGoal = await getAgentGoal(owner, budgetGoal!.id);
assert.equal(persistedBudgetGoal?.plan.execution?.usage.actions, 1, 'Execution usage must persist in canonical Goal state');
const executionId = persistedBudgetGoal?.plan.execution?.executionId;
const secondBudgetRun = await runAgentGoal(budgetGoal!.id, owner);
assert.equal(secondBudgetRun?.status, 'waiting', 'Re-entry after budget exhaustion must stop instead of resetting usage');
const budgetTrace = await listAgentExecutionTrace(owner, budgetGoal!.id);
assert.ok(budgetTrace.some(event => event.kind === 'execution_stopped' && event.reason === 'max_actions'), 'Budget exhaustion must be durable and visible in the execution trace');
assert.equal(budgetTrace.filter(event => event.metadata?.executionId === executionId).length > 0, true, 'The same execution correlation id must survive worker re-entry');
process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '2';

// Compound lifecycle proof: the existing dependency owner keeps the second
// sub-goal waiting until the first Goal completes, then makes it runnable.
const compound = await createCompoundGoalIfRecognized({ phone: owner, conversationId: 'conversation-compound-agent', objective: 'Fix my laptop and sell it when it is ready.' });
assert.ok(compound, 'Compound objective must decompose through the existing compound lifecycle');
assert.equal(compound!.subGoals.length, 2, 'Compound objective must create two canonical sub-goals');
assert.equal((await getAgentGoal(owner, compound!.subGoals[1].id))?.status, 'waiting_on_dependency', 'Dependent sub-goal must wait on the first Goal');
const firstChild = await getAgentGoal(owner, compound!.subGoals[0].id);
assert.ok(firstChild, 'First compound child must be owner-scoped and durable');
await getDb().then(db => db.run(`UPDATE agent_goals SET status='completed',next_action_at=NULL,completed_at=datetime('now'),updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [firstChild!.id, owner]));
await syncSubGoalStatusesWithDependencies(owner, compound!.parentGoal.id);
assert.equal((await getAgentGoal(owner, compound!.subGoals[1].id))?.status, 'active', 'Dependency refresh must make the next sub-goal runnable only after its prerequisite completes');

const db = await getDb();
db.run(`UPDATE agent_goals SET next_action_at=datetime('now','-1 minute') WHERE id=?`, [goal.id]);
const due = await runDueAgentGoals();
assert.ok(due.some(item => item.id === goal.id), 'Due goals must re-enter only through the bounded worker pass');
const traceAfterWorker = await listAgentExecutionTrace(owner, goal.id);
assert.ok(traceAfterWorker.some(event => event.metadata && typeof event.metadata.executionId === 'string'), 'Worker execution must carry a durable correlation id in trace metadata');
const cancelled = await cancelAgentGoal(owner, goal.id);
assert.equal(cancelled?.status, 'cancelled', 'The user can stop autonomous follow-up');
assert.equal((await runAgentGoal(goal.id, owner))?.status, 'cancelled', 'Cancelled goals must not resume automatically');

const economicLink = await (await import('../src/services/agentEconomicRequestOrchestrator.js')).getAgentEconomicRequestLink(owner, goal.id);
assert.equal(economicLink?.economicRequestId, request.id, 'Economic Request must remain linked to its Agent Goal');

process.env.KURUKOO_AGENT_ENABLED = 'true';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
assert.deepEqual(await runDueAgentGoals(), [], 'The worker must remain inactive until the explicit autonomous flag is enabled');
process.env.KURUKOO_AGENT_ENABLED = 'false';
process.env.KURUKOO_AGENT_AUTONOMOUS = 'false';
assert.equal(await createConversationGoal({ phone: owner, skill: 'find_worker', objective: 'Disabled runtime', economicRequestId: request.id }), null, 'Disabled runtime must preserve normal chat behaviour without creating goals');
console.log('Agent runtime regression passed: persistent owned goals, canonical registry execution, explicit approval, durable budget state, idempotency, compound dependency continuation, waiting states, economic linkage, durable execution trace, quality evaluation, cancellation, disabled mode, and high-risk denial.');
