import { Router } from 'express';

const router = Router();

// Legacy browser application aliases now converge on the canonical authenticated Web App shell.
router.get('/web', (_req, res) => res.redirect(302, '/app'));
router.get('/workspace', (_req, res) => res.redirect(302, '/app'));

export default router;
