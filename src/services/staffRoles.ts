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
    name: 'Someone To Show My Request',
    purpose: 'Listens to what you need and makes sure it is set in motion.',
    owns: ['Listen to your request', 'Ask clarifying questions', 'Pass it to the right worker'],
    escalateOn: ['Waiting on a decision only a person can make', 'No clear plan possible without more details'],
  },
  request_coordinator: {
    id: 'request_coordinator',
    name: 'Work Mover',
    purpose: 'Makes sure the work you paid for gets tracked until it is done.',
    owns: ['Check if a quote is ready', 'Confirm a provider accepted', 'Verify completion before release'],
    escalateOn: ['Money waiting without proof', 'Provider has gone silent', 'Your dispute needs a human decision'],
  },
  discovery_matcher: {
    id: 'discovery_matcher',
    name: 'Local Finder',
    purpose: 'Finds real options near you and tells you honestly what is verified.',
    owns: ['List current nearby options', 'Show verified providers only', 'Decline to invent availability'],
    escalateOn: ['Cannot verify a provider is real', 'A location is no longer available'],
  },
  trust_reviewer: {
    id: 'trust_reviewer',
    name: 'Trust Watcher',
    purpose: 'Checks that people and services are real before you rely on them.',
    owns: ['Verify provider identity', 'Check for genuine reviews', 'Watch for unsafe contact requests'],
    escalateOn: ['Unverified seller has money', 'Contact request feels risky'],
  },
  fulfilment_monitor: {
    id: 'fulfilment_monitor',
    name: 'Job State Checker',
    purpose: 'Watches the delivery, ride, or repair job and only says what it can prove.',
    owns: ['Track job steps', 'Verify before releasing money', 'Confirm completion with evidence'],
    escalateOn: ['Job has gone quiet too long', 'Success cannot be proven'],
  },
  operations_keeper: {
    id: 'operations_keeper',
    name: 'Memory Keeper',
    purpose: 'Remembers what matters to you and makes sure follow-ups happen.',
    owns: ['Store your preferences', 'Set reminders', 'Follow up on unfinished work'],
    escalateOn: ['Memory conflicts with your request', 'A reminder fired without a clear path'],
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
