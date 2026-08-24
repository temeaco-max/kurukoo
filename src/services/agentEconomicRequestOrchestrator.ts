import crypto from 'node:crypto';
import { getEconomicRequest } from './economicRequestPersistence.js';
import { getCanonicalPersistenceMode } from './canonicalPersistence.js';
import { getCanonicalStore } from './canonicalStore.js';

export type AgentEconomicLinkStatus = 'linked' | 'waiting' | 'blocked' | 'completed';

export interface AgentEconomicLink {
  goalId: string;
  economicRequestId: string;
  phone: string;
  requestStatus: string;
  goalStatus: string;
  status: AgentEconomicLinkStatus;
  nextAction: string;
}

export interface CompoundGoalDependency {
  id: string;
  phone: string;
  parentGoalId: string;
  economicRequestId?: string;
  skill: string;
  purpose: string;
  status: 'pending' | 'ready' | 'waiting' | 'completed' | 'blocked';
  blockedBy?: string;
}

async function ensureSchema() {
  const store = await getCanonicalStore();
  await store.run(`CREATE TABLE IF NOT EXISTS agent_goal_dependencies (id TEXT PRIMARY KEY, phone TEXT NOT NULL, parent_goal_id TEXT NOT NULL, economic_request_id TEXT, skill TEXT NOT NULL, purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', blocked_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(parent_goal_id, skill, purpose))`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_agent_goal_dependencies_parent ON agent_goal_dependencies(phone,parent_goal_id,status)`);
  await store.run(`CREATE INDEX IF NOT EXISTS idx_agent_goal_dependencies_request ON agent_goal_dependencies(economic_request_id,status)`);
  return store;
}

export function requestStatusToLinkStatus(requestStatus: string): AgentEconomicLinkStatus {
  if (['fulfilled', 'completed'].includes(requestStatus)) return 'completed';
  if (['failed', 'cancelled', 'abandoned', 'disputed'].includes(requestStatus)) return 'blocked';
  if (['awaiting_confirmation', 'payment_pending'].includes(requestStatus)) return 'waiting';
  return 'linked';
}

export function nextActionForRequest(status: string): string {
  if (status === 'requested') return 'awaiting matching / fulfilment';
  if (status === 'awaiting_match' || status === 'partially_matched') return 'continue provider matching';
  if (['matched', 'quoting'].includes(status)) return 'awaiting quote';
  if (['quoted', 'awaiting_confirmation'].includes(status)) return 'review and confirm the quote';
  if (['reserved', 'payment_pending'].includes(status)) return 'complete the authorized payment step';
  if (['paid', 'in_fulfillment'].includes(status)) return 'monitor fulfilment';
  if (status === 'fulfilled') return 'record the outcome and continue the objective';
  if (status === 'completed') return 'review the completed outcome';
  return 'resolve the blocked request before continuing';
}

export async function getAgentEconomicRequestLink(phone: string, goalId: string): Promise<AgentEconomicLink | null> {
  await ensureSchema();
  const owner = String(phone || '').trim();
  if (!owner) return null;
  const store = await getCanonicalStore();
  const goal = await store.one<any>(`SELECT id,phone,economic_request_id,status FROM agent_goals WHERE id=? AND phone=? LIMIT 1`, [goalId, owner]);
  if (!goal?.economic_request_id) return null;
  const request = await getEconomicRequest(String(goal.economic_request_id));
  if (!request || request.phone !== owner) return null;
  return { goalId: String(goal.id), economicRequestId: request.id, phone: owner, requestStatus: request.status, goalStatus: String(goal.status), status: requestStatusToLinkStatus(request.status), nextAction: nextActionForRequest(request.status) };
}

export async function attachAgentGoalDependency(input: { phone: string; parentGoalId: string; skill: string; purpose: string; economicRequestId?: string; blockedBy?: string; }): Promise<CompoundGoalDependency> {
  const owner = String(input.phone || '').trim();
  const skill = String(input.skill || '').trim().toLowerCase();
  const purpose = String(input.purpose || '').trim();
  if (!owner || !input.parentGoalId || !skill || !purpose) throw new Error('Owner, parent goal, skill and purpose are required');
  await ensureSchema();
  const store = await getCanonicalStore();
  const parent = await store.one<any>('SELECT id FROM agent_goals WHERE id=? AND phone=? LIMIT 1', [input.parentGoalId, owner]);
  if (!parent) throw new Error('Parent Agent Goal ownership is required');
  if (input.economicRequestId) {
    const request = await getEconomicRequest(input.economicRequestId);
    if (!request || request.phone !== owner) throw new Error('Economic Request ownership is required');
  }
  const id = `agd_${crypto.randomUUID()}`;
  const status: CompoundGoalDependency['status'] = input.blockedBy ? 'waiting' : input.economicRequestId ? 'ready' : 'pending';
  await store.run(`INSERT INTO agent_goal_dependencies(id,phone,parent_goal_id,economic_request_id,skill,purpose,status,blocked_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(parent_goal_id,skill,purpose) DO UPDATE SET economic_request_id=COALESCE(excluded.economic_request_id,agent_goal_dependencies.economic_request_id),status=excluded.status,blocked_by=excluded.blocked_by,updated_at=CURRENT_TIMESTAMP`, [id, owner, input.parentGoalId, input.economicRequestId || null, skill, purpose, status, input.blockedBy || null]);
  const row = await store.one<any>(`SELECT * FROM agent_goal_dependencies WHERE parent_goal_id=? AND skill=? AND purpose=? AND phone=? LIMIT 1`, [input.parentGoalId, skill, purpose, owner]);
  return { id: String(row.id), phone: owner, parentGoalId: String(row.parent_goal_id), economicRequestId: row.economic_request_id ? String(row.economic_request_id) : undefined, skill: String(row.skill), purpose: String(row.purpose), status: String(row.status) as CompoundGoalDependency['status'], blockedBy: row.blocked_by ? String(row.blocked_by) : undefined };
}

export async function listAgentGoalDependencies(phone: string, parentGoalId: string): Promise<CompoundGoalDependency[]> {
  await ensureSchema();
  const owner = String(phone || '').trim();
  const store = await getCanonicalStore();
  return (await store.all<any>(`SELECT * FROM agent_goal_dependencies WHERE phone=? AND parent_goal_id=? ORDER BY created_at ASC`, [owner, parentGoalId])).map(row => ({ id: String(row.id), phone: owner, parentGoalId: String(row.parent_goal_id), economicRequestId: row.economic_request_id ? String(row.economic_request_id) : undefined, skill: String(row.skill), purpose: String(row.purpose), status: String(row.status) as CompoundGoalDependency['status'], blockedBy: row.blocked_by ? String(row.blocked_by) : undefined }));
}

export async function refreshAgentGoalDependencies(phone: string, parentGoalId: string): Promise<CompoundGoalDependency[]> {
  const dependencies = await listAgentGoalDependencies(phone, parentGoalId);
  if (!dependencies.length) return dependencies;
  const store = await getCanonicalStore();
  for (const dependency of dependencies) {
    let status = dependency.status;
    let blockedBy = dependency.blockedBy;

    if (dependency.economicRequestId) {
      const request = await getEconomicRequest(dependency.economicRequestId);
      if (!request || request.phone !== phone) {
        status = 'blocked'; blockedBy = 'economic_request_unavailable';
      } else if (['fulfilled', 'completed'].includes(request.status)) {
        status = 'completed'; blockedBy = undefined;
      } else if (['failed', 'cancelled', 'abandoned', 'disputed'].includes(request.status)) {
        status = 'blocked'; blockedBy = `economic_request:${request.status}`;
      } else if (dependency.blockedBy?.startsWith('goal:')) {
        const blockingGoalId = dependency.blockedBy.slice('goal:'.length);
        const blockingGoal = await store.one<any>('SELECT status FROM agent_goals WHERE id=? AND phone=? LIMIT 1', [blockingGoalId, phone]);
        if (!blockingGoal) { status = 'blocked'; blockedBy = 'blocking_goal_unavailable'; }
        else if (blockingGoal.status === 'completed') { status = 'ready'; blockedBy = undefined; }
        else if (['failed', 'cancelled', 'expired'].includes(String(blockingGoal.status))) { status = 'blocked'; blockedBy = `goal:${blockingGoal.status}`; }
        else status = 'waiting';
      } else {
        status = 'ready';
      }
    } else if (dependency.blockedBy?.startsWith('goal:')) {
      const blockingGoalId = dependency.blockedBy.slice('goal:'.length);
      const blockingGoal = await store.one<any>('SELECT status FROM agent_goals WHERE id=? AND phone=? LIMIT 1', [blockingGoalId, phone]);
      if (!blockingGoal) { status = 'blocked'; blockedBy = 'blocking_goal_unavailable'; }
      else if (blockingGoal.status === 'completed') { status = 'ready'; blockedBy = undefined; }
      else if (['failed', 'cancelled', 'expired'].includes(String(blockingGoal.status))) { status = 'blocked'; blockedBy = `goal:${blockingGoal.status}`; }
      else status = 'waiting';
    } else if (!dependency.economicRequestId && !dependency.blockedBy) {
      status = 'pending';
    }

    if (status !== dependency.status || blockedBy !== dependency.blockedBy) {
      await store.run(`UPDATE agent_goal_dependencies SET status=?,blocked_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND phone=?`, [status, blockedBy || null, dependency.id, phone]);
    }
  }
  return listAgentGoalDependencies(phone, parentGoalId);
}

export async function isAgentGoalReadyForContinuation(phone: string, parentGoalId: string): Promise<boolean> {
  const refreshed = await refreshAgentGoalDependencies(phone, parentGoalId);
  return refreshed.every(item => ['ready', 'completed'].includes(item.status));
}

export function agentEconomicRequestPersistenceMode(): 'postgres' | 'sqljs' { return getCanonicalPersistenceMode() === 'postgres' ? 'postgres' : 'sqljs'; }
