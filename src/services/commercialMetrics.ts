import { getDb } from '../database.js';
import { getAffiliateMetrics } from './affiliateService.js';

interface CurrencyAmount { currency: string; amountMinor: number; count: number; }

function parseJson(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function tableExists(db: any, tableName: string): boolean {
  const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
  stmt.bind([tableName]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

function addCurrencyAmount(target: Map<string, CurrencyAmount>, currency: unknown, amount: unknown): void {
  const normalizedCurrency = typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency.trim()) ? currency.trim().toUpperCase() : 'UNKNOWN';
  const normalizedAmount = Number(amount);
  if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount < 0) return;
  const current = target.get(normalizedCurrency) || { currency: normalizedCurrency, amountMinor: 0, count: 0 };
  current.amountMinor += normalizedAmount;
  current.count += 1;
  target.set(normalizedCurrency, current);
}

/**
 * Operator metrics report recorded evidence, never forecasts. A verified payment
 * is customer collection evidence, not Kurukoo revenue; a Points debit, plan,
 * or advertising budget is not treated as fiat revenue without a corresponding
 * configured collection and settlement record.
 */
export async function getCommercialMetrics(): Promise<{
  verifiedCustomerCollections: { status: 'recorded' | 'not_recorded'; byCurrency: CurrencyAmount[]; requests: number; boundary: string };
  escrow: { byStatus: Array<{ status: string; count: number; byCurrency: CurrencyAmount[] }>; boundary: string };
  subscriptions: { activeRecords: number; collectionsStatus: 'not_configured'; boundary: string };
  pointsLeadActivity: { debits: number; pointsDebited: number; boundary: string };
  advertising: { activeCampaigns: number; billingStatus: 'not_configured'; boundary: string };
  affiliate: Awaited<ReturnType<typeof getAffiliateMetrics>>;
}> {
  const db = await getDb();
  const verifiedCollections = new Map<string, CurrencyAmount>();
  let verifiedRequestCount = 0;
  if (tableExists(db, 'economic_requests')) {
    const requestStmt = db.prepare(`SELECT quote, fulfillment FROM economic_requests WHERE status IN ('paid','in_progress','completed','disputed')`);
    while (requestStmt.step()) {
      const row = requestStmt.getAsObject() as Record<string, unknown>;
      const fulfillment = parseJson(row.fulfillment);
      if (fulfillment.payment_verified !== true) continue;
      const quote = parseJson(row.quote);
      addCurrencyAmount(verifiedCollections, quote.currency, quote.amount_minor);
      verifiedRequestCount += 1;
    }
    requestStmt.free();
  }

  const escrowRows: Array<{ status: string; count: number; byCurrency: CurrencyAmount[] }> = [];
  const escrowByStatus = new Map<string, Map<string, CurrencyAmount>>();
  if (tableExists(db, 'escrow')) {
    const escrowStmt = db.prepare(`SELECT status, amount_minor FROM escrow ORDER BY status`);
    while (escrowStmt.step()) {
      const row = escrowStmt.getAsObject() as Record<string, unknown>;
      const status = String(row.status || 'unknown');
      const amounts = escrowByStatus.get(status) || new Map<string, CurrencyAmount>();
      addCurrencyAmount(amounts, 'UNKNOWN', row.amount_minor);
      escrowByStatus.set(status, amounts);
    }
    escrowStmt.free();
  }
  for (const [status, amounts] of escrowByStatus.entries()) {
    escrowRows.push({ status, count: Array.from(amounts.values()).reduce((total, entry) => total + entry.count, 0), byCurrency: Array.from(amounts.values()) });
  }

  let activeSubscriptionRecords = 0;
  if (tableExists(db, 'provider_subscriptions')) {
    const activeSubscriptionStmt = db.prepare(`SELECT COUNT(*) AS count FROM provider_subscriptions WHERE lower(status) IN ('active','trialing')`);
    activeSubscriptionRecords = activeSubscriptionStmt.step() ? Number(activeSubscriptionStmt.getAsObject().count || 0) : 0;
    activeSubscriptionStmt.free();
  }

  let leadRow: Record<string, unknown> = {};
  if (tableExists(db, 'credit_transactions')) {
    const leadStmt = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS points FROM credit_transactions WHERE type='lead_fee'`);
    leadRow = leadStmt.step() ? leadStmt.getAsObject() as Record<string, unknown> : {};
    leadStmt.free();
  }

  let activeCampaigns = 0;
  if (tableExists(db, 'ad_campaigns')) {
    const campaignStmt = db.prepare(`SELECT COUNT(*) AS count FROM ad_campaigns WHERE status='active'`);
    activeCampaigns = campaignStmt.step() ? Number(campaignStmt.getAsObject().count || 0) : 0;
    campaignStmt.free();
  }

  return {
    verifiedCustomerCollections: {
      status: verifiedRequestCount ? 'recorded' : 'not_recorded',
      byCurrency: Array.from(verifiedCollections.values()),
      requests: verifiedRequestCount,
      boundary: 'Recorded verified customer payment evidence is not platform revenue, settlement, payout, or regulated escrow custody evidence.',
    },
    escrow: {
      byStatus: escrowRows,
      boundary: 'Internal escrow ledger entries describe recorded platform state only. This ledger does not persist a currency, and it is not proof of regulated custody or settlement without a certified payment rail.',
    },
    subscriptions: {
      activeRecords: activeSubscriptionRecords,
      collectionsStatus: 'not_configured',
      boundary: 'Provider subscription records do not establish a collected subscription payment until a verified billing adapter and settlement record exist.',
    },
    pointsLeadActivity: {
      debits: Number(leadRow.count || 0),
      pointsDebited: Number(leadRow.points || 0),
      boundary: 'Lead-related Points activity is a loyalty/economic signal, not fiat lead-fee revenue.',
    },
    advertising: {
      activeCampaigns,
      billingStatus: 'not_configured',
      boundary: 'Active campaigns and Points budgets are not advertising revenue without a verified advertising billing and settlement record.',
    },
    affiliate: await getAffiliateMetrics(),
  };
}

export async function getMarketingMetrics(): Promise<{
  referrals: number;
  activeCampaigns: number;
  measuredAdImpressions: null;
  measuredAdClicks: null;
  boundary: string;
}> {
  const db = await getDb();
  let referrals = 0;
  if (tableExists(db, 'referrals')) {
    const referralStmt = db.prepare(`SELECT COUNT(*) AS count FROM referrals`);
    referrals = referralStmt.step() ? Number(referralStmt.getAsObject().count || 0) : 0;
    referralStmt.free();
  }
  let activeCampaigns = 0;
  if (tableExists(db, 'ad_campaigns')) {
    const campaignStmt = db.prepare(`SELECT COUNT(*) AS count FROM ad_campaigns WHERE status='active'`);
    activeCampaigns = campaignStmt.step() ? Number(campaignStmt.getAsObject().count || 0) : 0;
    campaignStmt.free();
  }
  return {
    referrals,
    activeCampaigns,
    measuredAdImpressions: null,
    measuredAdClicks: null,
    boundary: 'Advertising impression and click tracking is not configured, so unmeasured counts are intentionally unavailable rather than estimated.',
  };
}
