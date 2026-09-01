/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { Router } from 'express';
import { authenticateAdmin, authenticateUser, type AuthRequest } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { createStripePaymentIntent } from '../services/stripePayment.js';
import { createPaystackTransaction, verifyPaystackTransaction } from '../services/paystackPayment.js';
import { ensureCommercialSchema, getCommercialRevenueSummary, recordCommercialEvent } from '../services/commercialLedger.js';
import { ensureCommercialCatalog, getCommercialProduct, getNetworkUnitProducts } from '../services/commercialCatalogService.js';
import { createPointsTopUpIntent, settlePointsTopUp } from '../services/agentNetworkCommerce.js';
import { getAgentDonationPolicy } from '../services/agentDonationPolicyService.js';

const router = Router();

const NETWORK_UNIT_POINTS: Record<string, number> = { network_unit_100:100, network_unit_500:500, network_unit_1000:1000 };

router.get('/commercial/catalog', authenticateUser, async (_req: AuthRequest, res) => {
  try { await ensureCommercialCatalog(); const db=await getDb(); const rows=db.exec(`SELECT code,name,product_type,price_minor,currency,billing_period,active,metadata FROM commercial_products WHERE active=1 ORDER BY code`); const products=(rows[0]?.values||[]).map((values:any[])=>Object.fromEntries(rows[0].columns.map((c:string,i:number)=>[c,values[i]]))); res.json({success:true,products}); } catch(error){res.status(500).json({error:error instanceof Error?error.message:'Unable to load commercial catalog.'});}
});

router.get('/commercial/network-units', authenticateUser, async (_req: AuthRequest, res) => {
  try { res.json({ success:true, units:await getNetworkUnitProducts() }); } catch(error) { res.status(500).json({ error:error instanceof Error?error.message:'Unable to load network-unit products.' }); }
});

router.post('/commercial/network-units/purchase', authenticateUser, async (req: AuthRequest, res) => {
  const phone=String(req.user?.phone||'').trim(); const code=String(req.body?.productCode||'').trim(); const email=String(req.body?.email||'').trim();
  if(!phone||!code||!email)return res.status(400).json({error:'Authenticated owner, productCode and customer email are required.'});
  const points=NETWORK_UNIT_POINTS[code];
  if(!points)return res.status(400).json({error:'Unknown network-unit package.'});
  try{
    const product=await getCommercialProduct(code);
    if(!product||!Number(product.active)||String(product.product_type)!=='network_units')return res.status(404).json({error:'Network-unit package is unavailable.'});
    const amountMinor=Math.floor(Number(product.price_minor||0)); const currency=String(product.currency||'NGN').toUpperCase();
    if(amountMinor<=0)return res.status(409).json({error:'Network-unit pricing has not been configured for launch.'});
    if(currency!=='NGN')return res.status(409).json({error:'Network-unit sales are currently enabled only in NGN.'});
    const idempotencyKey=`network-unit-purchase:${phone}:${code}:${Date.now()}`;
    const topUp=await createPointsTopUpIntent({customerPhone:phone,points,fiatAmountMinor:amountMinor,currency,idempotencyKey});
    if(String(process.env.KURUKOO_PAY_PROVIDER||'').trim().toLowerCase()==='paystack'){
      const payment=await createPaystackTransaction({amountMinor,currency,email,economicRequestId:`points-topup:${topUp.id}`,idempotencyKey:`kurukoo:${idempotencyKey}`});
      return res.json({success:true,provider:'paystack',topUpId:topUp.id,productCode:code,points,amountMinor,currency,reference:payment.reference,authorizationUrl:payment.authorizationUrl,status:payment.status});
    }
    if(String(process.env.KURUKOO_PAY_PROVIDER||'').trim().toLowerCase()==='stripe'){
      const payment=await createStripePaymentIntent({amountMinor,currency,economicRequestId:`points-topup:${topUp.id}`,idempotencyKey:`kurukoo:${idempotencyKey}`});
      return res.json({success:true,provider:'stripe',topUpId:topUp.id,productCode:code,points,amountMinor,currency,paymentIntentId:payment.id,clientSecret:payment.clientSecret,status:payment.status});
    }
    return res.status(503).json({error:'A verified Nigeria payment provider is required for direct network-unit purchase.',payment_required:true});
  }catch(error){return res.status(503).json({error:error instanceof Error?error.message:'Network-unit purchase is unavailable.',payment_required:true});}
});

