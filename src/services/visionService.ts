/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import crypto from 'crypto';
import { getDb, saveDb } from '../database.js';
import { getConcept, type ConceptScenario } from './placeService.js';
import { GeminiProviderError } from './geminiService.js';

/**
 * Concept visualisation for Kurukoo Places.
 *
 * Cost policy (cheapest sufficient, in order):
 * 1. Deterministic parametric SVG massing — zero marginal cost, editable,
 *    rendered from the concept seed. Always available, served with no storage.
 * 2. One cached AI hero render per concept revision — only attempted when a
 *    Gemini API key is configured for the deployment; any failure falls back
 *    to SVG with an honest status. Never rendered per voter or per view.
 *
 * Every visual is labelled illustrative. A render is a possibility, not a plan.
 */

let schemaReady = false;

export async function ensureVisionSchema(): Promise<void> {
  if (schemaReady) return;
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS place_vision_blobs (
      concept_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      mime TEXT NOT NULL,
      bytes BLOB NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (concept_id, version)
    );
  `);
  saveDb();
  schemaReady = true;
}

/** Deterministic PRNG from a string seed (mulberry32 over a sha256 word). */
function seededRandom(seed: string): () => number {
  const digest = crypto.createHash('sha256').update(seed).digest();
  let state = digest.readUInt32BE(0) || 1;
  return () => {
    state |= 0; state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface MassingSpec {
  towers: number;
  maxHeight: number;
  houses: number;
  green: number;
  water: boolean;
  market: boolean;
  transit: boolean;
}

function specForScenario(scenario: string): MassingSpec {
  switch (scenario) {
    case 'commercial': return { towers: 7, maxHeight: 150, houses: 4, green: 3, water: false, market: false, transit: true };
    case 'green': return { towers: 0, maxHeight: 0, houses: 8, green: 14, water: true, market: false, transit: false };
    case 'future_city': return { towers: 12, maxHeight: 190, houses: 2, green: 6, water: true, market: false, transit: true };
    case 'community_growth': return { towers: 2, maxHeight: 70, houses: 14, green: 8, water: true, market: true, transit: false };
    default: return { towers: 3, maxHeight: 90, houses: 8, green: 6, water: false, market: false, transit: false };
  }
}

/**
 * Pseudo-3D block: front face + darker top face offset upward.
 * Coordinates are plan-view; height is illustrative only.
 */
function block(rand: () => number, x: number, y: number, w: number, d: number, h: number, fill: string, top: string): string {
  const hy = Math.round(h * 0.45);
  const wob = () => Math.round(rand() * 6 - 3);
  return `<g>`
    + `<rect x="${x}" y="${y - hy}" width="${w}" height="${d + hy}" rx="3" fill="${fill}" opacity="0.92"/>`
    + `<polygon points="${x},${y - hy} ${x + 10},${y - hy - 12} ${x + w + 10},${y - hy - 12} ${x + w},${y - hy}" fill="${top}"/>`
    + `<polygon points="${x + w},${y - hy} ${x + w + 10},${y - hy - 12} ${x + w + 10},${y + d - hy - 12} ${x + w},${y + d - hy}" fill="${fill}" opacity="0.72"/>`
    + `<circle cx="${x + wob()}" cy="${y}" r="0" fill="none"/>`
    + `</g>`;
}

export function buildMassingSvg(title: string, scenario: string, seed: string): string {
  const rand = seededRandom(`${scenario}:${seed}`);
  const spec = specForScenario(scenario);
  const W = 800;
  const H = 600;
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#e8e4d8"/>`);
  // Ground parcels.
  for (let i = 0; i < 5; i++) {
    const px = 20 + i * 155;
    parts.push(`<rect x="${px}" y="90" width="140" height="420" rx="6" fill="${i % 2 ? '#dfd9c6' : '#d5cfb8'}"/>`);
  }
  // Roads: one horizontal spine + one vertical.
  parts.push(`<rect x="0" y="262" width="${W}" height="46" fill="#8f8b80"/>`);
  parts.push(`<rect x="368" y="60" width="46" height="480" fill="#8f8b80"/>`);
  parts.push(`<rect x="0" y="282" width="${W}" height="6" fill="#f4f1e6"/>`);
  parts.push(`<rect x="388" y="60" width="6" height="480" fill="#f4f1e6"/>`);
  const palette = ['#c96f4a', '#d9a05b', '#a3b18a', '#588157', '#3a5a40', '#6c757d', '#495057', '#e9ecef'];
  const free: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let i = 0; i < 5; i++) {
    for (const [y, h] of [[100, 150], [320, 180]] as Array<[number, number]>) {
      free.push({ x: 30 + i * 155, y, w: 120, h });
    }
  }
  // Shuffle parcels deterministically.
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  let cursor = 0;
  const take = () => free[cursor++ % free.length];
  // Towers.
  for (let i = 0; i < spec.towers; i++) {
    const p = take();
    const w = 34 + Math.floor(rand() * 30);
    const d = 30 + Math.floor(rand() * 26);
    const h = 40 + Math.floor(rand() * spec.maxHeight);
    const x = Math.round(p.x + rand() * Math.max(1, p.w - w - 14));
    const y = Math.round(p.y + 20 + rand() * Math.max(1, p.h - d - 40));
    parts.push(block(rand, x, y, w, d, h, '#6c757d', '#adb5bd'));
  }
  // Houses.
  for (let i = 0; i < spec.houses; i++) {
    const p = take();
    const w = 26 + Math.floor(rand() * 22);
    const d = 22 + Math.floor(rand() * 18);
    const h = 16 + Math.floor(rand() * 26);
    const x = Math.round(p.x + rand() * Math.max(1, p.w - w - 8));
    const y = Math.round(p.y + 16 + rand() * Math.max(1, p.h - d - 32));
    const fill = palette[Math.floor(rand() * 5)];
    parts.push(block(rand, x, y, w, d, h, fill, '#e9ecef'));
  }
  // Market stalls.
  if (spec.market) {
    const p = take();
    for (let i = 0; i < 5; i++) {
      const x = Math.round(p.x + 8 + i * 22);
      const y = Math.round(p.y + p.h - 46);
      parts.push(`<rect x="${x}" y="${y}" width="18" height="14" rx="2" fill="#d9a05b"/>`);
      parts.push(`<polygon points="${x - 2},${y} ${x + 20},${y} ${x + 16},${y - 10} ${x + 2},${y - 10}" fill="#b5651d"/>`);
    }
  }
  // Green patches + trees.
  for (let i = 0; i < spec.green; i++) {
    const p = take();
    const cx = Math.round(p.x + 12 + rand() * Math.max(1, p.w - 44));
    const cy = Math.round(p.y + 14 + rand() * Math.max(1, p.h - 44));
    const r = 10 + Math.floor(rand() * 16);
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r + 8}" ry="${r}" fill="#a3b18a" opacity="0.85"/>`);
    for (let t = 0; t < 3; t++) {
      parts.push(`<circle cx="${Math.round(cx + rand() * r - r / 2)}" cy="${Math.round(cy + rand() * r - r / 2)}" r="${5 + Math.floor(rand() * 4)}" fill="#588157"/>`);
    }
  }
  // Water / drainage pond.
  if (spec.water) {
    parts.push(`<ellipse cx="660" cy="470" rx="70" ry="42" fill="#90bece" opacity="0.9"/>`);
    parts.push(`<ellipse cx="660" cy="470" rx="52" ry="30" fill="#a8d0dc" opacity="0.9"/>`);
  }
  // Transit spine.
  if (spec.transit) {
    parts.push(`<rect x="0" y="300" width="${W}" height="4" fill="#2a9d8f"/>`);
    for (let x = 40; x < W; x += 160) parts.push(`<circle cx="${x}" cy="302" r="7" fill="#2a9d8f" stroke="#fff" stroke-width="2"/>`);
  }
  // Baked-in honesty caption.
  parts.push(`<rect x="0" y="${H - 44}" width="${W}" height="44" rx="0" fill="#212529" opacity="0.82"/>`);
  parts.push(`<text x="20" y="${H - 17}" font-family="sans-serif" font-size="15" fill="#f8f9fa">${escapeXml(title.slice(0, 72))}</text>`);
  parts.push(`<text x="${W - 20}" y="${H - 17}" text-anchor="end" font-family="sans-serif" font-size="12" fill="#ced4da">Illustrative massing — not a plan</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(`Illustrative massing for ${title}`)}">${parts.join('')}</svg>`;
}

