import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser { id?: string | number; phone?: string; role?: string; username?: string; [key: string]: any; }
export interface AuthRequest extends Request { user?: AuthUser; admin?: boolean | AuthUser; body: any; query: any; params: any; }

type RateState = { count: number; resetAt: number };
const rateState = new Map<string, RateState>();
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS = 60;

function rateLimit(req: Request, res: Response): boolean {
    const key = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const current = rateState.get(key);
    if (!current || current.resetAt <= now) { rateState.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS }); return true; }
    current.count += 1;
    if (current.count > AUTH_MAX_REQUESTS) { res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000)); res.status(429).json({ error: 'Too many authenticated requests' }); return false; }
    return true;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
    return secret;
}

function getCookie(req: Request, name: string): string | undefined {
    const raw = String(req.headers.cookie || '');
    const pair = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

function getToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
    const headerToken = req.headers['x-auth-token'];
    if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();
    return getCookie(req, 'kurukoo_auth');
}

/**
 * Explicit middleware for routes that act on a user's own data. Route modules
 * must declare this middleware directly; no global Express prototype patching
 * is used to infer authorization from paths.
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
    if (!rateLimit(req, res)) return;
    const token = getToken(req);
    if (!token) return void res.status(401).json({ error: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as AuthUser;
        if (!decoded || decoded.role === 'guest' || !decoded.phone) return void res.status(401).json({ error: 'Invalid authentication token' });
        (req as AuthRequest).user = decoded;
        next();
    } catch { res.status(401).json({ error: 'Invalid or expired authentication token' }); }
}

/**
 * Explicit middleware for administrator-only operational routes. Background
 * workers call services directly and therefore do not need an HTTP bypass.
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!rateLimit(req, res)) return;
    const token = getToken(req) || (typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : undefined);
    if (!token) return void res.status(401).json({ error: 'Admin authorization token required' });
    try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as AuthUser;
        if (decoded && (decoded.role === 'admin' || decoded.username === 'admin')) { (req as AuthRequest).admin = decoded; (req as AuthRequest).user = decoded; next(); return; }
        res.status(403).json({ error: 'Forbidden: Admin role required' });
    } catch { res.status(401).json({ error: 'Invalid or expired admin token' }); }
}
