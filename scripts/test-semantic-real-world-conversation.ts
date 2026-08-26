import assert from 'node:assert/strict';
import { buildConversationTurnContract } from '../src/services/conversationTurnContractService.js';
import type { SemanticConversationInterpretation } from '../src/services/semanticConversationInterpreter.js';

function semantic(patch: Partial<SemanticConversationInterpretation>): SemanticConversationInterpretation {
  return {
    mode: 'conversation',
    speechAct: 'conversation',
    intent: 'general_conversation',
    explicitAuthorization: false,
    requiresClarification: false,
    topicShift: false,
    resumption: false,
    references: [],
    entities: {},
    missingInformation: [],
    goalStatements: [],
    responseStrategy: 'answer',
    confidence: 0.95,
    source: 'llm',
    ...patch,
  };
}

const cases = [
  {
    name: 'implicit problem statement is not execution',
    turn: buildConversationTurnContract({
      latestUserMessage: 'My phone battery dies by lunchtime and I need it for work.',
      userMessage: 'My phone battery dies by lunchtime and I need it for work.',
      assistantReply: '',
      semanticInterpretation: semantic({ intent: 'phone_battery_problem', speechAct: 'conversation', goalStatements: ['Improve phone reliability'], entities: { device: 'phone', issue: 'battery' } }),
    }),
    expect: (turn: any) => assert.equal(turn.shouldAvoidAction, true),
  },
  {
    name: 'negation blocks an apparent action',
    turn: buildConversationTurnContract({
      latestUserMessage: 'Do not book anything yet. I just want to know the options.',
      userMessage: 'Do not book anything yet. I just want to know the options.',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'exploration', speechAct: 'rejection', intent: 'explore_without_booking', explicitAuthorization: false, responseStrategy: 'answer' }),
    }),
    expect: (turn: any) => { assert.equal(turn.shouldAvoidAction, true); assert.notEqual(turn.actionPosture, 'execute'); },
  },
  {
    name: 'reference resolution can preserve ambiguity',
    turn: buildConversationTurnContract({
      latestUserMessage: 'What about the other one?',
      userMessage: 'What about the other one?',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'reference', speechAct: 'question', intent: 'compare_other_option', requiresClarification: true, responseStrategy: 'clarify', references: [{ text: 'the other one', confidence: 0.41 }] }),
    }),
    expect: (turn: any) => { assert.equal(turn.mode, 'reference'); assert.equal(turn.shouldAvoidAction, true); assert.match(turn.responseRequirements.join('\n'), /clarif/i); },
  },
  {
    name: 'multi-goal turn should retain both goals',
    turn: buildConversationTurnContract({
      latestUserMessage: 'Help me find a mechanic tomorrow, and remind me to call my landlord tonight.',
      userMessage: 'Help me find a mechanic tomorrow, and remind me to call my landlord tonight.',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'action', speechAct: 'request', intent: 'find_mechanic_and_create_reminder', explicitAuthorization: true, responseStrategy: 'propose', goalStatements: ['Find a mechanic tomorrow', 'Call landlord tonight'], entities: { date: 'tomorrow', reminderTime: 'tonight' } }),
    }),
    expect: (turn: any) => { assert.equal(turn.semanticInterpretation?.goalStatements.length, 2); assert.equal(turn.shouldRequireCanonicalAction, true); },
  },
  {
    name: 'topic interruption should not erase prior goal',
    turn: buildConversationTurnContract({
      latestUserMessage: 'By the way, what is the weather going to be like?',
      userMessage: 'By the way, what is the weather going to be like?',
      assistantReply: '',
      currentGoal: 'Find a mechanic tomorrow',
      activeGoals: ['Find a mechanic tomorrow'],
      semanticInterpretation: semantic({ intent: 'ask_weather', topicShift: true, responseStrategy: 'answer' }),
    }),
    expect: (turn: any) => { assert.equal(turn.goalState.currentGoal, 'Find a mechanic tomorrow'); assert.equal(turn.shouldAvoidAction, true); },
  },
  {
    name: 'control command remains control',
    turn: buildConversationTurnContract({
      latestUserMessage: 'Pause that for now.',
      userMessage: 'Pause that for now.',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'control', speechAct: 'instruction', intent: 'pause_current_goal', responseStrategy: 'control' }),
    }),
    expect: (turn: any) => assert.equal(turn.mode, 'control'),
  },
  {
    name: 'confirmation is not proof of external success',
    turn: buildConversationTurnContract({
      latestUserMessage: 'Yes, that is the one I want.',
      userMessage: 'Yes, that is the one I want.',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'action', speechAct: 'confirmation', intent: 'confirm_selected_option', explicitAuthorization: true, responseStrategy: 'propose' }),
    }),
    expect: (turn: any) => { assert.equal(turn.shouldRequireCanonicalAction, true); assert.match(turn.responseRequirements.join('\n'), /canonical/i); },
  },
  {
    name: 'safety language does not create unsupported emergency fulfilment',
    turn: buildConversationTurnContract({
      latestUserMessage: 'I feel unsafe getting home tonight. What are my options?',
      userMessage: 'I feel unsafe getting home tonight. What are my options?',
      assistantReply: '',
      semanticInterpretation: semantic({ mode: 'exploration', speechAct: 'question', intent: 'explore_safety_options', capabilityHint: 'safety', responseStrategy: 'answer' }),
    }),
    expect: (turn: any) => { assert.equal(turn.shouldAvoidAction, true); assert.notEqual(turn.actionPosture, 'execute'); },
  },
];

for (const item of cases) item.expect(item.turn);

assert.equal(cases.length, 8);
console.log(`semantic real-world conversation suite passed: ${cases.length} cases`);
