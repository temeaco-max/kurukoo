/**
 * System documentation boundary. Health remains owned by healthRoutes.
 */
import { Router } from 'express';
import path from 'path';

const router = Router();

router.get('/api/docs', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'api-docs.html'));
});

export default router;