router.post('/commercial/network-units/settle', authenticateUser, async (req: AuthRequest, res) => {
  const phone=String(req.user?.phone||'').trim(); const topUpId=String(req.body?.topUpId||'').trim(); const reference=String(req.body?.reference||'').trim();
  if(!phone||!topUpId||!reference)return res.status(400).json({error:'Authenticated owner, topUpId and payment reference are required.'});
  try{
    const db=await getDb(); const rows=db.exec(`SELECT id,customer_phone,points,fiat_amount_minor,currency,status FROM kurukoo_points_topups WHERE id=? LIMIT 1`,[topUpId]);
    if(!rows[0]?.values?.length)return res.status(404).json({error:'Network-unit purchase not found.'});
    const row=Object.fromEntries(rows[0].columns.map((c:string,i:number)=>[c,rows[0].values[0][i]]));
    if(String(row.customer_phone)!==phone)return res.status(403).json({error:'Network-unit purchase ownership is required.'});
    if(String(row.status)==='settled')return res.json({success:true,points:Number(row.points),status:'settled'});
    if(String(row.currency).toUpperCase()!=='NGN')return res.status(409).json({error:'Network-unit settlement is currently NGN-only.'});
    const provider=String(process.env.KURUKOO_PAY_PROVIDER||'').trim().toLowerCase();
    if(provider==='paystack'){
      const verification=await verifyPaystackTransaction(reference);
      if(verification.status!=='success'||verification.amountMinor!==Number(row.fiat_amount_minor)||verification.currency!==String(row.currency).toUpperCase())return res.status(409).json({error:'Payment could not be verified for this network-unit purchase.'});
    } else {
      return res.status(503).json({error:'Automatic unit settlement currently requires Paystack server-side verification.',payment_required:true});
    }
    const settled=await settlePointsTopUp(topUpId,reference);
    return res.json({success:settled.success,points:settled.points,commissionMinor:settled.commissionMinor,status:'settled'});
  }catch(error){return res.status(503).json({error:error instanceof Error?error.message:'Network-unit settlement failed.'});}
});

router.post('/commercial/checkout', authenticateUser, async (req: AuthRequest, res) => {
  const phone=String(req.user?.phone||''); const code=String(req.body?.productCode||'').trim();
  if(!phone||!code)return res.status(400).json({error:'Authenticated owner and productCode are required.'});
  try{const product=await getCommercialProduct(code);if(!product||!Number(product.active))return res.status(404).json({error:'Commercial product is unavailable.'});const amountMinor=Math.floor(Number(product.price_minor||0));const currency=String(product.currency||'NGN').toUpperCase();if(amountMinor<=0)return res.status(409).json({error:'This commercial product does not have an active configured price.'});const key=`checkout:${phone}:${code}:${Date.now()}`;const type=String(product.product_type);const eventType=type==='agent_subscription'?'agent_subscription':type==='sports_fee'?'sports_fee':type==='sponsorship'?'sponsorship':type==='money_circle_fee'?'money_circle_fee':'adjustment';await recordCommercialEvent({eventType:eventType as any,direction:'inbound',status:'authorized',currency,grossMinor:amountMinor,platformFeeMinor:amountMinor,providerAmountMinor:0,payer:phone,payee:'KURUKOO',representedParty:phone,idempotencyKey:key,metadata:{productCode:code,productType:type,billingPeriod:product.billing_period}});const intent=await createStripePaymentIntent({amountMinor,currency,economicRequestId:`commercial:${key}`,idempotencyKey:`kurukoo:${key}`});res.json({success:true,provider:'stripe',productCode:code,paymentIntentId:intent.id,clientSecret:intent.clientSecret,amountMinor,currency,billingPeriod:product.billing_period,status:intent.status});}
  catch(error){res.status(503).json({error:error instanceof Error?error.message:'Commercial checkout unavailable.',payment_required:true});}
});

