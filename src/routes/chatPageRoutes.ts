import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = Router();
const chatPage = path.join(process.cwd(), 'public', 'chat', 'index.html');
const speechScript = '/js/kurukoo-speech-output.js?v=1';

async function sendChatPage(res: any) {
  const source = await fs.readFile(chatPage, 'utf8');
  if (source.includes(speechScript)) return res.type('html').send(source);
  return res.type('html').send(source.replace('</head>', `  <script src="${speechScript}" defer></script>\n</head>`));
}
router.get('/chat', async (_req, res, next) => { try { await sendChatPage(res); } catch (error) { next(error); } });
export default router;
