/* Copyright (c) 2026 temeaco-max. All rights reserved. Proprietary and confidential. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const login = read('frontend/src/routes/login.tsx');
const authFlow = read('frontend/src/components/kurukoo/auth.tsx');
const authLib = read('frontend/src/lib/kurukoo-auth.ts');
const authRoutes = read('src/routes/authRoutes.ts');
const authCss = read('frontend/public/css/kurukoo-auth.css');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Auth entry contract failed: ${message}`);
}

assert(login.includes('Continue securely.') && authFlow.includes('Welcome back') || authFlow.includes('name'), 'login must preserve the progressive identity sequence');
assert(authFlow.includes('AuthStep') && authFlow.includes('step'), 'AuthFlow must name its steps');
assert(authLib.includes('/api/auth/request-otp') && authLib.includes('/api/auth/verify-otp'), 'login must use canonical phone OTP endpoints');
assert(authLib.includes('credentials: "include"'), 'OTP requests must retain same-origin browser credentials');
assert(authFlow.includes("returnTo || \"/chat\"") && authFlow.includes('safeReturnTo') && authFlow.includes('url.origin === window.location.origin'), 'return navigation must default to Chat and reject cross-origin targets');
assert(authRoutes.includes("sanitizeReturnPath(challenge.returnPath) || '/field'"), 'completed authenticated sessions must default to Home when no safe deep link is supplied');
assert(!authFlow.includes('/js/kurukoo-auth.js'), 'login must not retain a competing legacy auth controller');
assert(!authFlow.includes('Continue with Google') && !authFlow.includes('Continue with Apple') && !authFlow.includes('Continue with Telegram'), 'unsupported SSO buttons must not be presented as configured');
assert(authRoutes.includes("const AUTH_COOKIE = 'kurukoo_auth'"), 'browser auth must have a named cookie boundary');
assert(authRoutes.includes('httpOnly: true') && authRoutes.includes("sameSite: 'lax'"), 'auth cookie must be HttpOnly and same-site');
assert(authRoutes.includes("router.post('/logout'") && authRoutes.includes('clearCookie'), 'logout must clear the canonical browser session');
assert(authCss.includes('@media(max-width:480px)'), 'auth layout must include a mobile breakpoint');
console.log('Auth entry contract passed.');
