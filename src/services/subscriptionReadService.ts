/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
/**
 * Authenticated subscription read boundary.
 * Reads existing subscription/billing/ledger state; it does not create a second
 * billing authority and never accepts a client-supplied identity.
 */
import { getDb } from '../database.js';
import { ensureCommercialSchema } from './commercialLedger.js';
import { ensureCommercialBillingSchema } from './commercialBillingService.js';

export async function getUserSubscriptionState(ownerPhone: string) {
  if (!ownerPhone) throw new Error('Authenticated identity is required');
  await ensureCommercialSchema();
  await ensureCommercialBillingSchema();
  const db = await getDb();

  const profileStmt = db.prepare(`SELECT subscription_tier, country FROM memory_profiles WHERE phone=? LIMIT 1`);
  profileStmt.bind([ownerPhone]);
  const profile = profileStmt.step() ? profileStmt.getAsObject() as Record<string, unknown> : {};
  profileStmt.free();

  const billingStmt = db.prepare(`SELECT product_code,tier,price_minor,currency,next_billing_date,status,failure_count,last_payment_reference,updated_at FROM subscription_billing_state WHERE owner_phone=? LIMIT 1`);
  billingStmt.bind([ownerPhone]);
  const billing = billingStmt.step() ? billingStmt.getAsObject() as Record<string, unknown> : null;
  billingStmt.free();

  const providerStmt = db.prepare(`SELECT tier,status,next_billing_date,leads_this_month FROM provider_subscriptions WHERE phone=? LIMIT 1`);
  providerStmt.bind([ownerPhone]);
  const provider = providerStmt.step() ? providerStmt.getAsObject() as Record<string, unknown> : null;
  providerStmt.free();

  const ledgerStmt = db.prepare(`SELECT id,event_type,direction,status,currency,gross_minor,external_reference,created_at,settled_at,metadata FROM commercial_ledger WHERE (payer=? OR represented_party=?) AND event_type IN ('subscription_charge','refund') ORDER BY created_at DESC LIMIT 50`);
  ledgerStmt.bind([ownerPhone, ownerPhone]);
  const history: Record<string, unknown>[] = [];
  while (ledgerStmt.step()) {
    const row = ledgerStmt.getAsObject() as Record<string, unknown>;
    let metadata: unknown = {};
    try { metadata = JSON.parse(String(row.metadata || '{}')); } catch { metadata = {}; }
    history.push({ ...row, metadata });
  }
  ledgerStmt.free();

  return {
    profile: { subscriptionTier: profile.subscription_tier ?? null, country: profile.country ?? null },
    billing,
    provider,
    billingHistory: history,
    billingReadiness: Boolean(billing),
  };
}
