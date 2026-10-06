/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import type { AgentGoal } from './agentRuntime.js';

export type KurukooStaffRole =
  | 'conversation_concierge'
  | 'request_coordinator'
  | 'discovery_matcher'
  | 'trust_reviewer'
  | 'fulfilment_monitor'
  | 'operations_keeper';

export interface StaffRole {
  id: KurukooStaffRole;
  name: string;
  purpose: string;
  owns: string[];
  escalateOn: string[];
}

const ROLES: Record<KurukooStaffRole, StaffRole> = {
  conversation_concierge: {
    id: 'conversation_concierge',
    name: 'Conversation Concierge',
    purpose: 'Understands the request and keeps the same conversation context alive.',
    owns: ['understand intent', 'gather details', 'attach a live request or goal'],
    escalateOn: ['sensitive or consequential request without clear consent', 'ambiguous request that needs a human answer'],
  },
  request_coordinator: {
    id: 'request_coordinator',
    name: 'Request Coordinator',
    purpose: 'Moves a canonical request through its lifecycle in order.',
    owns: ['quote readiness', 'provider acceptance', 'progress evidence', 'completion verification'],
    escalateOn: ['money on the line without verified evidence', 'provider silence beyond tolerance', 'dispute between parties'],
  },
  discovery_matcher: {
    id: 'discovery_matcher',
    name: 'Discover Matcher',
    purpose: 'Surfaces real, current local options without claiming they are available.',
    owns: ['local options', 'provider detail honesty', 'recommendation bounds'],
    escalateOn: ['requested provider cannot be verified', 'requested option no longer appears available'],
  },
  trust_reviewer: {
    id: 'trust_reviewer',
    name: 'Trust Reviewer',
    purpose: 'Reviews provider identity, review legitimacy, disputes and trusted-contact risk.',
    owns: ['provider verification', 'dispute review', 'trust score coherence'],
    escalateOn: ['high-risk contact request', 'unverified provider with money fronted'],
  },
  fulfilment_monitor: {
    id: 'fulfilment_monitor',
    name: 'Fulfilment Monitor',
    purpose: 'Watches delivery, ride, and work-outcome steps and reports only evidenced state.',
    owns: ['delivery/ride step state', 'evidence continuity', 'completion boundaries'],
    escalateOn: ['step has gone silent beyond policy', 'success cannot be verified'],
  },
  operations_keeper: {
    id: 'operations_keeper',
    name: 'Operations Keeper',
    purpose: 'Keeps memory, reminders, and continuity accurate between turns.',
    owns: ['memory context', 'reminders', 'recurring preferences'],
    escalateOn: ['conflicting own-context memory', 'reminder fired without visibility'],
  },
};

export function listStaffRoles(): StaffRole[] {
  return Object.values(ROLES);
}

export function staffRoleForGoal(goal: Pick<AgentGoal, 'goalType' | 'objective'>): StaffRole {
  const text = `${goal.goalType} ${goal.objective}`.toLowerCase();
  if (/quickride|ride|keke|okada|taxi|driver|driver|transport/i.test(text)) return ROLES.fulfilment_monitor;
  if (/deliver|courier|package|shipping|handoff/i.test(text)) return ROLES.fulfilment_monitor;
  if (/escrow|dispute|trust|review|safety|verified/i.test(text)) return ROLES.trust_reviewer;
  if (/discover|nearby|local|find|shop|market|offer/i.test(text)) return ROLES.discovery_matcher;
  if (/remind|memory|preference|routine|follow.*up/i.test(text)) return ROLES.operations_keeper;
  if (/request|request_|work|task|coordin/i.test(text)) return ROLES.request_coordinator;
  return ROLES.conversation_concierge;
}

export interface StaffAssignment {
  goalId: string;
  role: StaffRole;
  objective: string;
  status: AgentGoal['status'];
  needsHuman: boolean;
  escalationReason?: string;
}

export function assignmentForGoal(goal: AgentGoal): StaffAssignment {
  const role = staffRoleForGoal(goal);
  const needsHuman = ['needs_user', 'blocked', 'failed', 'paused'].includes(goal.status);
  return {
    goalId: goal.id,
    role,
    objective: goal.objective.slice(0, 180),
    status: goal.status,
    needsHuman,
    escalationReason: needsHuman ? goal.summary || goal.failureReason || role.escalateOn.join('; ') : undefined,
  };
}

/** Daily-owner supervision surface: every active goal and the human prompts it requires. */
export function ownerDashboardForGoals(goals: AgentGoal[]): { running: StaffAssignment[]; needsYou: StaffAssignment[] } {
  const assignments = goals.map(assignmentForGoal);
  return {
    running: assignments.filter(item => !item.needsHuman),
    needsYou: assignments.filter(item => item.needsHuman),
  };
}

export function roleForGoalType(goalType: string): StaffRole {
  return staffRoleForGoal({ goalType, objective: '' });
}
