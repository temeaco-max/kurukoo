import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../database.js';

export interface ContentItem {
    slug: string;
    title: string;
    body: string;
    type: 'blog' | 'help' | 'legal' | 'page' | 'resource';
    author: string;
    category?: string;
    excerpt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface BlogArticle {
    slug: string;
    title: string;
    date: string;
    author: string;
    category: string;
    content: string;
}

export interface BlogMetadata {
    slug: string;
    title: string;
    date: string;
    author: string;
    category: string;
}

export interface ResourceMetadata {
    slug: string;
    title: string;
    category: string;
    excerpt: string;
    updated_at?: string;
}

const RESOURCE_SEEDS: ReadonlyArray<Omit<ContentItem, 'createdAt' | 'updatedAt'>> = [
    { slug: 'how-kurukoo-works', title: 'How Kurukoo works', category: 'For everyone', excerpt: 'Understand the conversation-first path from what you need to a coordinated outcome.', body: '# How Kurukoo works\n\nKurukoo starts with the need, not a category. Tell Kurukoo what you need, and it works through the relevant memory, capability, request, provider or authorised integration.\n\n## What Kurukoo can establish\n\nKurukoo can only claim an action, provider state, payment, fulfilment or outcome when its canonical services or authorised external evidence establish it.\n\n## Continue in Chat\n\nMost operational journeys continue in the same conversation so interruptions, authentication, reminders and follow-up do not create a second relationship.', type: 'resource', author: 'Kurukoo' },
    { slug: 'reminders-and-routines', title: 'Reminders and routines', category: 'For everyone', excerpt: 'Use Kurukoo to remember, schedule and continue everyday intentions.', body: '# Reminders and routines\n\nAsk Kurukoo to remind you once, on a schedule, or after a relevant event. Reminder state belongs to the same identity and conversation context.\n\n## Examples\n\n- Remind me tomorrow at 8 to call Mum.\n- Remind me every Sunday to buy bread.\n- Check in with me at 10pm.\n\nWhen a reminder runs, the system records the resulting notification/continuation state through the canonical reminder and notification services.', type: 'resource', author: 'Kurukoo' },
    { slug: 'provider-and-capability-guides', title: 'Provider and capability guides', category: 'For providers', excerpt: 'Understand capability, presence, trust and how a provider participates without creating a second identity.', body: '# Provider and capability guides\n\nA Kurukoo user can hold several capabilities at once: provider, contributor, buyer, seller, delivery worker and more. Capabilities are attached to one canonical identity and use the same portfolio and presence boundaries.\n\n## Start with the capability\n\nUse Chat to describe what you can genuinely provide. Kurukoo can then expose the appropriate skill and fulfilment path when the deployment supports it.', type: 'resource', author: 'Kurukoo' },
    { slug: 'staying-safe-and-resolving-disputes', title: 'Staying safe and resolving disputes', category: 'Trust & safety', excerpt: 'Learn how verification, evidence, cancellation, recovery and reporting work.', body: '# Staying safe and resolving disputes\n\nSafety, disputes and sensitive actions use explicit policy and evidence boundaries. Kurukoo does not silently turn an unverified community statement into a provider or transaction fact.\n\n## If something goes wrong\n\nUse the request, notification, help or safety path associated with the original conversation. Preserve evidence and use the supported cancellation, recovery or dispute route.', type: 'resource', author: 'Kurukoo' },
    { slug: 'memory-and-connected-context', title: 'Memory and connected context', category: 'For everyone', excerpt: 'Learn what Kurukoo can remember, where connected data lives, and how to manage it.', body: '# Memory and connected context\n\nMemory Profile is the canonical owner-scoped memory authority. Connected external resources remain governed by their connector boundary and do not automatically become mirrored Kurukoo databases.\n\n## User control\n\nReview, correct, remove or disconnect supported context through the appropriate account or Connect surface.', type: 'resource', author: 'Kurukoo' },
    { slug: 'contributors-and-tasks', title: 'Contributors and tasks', category: 'For contributors', excerpt: 'Learn how tasks, evidence and contribution activity connect to the same identity and agent runtime.', body: '# Contributors and tasks\n\nContributor work appears through the canonical capability and task systems. A task may be created by a request, an agent goal, a reminder or a contribution flow.\n\nTask state, evidence and recovery remain connected to the same conversation and identity.', type: 'resource', author: 'Kurukoo' },
    { slug: 'channels-and-connected-doors', title: 'Channels and connected doors', category: 'Channels', excerpt: 'Web, PWA, WhatsApp, Telegram, notifications and other channels are doors into one Kurukoo relationship.', body: '# Channels and connected doors\n\nKurukoo treats channels as doors into one relationship rather than separate products. A channel can extend conversation, notification or device continuity when the relevant provider is configured and independently verified.\n\nChannel availability is always shown truthfully.', type: 'resource', author: 'Kurukoo' },
    { slug: 'points-plans-and-payments', title: 'Points, plans and payments', category: 'Economy', excerpt: 'Understand the distinction between Points, subscriptions, top-up and external payment evidence.', body: '# Points, plans and payments\n\nPoints are not cash. Subscriptions and top-up use their own payment and entitlement boundaries. Kurukoo never treats a user intention or UI state as completed payment without provider evidence.\n\nWhere a payment rail is unavailable or disabled, the surface remains truthful and feature-flagged rather than pretending a transaction completed.', type: 'resource', author: 'Kurukoo' }
];

async function ensureResourceSeeded(): Promise<void> {
    const db = await getDb();
    const countRows = db.exec("SELECT COUNT(*) AS count FROM content WHERE type = 'resource'");
    const count = Number(countRows?.[0]?.values?.[0]?.[0] ?? 0);
    if (count > 0) return;
    for (const resource of RESOURCE_SEEDS) {
        db.run(`INSERT INTO content (slug, title, body, type, author) VALUES (?, ?, ?, 'resource', ?) ON CONFLICT(slug) DO NOTHING`, [resource.slug, resource.title, resource.body, resource.author]);
    }
    saveDb();
}

export function convertMarkdownToHtml(markdown: string): string {
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;
    for (let line of lines) {
        line = line.trim();
        if (!line) { if (inList) { html += '</ul>\n'; inList = false; } continue; }
        if (line.startsWith('# ')) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h1>${line.slice(2)}</h1>\n`; }
        else if (line.startsWith('## ')) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h2>${line.slice(3)}</h2>\n`; }
        else if (line.startsWith('### ')) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h3>${line.slice(4)}</h3>\n`; }
        else if (line.startsWith('- ')) { if (!inList) { html += '<ul>\n'; inList = true; } const cleanLine = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html += `  <li>${cleanLine}</li>\n`; }
        else { if (inList) { html += '</ul>\n'; inList = false; } const cleanLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); html += `<p>${cleanLine}</p>\n`; }
    }
    if (inList) html += '</ul>\n';
    return html;
}

export async function getAllContent(type?: string): Promise<ContentItem[]> {
    const db = await getDb();
    let query = `SELECT slug, title, body, type, author, created_at, updated_at FROM content`;
    const params: any[] = [];
    if (type) { query += ` WHERE type = ?`; params.push(type); }
    const rows = db.exec(query, params);
    if (rows.length === 0) return [];
    const items: ContentItem[] = [];
    const columns = rows[0].columns;
    for (const values of rows[0].values) { const item: any = {}; columns.forEach((col: string, idx: number) => { item[col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = values[idx]; }); items.push(item as ContentItem); }
    return items;
}

export async function getContentBySlug(slug: string): Promise<ContentItem | null> {
    const db = await getDb();
    const rows = db.exec(`SELECT slug, title, body, type, author, created_at, updated_at FROM content WHERE slug = ?`, [slug]);
    if (rows.length === 0) return null;
    const columns = rows[0].columns;
    const values = rows[0].values[0];
    const item: any = {}; columns.forEach((col: string, idx: number) => { item[col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = values[idx]; });
    return item as ContentItem;
}

export async function getAllResourceMetadata(page = 1, pageSize = 20): Promise<ResourceMetadata[]> {
    await ensureResourceSeeded();
    const db = await getDb();
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(20, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safeSize;
    const rows = db.exec(`SELECT slug, title, body, updated_at FROM content WHERE type = 'resource' ORDER BY updated_at DESC, title ASC LIMIT ? OFFSET ?`, [safeSize, offset]);
    return rows.length === 0 ? [] : rows[0].values.map((values: any[]) => ({ slug: String(values[0]), title: String(values[1]), category: 'Guide', excerpt: String(values[2] || '').split('\n').filter(Boolean).find((line: string) => !line.startsWith('#'))?.replace(/^[-*]\s*/, '').slice(0, 220) || '', updated_at: values[3] ? String(values[3]) : undefined }));
}

export async function getResourceBySlug(slug: string): Promise<(ContentItem & { type: 'resource' }) | null> {
    await ensureResourceSeeded();
    const item = await getContentBySlug(slug);
    if (!item || item.type !== 'resource') return null;
    return item as ContentItem & { type: 'resource' };
}

export async function saveContent(item: ContentItem): Promise<void> { const db = await getDb(); db.run(`INSERT INTO content (slug, title, body, type, author) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, body=excluded.body, type=excluded.type, author=excluded.author, updated_at=datetime('now')`, [item.slug, item.title, item.body, item.type, item.author]); saveDb(); }
export async function deleteContentBySlug(slug: string): Promise<void> { const db = await getDb(); db.run(`DELETE FROM content WHERE slug = ?`, [slug]); saveDb(); }

export async function migrateBlogFilesToDb(): Promise<void> {
    const db = await getDb();
    const blogDir = path.join(process.cwd(), 'content', 'blog');
    if (!fs.existsSync(blogDir)) return;
    for (const file of fs.readdirSync(blogDir)) {
        if (!file.endsWith('.md')) continue;
        const slug = file.replace('.md', '');
        const existing = db.exec(`SELECT count(*) FROM content WHERE slug = ?`, [slug]);
        if (existing.length > 0 && existing[0].values[0][0] > 0) continue;
        try {
            const rawContent = fs.readFileSync(path.join(blogDir, file), 'utf-8');
            const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const frontmatter: Record<string, string> = {};
            let bodyContent = rawContent;
            if (match) { bodyContent = rawContent.slice(match[0].length); for (const line of match[1].split('\n')) { const colonIdx = line.indexOf(':'); if (colonIdx !== -1) frontmatter[line.slice(0, colonIdx).trim().toLowerCase()] = line.slice(colonIdx + 1).trim(); } }
            db.run(`INSERT INTO content (slug, title, body, type, author) VALUES (?, ?, ?, 'blog', ?)`, [slug, frontmatter.title || 'Untitled Post', bodyContent.trim(), frontmatter.author || 'Kurukoo Team']); saveDb();
        } catch (err) { console.error(`Error migrating blog file ${file}:`, err); }
    }
}

export async function getAllBlogArticles(): Promise<BlogMetadata[]> { const items = await getAllContent('blog'); return items.map(item => ({ slug: item.slug, title: item.title, date: item.createdAt ? item.createdAt.split(' ')[0] : '2026-07-28', author: item.author, category: 'Blog' })); }
export async function getBlogArticleBySlug(slug: string): Promise<BlogArticle | null> { const item = await getContentBySlug(slug); if (!item || item.type !== 'blog') return null; return { slug: item.slug, title: item.title, date: item.createdAt ? item.createdAt.split(' ')[0] : '2026-07-28', author: item.author, category: 'Blog', content: convertMarkdownToHtml(item.body) }; }