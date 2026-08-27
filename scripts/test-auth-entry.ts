import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const login = read('views/login.ejs');
const authRoutes = read('src/routes/authRoutes.ts');
const authCss = read('public/css/kurukoo-auth.css');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Auth entry contract failed: ${message}`);
}

assert(login.includes('Continue securely.') && login.includes('Your name'), 'login must preserve the name-first progressive identity sequence');
assert(login.includes('auth-step-name') && login.includes('auth-step-phone') && login.includes('auth-step-code'), 'name, phone, and OTP steps must exist');
assert(login.includes("fetch('/api/auth/request-magic-link'") && login.includes("fetch('/api/auth/request-otp'") && login.includes("/api/auth/verify-otp"), 'login must use canonical magic-link and phone OTP endpoints');
assert(login.includes('credentials:\'same-origin\''), 'OTP requests must retain same-origin browser credentials');
assert(login.includes("returnTo || '/chat'") && login.includes('safeReturnTo') && login.includes('url.origin === window.location.origin'), 'return navigation must default to Chat and reject cross-origin targets');
assert(authRoutes.includes("sanitizeReturnPath(challenge.returnPath) || '/desk'"), 'completed authenticated sessions must default to Desk when no safe deep link is supplied');
assert(!login.includes('/js/kurukoo-auth.js'), 'login must not retain a competing legacy auth controller');
assert(!login.includes('Continue with Google') && !login.includes('Continue with Apple') && !login.includes('Continue with Telegram'), 'unsupported SSO buttons must not be presented as configured');
assert(authRoutes.includes("const AUTH_COOKIE = 'kurukoo_auth'"), 'browser auth must have a named cookie boundary');
assert(authRoutes.includes('httpOnly: true') && authRoutes.includes("sameSite: 'lax'"), 'auth cookie must be HttpOnly and same-site');
assert(authRoutes.includes("router.post('/logout'") && authRoutes.includes('clearCookie'), 'logout must clear the canonical browser session');
assert(authCss.includes('@media(max-width:480px)'), 'auth layout must include a mobile breakpoint');
console.log('Auth entry contract passed.');
