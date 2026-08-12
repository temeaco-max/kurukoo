import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const login = read('views/login.ejs');
const authRoutes = read('src/routes/authRoutes.ts');
const authClient = read('public/js/kurukoo-auth.js');
const authCss = read('public/css/kurukoo-auth.css');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Auth entry contract failed: ${message}`);
}

assert(login.includes('Tell Kurukoo what you need. Kurukoo figures out who or what can fulfil it.'), 'canonical hero copy must remain present');
assert(login.includes('/js/kurukoo-auth.js'), 'login must use the canonical auth client');
assert(login.includes('id="auth-return"'), 'login must preserve conversation return intent');
assert(!login.includes('Continue with Google') && !login.includes('Continue with Apple') && !login.includes('Continue with Telegram'), 'unsupported SSO buttons must not be presented as configured');
assert(login.includes('auth-phone-form') && login.includes('auth-otp-form') && login.includes('auth-profile-form'), 'phone, OTP and optional profile steps must exist');
assert(authClient.includes("fetch('/api/auth/request-otp'") && authClient.includes("fetch('/api/auth/verify-otp'"), 'auth client must use canonical OTP endpoints');
assert(authClient.includes('safeReturnTo') && authClient.includes('url.origin !== window.location.origin'), 'return navigation must reject cross-origin targets');
assert(authRoutes.includes("const AUTH_COOKIE = 'kurukoo_auth'"), 'browser auth must have a named cookie boundary');
assert(authRoutes.includes('httpOnly: true') && authRoutes.includes("sameSite: 'lax'"), 'auth cookie must be HttpOnly and same-site');
assert(authRoutes.includes("router.post('/logout'") && authRoutes.includes('clearCookie'), 'logout must clear the canonical browser session');
assert(authCss.includes('@media(max-width:480px)'), 'auth layout must include a mobile breakpoint');
console.log('Auth entry contract passed.');