export async function getConceptVisionSvg(conceptId: string): Promise<{ svg: string; conceptTitle: string } | null> {
  const concept = await getConcept(String(conceptId));
  if (!concept) return null;
  return {
    svg: buildMassingSvg(String(concept.title), String(concept.scenario), `${concept.id}:v${concept.version}`),
    conceptTitle: String(concept.title),
  };
}

export async function getConceptHero(conceptId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  await ensureVisionSchema();
  const concept = await getConcept(String(conceptId));
  if (!concept) return null;
  const db = await getDb();
  const rows = db.exec('SELECT mime, bytes FROM place_vision_blobs WHERE concept_id=? AND version=? LIMIT 1', [concept.id, concept.version])[0]?.values || [];
  if (!rows.length) return null;
  return { mime: String(rows[0][0]), bytes: Buffer.from(rows[0][1] as Uint8Array) };
}

export interface VisionResult {
  conceptId: string;
  version: number;
  svgUrl: string;
  heroUrl: string | null;
  heroStatus: string;
}

/**
 * One vision generation per concept revision. Always refreshes the SVG
 * (free, deterministic); attempts one cached AI hero render only when the
 * deployment configures a Gemini key. Never throws for missing AI config.
 */
export async function requestConceptVision(requesterPhone: string, conceptId: string): Promise<VisionResult> {
  await ensureVisionSchema();
  const concept = await getConcept(String(conceptId), requesterPhone);
  if (!concept) throw new Error('Concept not found');
  const svgUrl = `/api/concepts/${encodeURIComponent(concept.id)}/vision.svg`;
  const existing = await getConceptHero(concept.id);
  if (existing) {
    return { conceptId: concept.id, version: concept.version, svgUrl, heroUrl: `/api/concepts/${encodeURIComponent(concept.id)}/hero.png`, heroStatus: 'cached' };
  }
  let heroStatus = 'unavailable: vision image backend is not configured for this deployment';
  let heroUrl: string | null = null;
  try {
    const bytes = await generateHeroRender(String(concept.title), String(concept.scenario));
    if (bytes) {
      const db = await getDb();
      db.run('INSERT OR REPLACE INTO place_vision_blobs(concept_id, version, mime, bytes) VALUES(?,?,?,?)', [concept.id, concept.version, 'image/png', bytes]);
      saveDb();
      heroUrl = `/api/concepts/${encodeURIComponent(concept.id)}/hero.png`;
      heroStatus = 'generated';
    }
  } catch (error) {
    heroStatus = error instanceof GeminiProviderError && error.code === 'GEMINI_NOT_CONFIGURED'
      ? 'unavailable: vision image backend is not configured for this deployment'
      : `unavailable: ${error instanceof Error ? error.message.slice(0, 120) : 'hero render failed'}`;
  }
  // Record the SVG asset on the concept (idempotent per revision).
  try {
    const db = await getDb();
    const row = db.exec('SELECT assets_json FROM place_concepts WHERE id=? LIMIT 1', [concept.id])[0]?.values?.[0]?.[0];
    const assets: any[] = Array.isArray(JSON.parse(String(row || '[]'))) ? JSON.parse(String(row || '[]')) : [];
    const marker = `svg:v${concept.version}`;
    if (!assets.some((a: any) => a && a.marker === marker)) {
      assets.push({ kind: 'svg-massing', marker, url: svgUrl, revision: concept.version, illustrative: true });
      if (heroUrl) assets.push({ kind: 'hero-render', marker: `hero:v${concept.version}`, url: heroUrl, revision: concept.version, illustrative: true });
      db.run('UPDATE place_concepts SET assets_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify(assets.slice(-12)), concept.id]);
      saveDb();
    }
  } catch { /* asset bookkeeping never breaks vision generation */ }
  return { conceptId: concept.id, version: concept.version, svgUrl, heroUrl, heroStatus };
}

async function generateHeroRender(title: string, scenario: string): Promise<Buffer | null> {
  // Dynamic import keeps the Gemini SDK optional at runtime.
  const { getGenAIClient } = await import('./geminiService.js');
  const client = getGenAIClient(); // throws GEMINI_NOT_CONFIGURED without a key
  const model = process.env.KURUKOO_VISION_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const response = await client.models.generateContent({
    model,
    contents: `Illustrative daytime aerial massing render of a proposed neighbourhood concept titled "${title.slice(0, 120)}" (${scenario}). Low-rise buildings, trees, roads and open space, watercolour architectural style, no text, no people, no logos. This is a speculative illustration, not a photograph of a real place.`,
    config: { responseModalities: ['IMAGE'] } as Record<string, unknown>,
  });
  const parts = (response as any)?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const data = part?.inlineData?.data;
    if (typeof data === 'string' && data.length > 0) return Buffer.from(data, 'base64');
  }
  return null;
}
