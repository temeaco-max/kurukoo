import { Router } from 'express';

const router = Router();

// The authenticated Chat surface is rendered by appSurfaceRoutes through views/app.ejs.
// Retain this mounted router only as a transparent compatibility handoff so router order
// does not reintroduce the former standalone static page.
router.get('/chat', (_req, _res, next) => next());

export default router;
