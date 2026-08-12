import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const chat = read('public/chat/index.html');
const nav = read('views/_partials/nav.ejs');
const footer = read('views/_partials/footer.ejs');
const routes = read('src/routes/publicRoutes.ts');
const fail: string[] = [];
const mustInclude = (source: string, value: string, label: string) => { if (!source.includes(value)) fail.push(`${label}: missing ${value}`); };
const mustNotInclude = (source: string, value: string, label: string) => { if (source.includes(value)) fail.push(`${label}: contains legacy ${value}`); };

mustInclude(chat, '/favicon.svg', 'chat branding');
mustInclude(chat, '/icons/kurukoo-icons.svg', 'chat icon system');
mustInclude(chat, '/js/kurukoo-workspace.js', 'workspace controller');
mustInclude(chat, 'Tell Kurukoo what you need', 'conversation-first copy');
mustInclude(chat, 'Reminders', 'reminder workspace entry');
mustInclude(chat, 'Safety & check-ins', 'safety workspace entry');
mustInclude(chat, 'Web Chat · other channels are shown only when connected', 'truthful channel footer');
mustNotInclude(chat, '*7000#', 'chat shell');
mustNotInclude(chat, 'Economic OS', 'chat shell');

mustInclude(nav, 'Start chatting', 'global CTA');
mustInclude(nav, '/channels', 'global channel navigation');
mustInclude(nav, '/resources', 'global resource navigation');
mustNotInclude(nav, '*7000#', 'global navigation');
mustNotInclude(nav, 'Chat on WhatsApp', 'global navigation');
mustNotInclude(nav, 'Start a Free Trial', 'global navigation');
mustInclude(footer, 'Start chatting', 'global footer CTA');
mustNotInclude(footer, '*7000#', 'global footer');
mustNotInclude(footer, 'WhatsApp 7000', 'global footer');

mustInclude(routes, "router.get('/channels'", 'channels route');
mustInclude(routes, "router.get('/settings'", 'settings route');
for (const asset of ['public/icons/kurukoo-icons.svg', 'public/js/kurukoo-workspace.js', 'public/css/kurukoo-workspace.css', 'views/channels.ejs', 'views/settings.ejs']) {
  if (!fs.existsSync(path.join(root, asset))) fail.push(`missing asset: ${asset}`);
}

if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
console.log('Conversation workspace contract passed.');
