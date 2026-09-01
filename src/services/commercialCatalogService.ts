/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb, saveDb } from '../database.js';
import { ensureCommercialSchema } from './commercialLedger.js';

/**
 * Shared commercial catalogue. Product prices are configuration, not business
 * logic: a zero price means the product is not yet enabled for billing.
 */
export const COMMERCIAL_PRODUCTS = [
  ['agent_service','Kurukoo delegated agent service','agent_subscription',0,'NGN','monthly'],
  ['provider_base','Kurukoo Base provider plan','provider_subscription',500,'NGN','monthly'],
  ['provider_plus','Kurukoo Plus provider plan','provider_subscription',1500,'NGN','monthly'],
  ['provider_business','Kurukoo Business provider plan','provider_subscription',5000,'NGN','monthly'],
  ['network_unit_100','Kurukoo network units — 100','network_units',0,'NGN','one_time'],
  ['network_unit_500','Kurukoo network units — 500','network_units',0,'NGN','one_time'],
  ['network_unit_1000','Kurukoo network units — 1,000','network_units',0,'NGN','one_time'],
  ['transport_access_daily','Transport network access — daily','network_access',0,'NGN','daily'],
  ['transport_access_weekly','Transport network access — weekly','network_access',0,'NGN','weekly'],
  ['transport_access_monthly','Transport network access — monthly','network_access',0,'NGN','monthly'],
  ['ad_funding','Sponsored placement campaign funding','advertising',0,'NGN','one_time'],
  ['sports_match_fee','Sports match/meetup fee','sports_fee',0,'NGN','one_time'],
  ['league_registration','League registration fee','sports_fee',0,'NGN','one_time'],
  ['club_tournament_fee','Club/tournament fee','sports_fee',0,'NGN','one_time'],
  ['sponsorship','Sponsored network placement','sponsorship',0,'NGN','one_time'],
  ['money_circle_fee','Money Circle platform fee','money_circle_fee',0,'NGN','one_time'],
  ['affiliate_commission','Verified affiliate commission','affiliate',0,'NGN','one_time'],
] as const;

const envMinor = (name:string):number => {
  const raw=String(process.env[name]||'').trim();
  if(!raw)return 0;
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>0?value:0;
};

function configuredPrice(code:string, fallback:number):number {
  const overrides:Record<string,string> = {
    network_unit_100:'KURUKOO_NETWORK_UNIT_PACK_100_MINOR',
    network_unit_500:'KURUKOO_NETWORK_UNIT_PACK_500_MINOR',
    network_unit_1000:'KURUKOO_NETWORK_UNIT_PACK_1000_MINOR',
    transport_access_daily:'KURUKOO_TRANSPORT_ACCESS_DAILY_MINOR',
    transport_access_weekly:'KURUKOO_TRANSPORT_ACCESS_WEEKLY_MINOR',
    transport_access_monthly:'KURUKOO_TRANSPORT_ACCESS_MONTHLY_MINOR',
  };
  return overrides[code] ? envMinor(overrides[code]) : fallback;
}

export async function ensureCommercialCatalog(): Promise<void> {
  await ensureCommercialSchema(); const db=await getDb();
  for(const [code,name,type,fallbackPrice,currency,billing] of COMMERCIAL_PRODUCTS){
    const price=configuredPrice(code,Number(fallbackPrice||0));
    db.run(`INSERT OR IGNORE INTO commercial_products(code,name,product_type,price_minor,currency,billing_period,metadata) VALUES(?,?,?,?,?,?,?)`,[code,name,type,price,currency,billing,JSON.stringify({source:'canonical-commercial-catalog',configuredPrice:price>0})]);
    if(type==='network_units'||type==='network_access') db.run(`UPDATE commercial_products SET name=?,price_minor=?,currency=?,billing_period=?,metadata=? WHERE code=?`,[name,price,currency,billing,JSON.stringify({source:'canonical-commercial-catalog',configuredPrice:price>0,market:'ng'}),code]);
  }
  saveDb();
}

export async function getCommercialProduct(code:string):Promise<any|null>{await ensureCommercialCatalog();const db=await getDb();const stmt=db.prepare(`SELECT code,name,product_type,price_minor,currency,billing_period,active,metadata FROM commercial_products WHERE code=? LIMIT 1`);stmt.bind([code]);const row=stmt.step()?stmt.getAsObject():null;stmt.free();return row;}

export async function getNetworkUnitProducts():Promise<any[]> {
  await ensureCommercialCatalog();
  const db=await getDb();
  const result=db.exec(`SELECT code,name,product_type,price_minor,currency,billing_period,active,metadata FROM commercial_products WHERE product_type IN ('network_units','network_access') AND active=1 ORDER BY CASE code WHEN 'network_unit_100' THEN 1 WHEN 'network_unit_500' THEN 2 WHEN 'network_unit_1000' THEN 3 ELSE 4 END`);
  return (result[0]?.values||[]).map((values:any[])=>Object.fromEntries((result[0].columns||[]).map((c:string,i:number)=>[c,values[i]])));
}
