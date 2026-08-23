import { getCanonicalStore } from './canonicalStore.js';
export class CommissionConfigurationError extends Error{constructor(type:string){super(`No active commission configuration exists for ${type}.`);this.name='CommissionConfigurationError';}}
export async function getAllCommissions(){return(await getCanonicalStore()).all('SELECT id,type,rate_minor,description,active FROM commission_config');}
export async function getCommission(type:string){const row=await(await getCanonicalStore()).one<any>('SELECT rate_minor FROM commission_config WHERE type=? AND active=TRUE',[type]);if(!row)throw new CommissionConfigurationError(type);const rate=Number(row.rate_minor);if(!Number.isFinite(rate)||rate<0)throw new CommissionConfigurationError(type);return rate;}
export async function calculateCommission(type:string,amount=0){const rate=await getCommission(type);return type==='agent_topup'&&rate<=100&&amount>0?Math.round(amount*(rate/100)):rate;}
export async function updateCommission(id:number,rate_minor:number,active:number=1){await(await getCanonicalStore()).run('UPDATE commission_config SET rate_minor=?,active=? WHERE id=?',[rate_minor,active,id]);return true;}
