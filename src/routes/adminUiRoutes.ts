import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';

/** Admin browser pages. API authorization remains in adminRoutes.ts. */
export function createAdminUiRouter(): Router {
  const router = express.Router();

  router.get('/admin', (_req, res) => res.redirect('/admin/login.html'));
  router.get('/admin/', (_req, res) => res.redirect('/admin/login.html'));
  router.get('/admin/:page', (req, res, next) => {
    const page = req.params.page;
    if (!page.endsWith('.html')) {
      const filePath = path.join(process.cwd(), 'public', 'admin', `${page}.html`);
      if (fs.existsSync(filePath)) return res.sendFile(filePath);
    }
    next();
  });

  return router;
}

export default createAdminUiRouter();
