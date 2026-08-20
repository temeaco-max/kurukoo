import { getDb } from '../database.js';
import { ensureCommercialSchema } from './commercialLedger.js';

export interface AgentRepresentation { isDelegated:boolean; agentId:string; ownerPhone?:string; skill?:string; status?:string; }

export async function getAgentRepresentation(agentId:string):Promise<AgentRepresentation>{
  await ensureCommercialSchema();
  const db=await getDb(); const stmt=db.prepare(`SELECT owner_phone,skill,status FROM agent_delegations WHERE agent_id=? LIMIT 1`); stmt.bind([agentId]); if(!stmt.step()){stmt.free();return{isDelegated:false,agentId};} const row=stmt.getAsObject() as any; stmt.free(); return {isDelegated:true,agentId,ownerPhone:String(row.owner_phone||''),skill:String(row.skill||''),status:String(row.status||'')};
}

export async function resolveFinancialBeneficiary(providerIdentity:string):Promise<{beneficiaryPhone:string;providerIdentity:string;delegated:boolean;skill?:string}>{const representation=await getAgentRepresentation(providerIdentity);return{beneficiaryPhone:representation.ownerPhone||providerIdentity,providerIdentity,delegated:representation.isDelegated,skill:representation.skill};}
