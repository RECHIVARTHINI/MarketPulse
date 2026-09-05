import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { marketDataLimiter } from '../middleware/rateLimiter';
import { getQuote, getHistory, getStockDetail, setDemoScenario, listDemoScenarios } from '../controllers/marketController';

const router = Router();
router.use(requireUser);
router.use(marketDataLimiter);

router.get('/quote/:symbol', getQuote);
router.get('/history/:symbol', getHistory);
router.get('/detail/:symbol', getStockDetail);

// Demo/dev-only controls - see marketController.setDemoScenario for the guard.
router.get('/demo/scenarios', listDemoScenarios);
router.post('/demo/scenario', setDemoScenario);

export default router;
