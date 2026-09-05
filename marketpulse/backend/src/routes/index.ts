import { Router } from 'express';
import authRoutes from './auth.routes';
import watchlistRoutes from './watchlist.routes';
import marketRoutes from './market.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } }));

router.use('/auth', authRoutes);
router.use('/watchlists', watchlistRoutes);
router.use('/market', marketRoutes);

export default router;
