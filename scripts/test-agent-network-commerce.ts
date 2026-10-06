/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import assert from 'node:assert/strict';

// Unconditional, per-run database path. `.env` sets DB_PATH=tmp/kurukoo.sqlite
// and a running dev server exports it, so a contract that reads the ambient
// value writes into the developer's real store. Assigned below every import
// and before the canonical store loads (AGENTS.md §66.1).
process.env.DB_PATH = `/tmp/kurukoo-test-agent-network-commerce-${process.pid}-${Date.now()}.sqlite`;
const { getDb, saveDb } = await import('../src/database.js');
const { registerNetworkAgent, getNetworkAgentByPhone, getProviderLeadCost, chargeProviderLead, createPointsTopUpIntent, recordPointsTopUpEvidence, settlePointsTopUp } = await import('../src/services/agentNetworkCommerce.js');
const { getAgentCommissionBalance, requestAgentCommissionPayout } = await import('../src/services/agentCommissionSettlement.js');

const suffix=Date.now();const agentPhone=`ci_agent_${suffix}@example.com`;const providerPhone=`ci_provider_${suffix}@example.com`;const customerPhone=`ci_customer_${suffix}@example.com`;const db=await getDb();
try{
 db.run(`INSERT INTO memory_profiles (phone,name,country,points_balance,grace_leads) VALUES (?,?,?,?,?)`,[providerPhone,'CI Provider','ng',200,0]);
 db.run(`INSERT INTO memory_profiles (phone,name,country,points_balance,grace_leads) VALUES (?,?,?,?,?)`,[customerPhone,'CI Customer','ng',0,0]);
 const agent=await registerNetworkAgent({phone:agentPhone,name:'CI POS Agent',agentType:'pos',country:'ng',region:'Ikeja',commissionBps:250});db.run(`UPDATE kurukoo_network_agents SET status='active' WHERE id=?`,[agent.id]);
 assert.equal(agent.agentType,'pos');assert.equal(agent.canSellPoints,true);assert.equal((await getNetworkAgentByPhone(agentPhone))?.id,agent.id);
 assert.ok((await getProviderLeadCost('okada'))>=1);const charge=await chargeProviderLead({providerPhone,category:'okada',requestId:'ci-request'});assert.equal(charge.success,true);assert.equal(charge.chargedPoints,50);
 const topup=await createPointsTopUpIntent({customerPhone,points:100,fiatAmountMinor:10000,currency:'NGN',agentId:agent.id,idempotencyKey:`ci-topup:${suffix}`});assert.equal(topup.status,'pending');await recordPointsTopUpEvidence(topup.id,agentPhone,'CI-OPAY-REF');await settlePointsTopUp(topup.id,'CI-OPAY-REF');assert.equal((await getAgentCommissionBalance(agent.id,'NGN')).accruedMinor,250);
 const payout=await requestAgentCommissionPayout({agentId:agent.id,amountMinor:250,currency:'NGN',rail:'opay',destinationRef:'CI-OPAY-AGENT'});assert.equal(payout.status,'requested');const balance=await getAgentCommissionBalance(agent.id,'NGN');assert.equal(balance.availableMinor,0);assert.equal(balance.reservedMinor,250);
 console.log(JSON.stringify({passed:true,agentId:agent.id,leadCharge:charge.chargedPoints,pointsPurchased:100,commissionMinor:balance.accruedMinor,payout:payout.id,reservedMinor:balance.reservedMinor},null,2));
} finally {
 db.run('DELETE FROM agent_commission_payouts WHERE agent_id IN (SELECT id FROM kurukoo_network_agents WHERE phone=?)',[agentPhone]);db.run('DELETE FROM kurukoo_points_topups WHERE agent_id IN (SELECT id FROM kurukoo_network_agents WHERE phone=?)',[agentPhone]);db.run('DELETE FROM commercial_ledger WHERE payer=? OR payee=? OR represented_party=?',[agentPhone,agentPhone,agentPhone]);db.run('DELETE FROM kurukoo_network_agents WHERE phone=?',[agentPhone]);db.run('DELETE FROM memory_profiles WHERE phone IN (?,?)',[providerPhone,customerPhone]);saveDb(true);
}
