/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb } from '../database.js';
import { getPointsBalance, getPointsHistory, getPointsLabel, getPointsSymbol } from './pointsEngine.js';
import { getChannelUsageSummary } from './channelUsageService.js';
import { isFeatureEnabled } from './featureFlags.js';

export async function getUserUsage(ownerPhone: string) {
  if (!ownerPhone) throw new Error('Authenticated identity is required');
  const db = await getDb();
  const profileStmt = db.prepare(`SELECT country, subscription_tier FROM memory_profiles WHERE phone=? LIMIT 1`);
  profileStmt.bind([ownerPhone]);
  const profile = profileStmt.step() ? profileStmt.getAsObject() as Record<string, unknown> : {};
  profileStmt.free();
  const country = String(profile.country || 'ng').toLowerCase();
  const pointsEnabled = isFeatureEnabled(country, 'points_engine');
  const points = pointsEnabled ? await getPointsBalance(ownerPhone) : null;
  const pointsHistory = pointsEnabled ? await getPointsHistory(ownerPhone, 50) : [];
  const channel = await getChannelUsageSummary(ownerPhone);
  return {
    points: { enabled: pointsEnabled, balance: points, label: getPointsLabel(), symbol: getPointsSymbol(), history: pointsHistory },
    channelUsage: channel,
    subscriptionTier: profile.subscription_tier ?? null,
    country,
  };
}
