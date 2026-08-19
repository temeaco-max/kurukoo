import { getDb, saveDb } from '../database.js';

import { getFeatureFlag } from './featureFlags.js';

interface EmailResult {
    ok: boolean;
    provider: 'resend' | 'smtp-webhook' | 'disabled';
    id?: string;
    messageId?: string;
    error?: string;
}

interface SendEmailOptions {
    inReplyTo?: string;
    references?: string[];
    replyTo?: string;
    tags?: Record<string, string>;
    idempotencyKey?: string;
    sensitive?: boolean;
}

function required(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

function normalizeMessageId(value?: string): string | undefined {
    const id = value?.trim();
    if (!id) return undefined;
    return id.startsWith('<') && id.endsWith('>') ? id : `<${id.replace(/^<|>$/g, '')}>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character] || character));
}

function plainTextToHtml(body: string): string {
    return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.55;white-space:pre-wrap">${escapeHtml(body)}</div>`;
}

/**
 * Transactional email adapter for Kurukoo's secondary email channel.
 *
 * Email is a durable conversation transport, not a second identity system.
 * Resend is the preferred low-ops transport; the generic gateway remains
 * available for deployments that already operate an SMTP/mail relay.
 */
export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    options: SendEmailOptions = {}
): Promise<EmailResult> {
    const recipient = to.trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Invalid email recipient');
    if (!subject.trim() || !body.trim()) throw new Error('Email subject and body are required');

    const emailEnabled = getFeatureFlag(process.env.KURUKOO_DEFAULT_COUNTRY || 'ng', 'email');
    const resendKey = required('RESEND_API_KEY');
    const from = required('EMAIL_FROM');
    const webhook = required('EMAIL_WEBHOOK_URL');
    const inReplyTo = normalizeMessageId(options.inReplyTo);
    const references = [...new Set((options.references || []).map(normalizeMessageId).filter(Boolean) as string[])];
    let result: EmailResult;

    try {
        if (!emailEnabled) {
            result = { ok: false, provider: 'disabled', error: 'Email delivery is disabled by feature flag' };
        } else if (resendKey && from) {
            const payload: Record<string, unknown> = {
                from,
                to: [recipient],
                subject,
                text: body,
                html: plainTextToHtml(body)
            };
            if (options.replyTo) payload.reply_to = options.replyTo;
            if (inReplyTo || references.length) {
                payload.headers = {
                    ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}),
                    ...(references.length ? { References: references.join(' ') } : {})
                };
            }
            if (options.tags && Object.keys(options.tags).length) {
                payload.tags = Object.entries(options.tags).map(([name, value]) => ({ name, value }));
            }

            const requestHeaders: Record<string, string> = {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
            };
            if (options.idempotencyKey) requestHeaders['Idempotency-Key'] = options.idempotencyKey;

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({})) as { id?: string; message?: string; message_id?: string };
            if (!response.ok) throw new Error(data.message || `Email provider returned ${response.status}`);
            result = { ok: true, provider: 'resend', id: data.id, messageId: normalizeMessageId(data.message_id) };
        } else if (webhook) {
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipient,
                    subject,
                    text: body,
                    html: plainTextToHtml(body),
                    replyTo: options.replyTo,
                    headers: { ...(inReplyTo ? { 'In-Reply-To': inReplyTo } : {}), ...(references.length ? { References: references } : {}) },
                    tags: options.tags || {},
                    idempotencyKey: options.idempotencyKey
                })
            });
            if (!response.ok) throw new Error(`Email gateway returned ${response.status}`);
            result = { ok: true, provider: 'smtp-webhook' };
        } else {
            result = { ok: false, provider: 'disabled', error: 'No email transport configured' };
        }
    } catch (error) {
        result = {
            ok: false,
            provider: resendKey ? 'resend' : webhook ? 'smtp-webhook' : 'disabled',
            error: error instanceof Error ? error.message : 'Email delivery failed'
        };
    }

    const db = await getDb();
    db.run(`CREATE TABLE IF NOT EXISTS email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_id TEXT,
        message_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    for (const statement of [
        'ALTER TABLE email_log ADD COLUMN provider_id TEXT',
        'ALTER TABLE email_log ADD COLUMN message_id TEXT',
    ]) {
        try { db.run(statement); } catch { /* existing column or compatible schema */ }
    }
    db.run(
        `INSERT INTO email_log (recipient, subject, body, status, provider_id, message_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [recipient, subject, options.sensitive ? '[redacted]' : body, result.ok ? `sent:${result.provider}` : `failed:${result.provider}`, result.id || null, result.messageId || null]
    );
    saveDb();
    return result;
}