router.get('/commercial/me', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || '');
  if (!phone) return res.status(401).json({ error: 'Authenticated owner is required.' });
  try { await ensureCommercialSchema(); const db = await getDb(); const stmt = db.prepare(`SELECT id,event_type,status,currency,gross_minor,platform_fee_minor,provider_amount_minor,processing_fee_minor,tax_minor,net_minor,payee,represented_party,agent_id,skill,economic_request_id,external_reference,created_at,settled_at FROM commercial_ledger WHERE payer=? OR represented_party=? ORDER BY id DESC LIMIT 100`); stmt.bind([phone,phone]); const rows:any[]=[]; while(stmt.step()) rows.push(stmt.getAsObject()); stmt.free(); res.json({ success:true, events:rows }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load commercial activity.' }); }
});

router.post('/commercial/donations/intents', authenticateUser, async (req: AuthRequest, res) => {
  const phone = String(req.user?.phone || ''); const agentId = String(req.body?.agentId || '').trim(); const amountMinor = Math.floor(Number(req.body?.amountMinor || 0)); const currency = String(req.body?.currency || 'NGN').toUpperCase();
  if (!phone || !agentId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return res.status(400).json({ error:'Authenticated owner, agentId and positive amountMinor are required.' });
  try {
    await ensureCommercialSchema();
    const db=await getDb();
    const delegationStmt=db.prepare(`SELECT d.agent_id,d.owner_phone,d.skill,p.allow_donations,p.donation_recipient,d.status FROM agent_delegations d JOIN agent_permissions p ON p.delegation_id=d.id WHERE d.agent_id=? AND d.status='active'`); delegationStmt.bind([agentId]);
    let row:any=null; if(delegationStmt.step()) row=delegationStmt.getAsObject(); delegationStmt.free();
    let recipient=''; let recipientType=''; let skill='';
    if(row){ if(!Number(row.allow_donations))return res.status(403).json({error:'This agent has not enabled donations/offering.'}); recipient=String(row.donation_recipient||'').trim(); recipientType=recipient===String(row.owner_phone)?'represented_owner':'external_agent'; skill=String(row.skill||''); }
    else { const policy=await getAgentDonationPolicy(agentId); if(!policy||!Number(policy.enabled))return res.status(404).json({error:'Donation-enabled agent not found.'}); recipient=String(policy.recipient||'').trim();recipientType=String(policy.recipient_type||'kurukoo');skill=String(policy.agent_id||agentId); }
    if(!recipient)return res.status(409).json({error:'Donation recipient has not been canonically configured.'});
    if(recipientType==='external_agent'){const recipientStmt=db.prepare(`SELECT id FROM ai_agents WHERE id=? LIMIT 1`);recipientStmt.bind([recipient]);const knownAgent=recipientStmt.step();recipientStmt.free();if(!knownAgent)return res.status(409).json({error:'Donation recipient is not a canonical Kurukoo agent.'});}
    const idempotencyKey=`donation:${phone}:${agentId}:${Date.now()}`; const intent=await createStripePaymentIntent({ amountMinor, currency, economicRequestId:`commercial:${idempotencyKey}`, idempotencyKey:`kurukoo:${idempotencyKey}` });
    const isKurukooRecipient=recipientType==='kurukoo' || recipient==='KURUKOO';
    await recordCommercialEvent({ eventType:'donation',direction:'inbound',status:'authorized',currency,grossMinor:amountMinor,platformFeeMinor:isKurukooRecipient?amountMinor:0,providerAmountMinor:isKurukooRecipient?0:amountMinor,payer:phone,payee:recipient,representedParty:recipient,agentId,skill,externalReference:intent.id,idempotencyKey,metadata:{paymentIntentId:intent.id,recipient,recipientType,allocation:isKurukooRecipient?'Kurukoo-owned-agent':'represented-party'} });
    res.json({ success:true, provider:'stripe', paymentIntentId:intent.id, clientSecret:intent.clientSecret, amountMinor:intent.amountMinor, currency:intent.currency, status:intent.status, recipient, recipientType });
  } catch (error) { res.status(503).json({ error:error instanceof Error?error.message:'Donation payment provider unavailable.', payment_required:true }); }
});

router.post('/commercial/advertising/fund', authenticateAdmin, async (req: AuthRequest, res) => {
  const campaignId=Math.floor(Number(req.body?.campaignId||0)); const amountMinor=Math.floor(Number(req.body?.amountMinor||0)); const currency=String(req.body?.currency||'NGN').toUpperCase(); const reference=String(req.body?.externalReference||'').trim(); const creditMinor=Math.floor(Number(process.env.KURUKOO_AD_CREDIT_MINOR||0));
  if(!campaignId||!Number.isSafeInteger(amountMinor)||amountMinor<=0||!reference||creditMinor<=0)return res.status(400).json({error:'campaignId, positive amountMinor, externalReference and KURUKOO_AD_CREDIT_MINOR are required.'});
  try{await ensureCommercialSchema();const db=await getDb();const stmt=db.prepare(`SELECT id,credits_budget,status FROM ad_campaigns WHERE id=?`);stmt.bind([campaignId]);if(!stmt.step()){stmt.free();return res.status(404).json({error:'Campaign not found.'});}const row=stmt.getAsObject() as any;stmt.free();const credits=Math.floor(amountMinor/creditMinor);if(credits<=0)return res.status(400).json({error:'Funding amount is below one campaign credit.'});db.run(`UPDATE ad_campaigns SET credits_budget=COALESCE(credits_budget,0)+?,status=CASE WHEN status='completed' THEN 'active' ELSE status END,updated_at=? WHERE id=?`,[credits,new Date().toISOString(),campaignId]);await recordCommercialEvent({eventType:'advertising_spend',direction:'inbound',status:'settled',currency,grossMinor:amountMinor,platformFeeMinor:amountMinor,providerAmountMinor:0,payer:String(req.body?.advertiser||'ADVERTISER'),payee:'KURUKOO',representedParty:String(req.body?.advertiser||'ADVERTISER'),externalReference:reference,idempotencyKey:`ad_funding:${campaignId}:${reference}`,metadata:{campaignId,credits,creditMinor}});res.json({success:true,campaignId,creditsAdded:credits,status:row.status});}catch(error){res.status(500).json({error:error instanceof Error?error.message:'Unable to fund advertising campaign.'});}
});

router.get('/commercial/revenue/summary', authenticateAdmin, async (_req: AuthRequest, res) => { try { res.json({ success:true, ...(await getCommercialRevenueSummary()) }); } catch (error) { res.status(500).json({ error:error instanceof Error?error.message:'Unable to calculate revenue summary.' }); } });

router.post('/commercial/affiliate/conversions', authenticateAdmin, async (req: AuthRequest, res) => {
  const partner=String(req.body?.partner||'').trim().slice(0,160); const conversionId=String(req.body?.conversionId||'').trim(); const commissionMinor=Math.floor(Number(req.body?.commissionMinor||0)); const currency=String(req.body?.currency||'NGN').toUpperCase(); const clickId=req.body?.clickId?String(req.body.clickId):null;
  if(!partner||!conversionId||!Number.isSafeInteger(commissionMinor)||commissionMinor<0)return res.status(400).json({error:'partner, conversionId and non-negative commissionMinor are required.'});
  try{await ensureCommercialSchema();const db=await getDb();db.run(`INSERT OR REPLACE INTO affiliate_conversions(id,partner,click_id,external_order_id,gross_minor,commission_minor,currency,status,settled_at) VALUES(?,?,?,?,?,?,?,?,?)`,[conversionId,partner,clickId,req.body?.externalOrderId?String(req.body.externalOrderId):null,Math.floor(Number(req.body?.grossMinor||0)),commissionMinor,currency,'settled',new Date().toISOString()]);await recordCommercialEvent({eventType:'affiliate_commission',direction:'inbound',status:'settled',currency,grossMinor:commissionMinor,platformFeeMinor:commissionMinor,payer:partner,payee:'KURUKOO',externalReference:conversionId,idempotencyKey:`affiliate:${partner}:${conversionId}`,metadata:{clickId,externalOrderId:req.body?.externalOrderId||null}});res.status(201).json({success:true,conversionId,commissionMinor,currency});}catch(error){res.status(500).json({error:error instanceof Error?error.message:'Unable to record affiliate conversion.'});}
});

export default router;
