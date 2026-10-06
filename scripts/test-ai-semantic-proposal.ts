/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-ai-semantic-proposal-${process.pid}-${Date.now()}.sqlite`;
const { buildConversationTurnContract } = await import('../src/services/conversationTurnContractService.js');
const { proposeSemanticCapability } = await import('../src/services/aiSemanticProposalService.js');

async function main() {
  const conversation = buildConversationTurnContract({
    userMessage: 'hello',
    latestUserMessage: 'hello',
    assistantReply: '',
  });
  assert.equal(await proposeSemanticCapability({ userMessage: 'hello', contract: conversation }), null, 'greeting must not trigger semantic capability inference');

  const exploration = buildConversationTurnContract({
    userMessage: 'I am thinking about getting someone to clean my flat',
    latestUserMessage: 'I am thinking about getting someone to clean my flat',
    assistantReply: '',
  });
  assert.equal(await proposeSemanticCapability({ userMessage: 'I am thinking about getting someone to clean my flat', contract: exploration }), null, 'exploration must not silently authorize action');

  const action = buildConversationTurnContract({
    userMessage: 'Please find someone to clean my flat this weekend',
    latestUserMessage: 'Please find someone to clean my flat this weekend',
    assistantReply: '',
  });
  assert.ok(action.requiresStructuredProposal || action.mode === 'action', 'explicit action should enter proposal-capable posture');

  console.log('AI semantic proposal regression passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
