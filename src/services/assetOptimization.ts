/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

export function optimizePublicAssetUrl(value: unknown): string {
  const source = String(value || '');
  if (!source.startsWith('/')) return source;
  if (!/\.jpe?g(?:\?.*)?$/i.test(source)) return source;
  const [pathname, query = ''] = source.split('?');
  const candidate = pathname.replace(/\.jpe?g$/i, '.webp');
  if (!fs.existsSync(path.join(process.cwd(), 'frontend/public', candidate.replace(/^\//, '')))) return source;
  return `${candidate}${query ? `?${query}` : ''}`;
}

export function optimizeCampaignImage<T extends { imageUrl?: unknown; image_url?: unknown }>(campaign: T): T {
  if (campaign.imageUrl !== undefined) return { ...campaign, imageUrl: optimizePublicAssetUrl(campaign.imageUrl) };
  if (campaign.image_url !== undefined) return { ...campaign, image_url: optimizePublicAssetUrl(campaign.image_url) };
  return campaign;
}
