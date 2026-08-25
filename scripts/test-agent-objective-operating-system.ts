/**
 * End-to-end contract for the canonical Objective Operating System.
 *
 * Exercises the already-merged Agent Runtime integration across:
 *   Goal creation -> bounded execution -> tool/policy tracing -> quality gate.
 *
 * This is intentionally local/deterministic: no provider, payment, or fulfilment
 * side effect is invoked. Real external outcomes still require their own proof.
 */
import { createConversationGoal, getAgentGoal, runAgentGoal, listAgentGoalEvents } from '../src/services/agentRuntime.js';
import { listAgentExecutionTrace } from '../src/services/agentExecutionTrace.js';

function check(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    throw new Error(`FAIL ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  }
  console.log(`PASS ${name}`);
}

async function main() {
  process.env.KURUKOO_AGENT_ENABLED = 'true';
  process.env.KURUKOO_AGENT_AUTONOMOUS = 'true';
  process.env.KURUKOO_AGENT_MAX_ACTIONS_PER_CYCLE = '2';
  process.env.KURUKOO_AGENT_MAX_RETRIES = '1';
  process.env.KURUKOO_AGENT_MAX_ELAPSED_MS = '120000';

  const phone = `objective_os_${Date.now()}`;
  const conversationId = `conv_${Date.now()}`;
  const goal = await createConversationGoal({
    phone,
    conversationId,
    skill: 'find_worker',
    objective: 'Find a suitable provider for a laptop repair',
    persistWhenDisabled: true,
  });

  check('goal created', Boolean(goal), goal);
  check('goal owner persisted', goal?.phone === phone);
  check('conversation context persisted', goal?.conversationId === conversationId);

  const before = await getAgentGoal(phone, goal!.id);
  check('goal reload works before execution', before?.id === goal!.id);

  const after = await runAgentGoal(goal!.id, phone);
  check('runtime returns a goal state', Boolean(after), after);
  check('runtime does not fabricate completion', after?.status !== 'completed', after?.status);

  const trace = await listAgentExecutionTrace(phone, goal!.id);
  check('execution trace exists', trace.length > 0, trace.length);
  check('goal_started traced', trace.some((event) => event.kind === 'goal_started'));
  check('policy decision traced', trace.some((event) => event.kind === 'policy_decision'));
  check('tool call traced', trace.some((event) => event.kind === 'tool_call'));
  check('continuation traced', trace.some((event) => event.kind === 'continuation'));
  check('trace is owner-scoped', trace.every((event) => event.ownerPhone === phone));
  check('trace is goal-scoped', trace.every((event) => event.goalId === goal!.id));

  const events = await listAgentGoalEvents(phone, goal!.id);
  check('durable goal events exist', events.length > 0, events.length);
  check('no fabricated success outcome', !events.some((event) => event.result === 'success' && event.action === 'completed'));

  console.log(`RESULT: Objective Operating System contract passed (${trace.length} trace events, ${events.length} goal events)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
