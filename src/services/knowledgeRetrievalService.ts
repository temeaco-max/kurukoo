/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import { getDb } from '../database.js';

/**
 * Canonical retrieval: ONE authority over what the product knows, many sources.
 *
 * Sources today: the declarative skill catalogue, public community topics,
 * verified provider-work evidence, and the user's own artifacts/documents.
 * Retrieval informs agents and answers; it never becomes a second authority.
 * An empty index returns honestly empty, never invented context.
 */

export interface KnowledgeHit {
  source: 'skill_catalogue' | 'community_topic' | 'provider_evidence' | 'user_artifact';
  reference: string;
  title?: string;
  excerpt: string;
  score: number;
}

function terms(query: string): string[] {
  return Array.from(new Set(String(query || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []))
    .filter((term) => !new Set(['the', 'and', 'for', 'with', 'what', 'how', 'why', 'when', 'who', 'are', 'you', 'your', 'can', 'get', 'need', 'want', 'this', 'that', 'from', 'have']).has(term))
    .slice(0, 12);
}

function scoreText(text: string, tokens: string[]): number {
  const lowered = String(text || '').toLowerCase();
  let score = 0;
  for (const token of tokens) if (lowered.includes(token)) score += token.length >= 6 ? 2 : 1;
  return score;
}

export async function retrieveKnowledge(input: { query: string; limit?: number; ownerPhone?: string }): Promise<{ hits: KnowledgeHit[]; indexed: Record<string, number> }> {
  const tokens = terms(input.query);
  if (!tokens.length) return { hits: [], indexed: {} };
  const limit = Math.max(1, Math.min(20, Math.floor(Number(input.limit) || 8)));
  const hits: KnowledgeHit[] = [];
  const indexed: Record<string, number> = {};
  const db = await getDb();

  try {
    const skillModule = await import('./skillFlows.js') as unknown as {
      getKnownSkills?: () => string[];
      getSkillRequirements?: (skill: string) => Array<{ key?: string; label?: string; required?: boolean }>;
      getEconomicCategory?: (skill: string) => string | null;
    };
    if (typeof skillModule.getKnownSkills === 'function') {
      const names = skillModule.getKnownSkills().slice(0, 400);
      indexed.skill_catalogue = names.length;
      for (const name of names) {
        const requirements = typeof skillModule.getSkillRequirements === 'function' ? skillModule.getSkillRequirements(name) : [];
        const category = typeof skillModule.getEconomicCategory === 'function' ? skillModule.getEconomicCategory(name) : null;
        const text = `${name} ${category || ''} ${requirements.map((item) => item.label || item.key || '').join(' ')}`;
        const score = scoreText(text, tokens);
        if (score > 0) hits.push({ source: 'skill_catalogue', reference: `skill:${name}`, title: name, excerpt: text.slice(0, 400), score: score + 1 });
      }
    }
  } catch { /* the catalogue is an optional source. */ }
  try {
    const rows = db.exec(`SELECT id, title, body FROM topics WHERE status='public' ORDER BY updated_at DESC LIMIT 300`);
    const topics = rows[0]?.values || [];
    indexed.community_topic = topics.length;
    for (const row of topics) {
      const values = row as unknown[];
      const text = `${String(values[1] || '')} ${String(values[2] || '')}`;
      const score = scoreText(text, tokens);
      if (score > 0) hits.push({ source: 'community_topic', reference: `topic:${String(values[0] || '')}`, title: String(values[1] || '').slice(0, 160), excerpt: text.slice(0, 400), score });
    }
  } catch { /* topics are an optional source. */ }

  try {
    const rows = db.exec(`SELECT request_id, role, provider_phone, status, evidence_json FROM economic_participants WHERE status IN ('confirmed','completion_reported') ORDER BY rowid DESC LIMIT 200`);
    const evidenceRows = rows[0]?.values || [];
    indexed.provider_evidence = evidenceRows.length;
    for (const row of evidenceRows) {
      const values = row as unknown[];
      const text = `${String(values[0] || '')} ${String(values[1] || '')} ${String(values[4] || '')}`;
      const score = scoreText(text, tokens);
      if (score > 0) hits.push({ source: 'provider_evidence', reference: `request:${String(values[0] || '')}`, excerpt: text.slice(0, 400), score });
    }
  } catch { /* evidence is an optional source. */ }

  if (input.ownerPhone) {
    try {
      const stmt = db.prepare(`SELECT id, filename, transcript FROM artifacts WHERE phone=? AND deleted_at IS NULL AND transcript IS NOT NULL ORDER BY created_at DESC LIMIT 100`);
      stmt.bind([String(input.ownerPhone)]);
      let count = 0;
      while (stmt.step()) {
        count += 1;
        const row = stmt.getAsObject() as Record<string, unknown>;
        const text = `${String(row.filename || '')} ${String(row.transcript || '')}`;
        const score = scoreText(text, tokens);
        if (score > 0) hits.push({ source: 'user_artifact', reference: `artifact:${String(row.id || '')}`, title: String(row.filename || ''), excerpt: String(row.transcript || '').slice(0, 400), score });
      }
      stmt.free();
      indexed.user_artifact = count;
    } catch { /* user artifacts are an optional source. */ }
  }

  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, limit), indexed };
}