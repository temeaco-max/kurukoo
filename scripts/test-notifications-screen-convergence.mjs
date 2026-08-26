import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('src/routes/notificationRoutes.ts', 'utf8');
const service = fs.readFileSync('src/services/pushNotifications.ts', 'utf8');
const screen = fs.readFileSync('public/js/kurukoo-notifications-convergence.js', 'utf8');
const css = fs.readFileSync('public/css/kurukoo-notifications-convergence.css', 'utf8');
const app = fs.readFileSync('views/app.ejs', 'utf8');
const surfaceRoutes = fs.readFileSync('src/routes/appSurfaceRoutes.ts', 'utf8');

assert.match(route, /getInternalNotifications/);
assert.match(route, /markNotificationRead/);
assert.match(service, /context_id/);
assert.match(service, /object_type/);
assert.match(service, /canonical_action/);
assert.match(screen, /\/api\/notifications\?limit=100/);
assert.match(screen, /\/api\/notifications\/.+\/read/);
assert.match(screen, /conversation_id/);
assert.match(screen, /object_type/);
assert.match(screen, /request|economic_request/);
assert.match(screen, /task/);
assert.match(screen, /topic/);
assert.match(screen, /opportunity/);
assert.match(screen, /escapeHtml/);
assert.match(screen, /safeInternalHref/);
assert.doesNotMatch(screen, /Create notification|createNotification|INSERT INTO internal_notifications/);
assert.match(css, /k-app-section-notifications/);
assert.match(css, /min-width:44px|min-height:44px/);
assert.match(app, /section === 'notifications'/);
assert.match(surfaceRoutes, /section === 'notifications'/);
assert.match(surfaceRoutes, /kurukoo-notifications-convergence\.css/);
assert.match(surfaceRoutes, /kurukoo-notifications-convergence\.js/);

console.log('Notifications convergence contract passed.');
