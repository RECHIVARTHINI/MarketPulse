import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import {
  createWatchlist,
  listWatchlists,
  getWatchlist,
  updateWatchlist,
  deleteWatchlist,
} from '../controllers/watchlistController';
import {
  getChangesSinceLastVisit,
  snoozeSymbolController,
  unsnoozeSymbolController,
  getCrossWatchlistPriorityController,
} from '../controllers/changesController';

const router = Router();
router.use(requireUser);

// Cross-watchlist "Today's #1 priority" (must precede /:id)
router.get('/priority', getCrossWatchlistPriorityController);

router.post('/', createWatchlist);
router.get('/', listWatchlists);
router.get('/:id', getWatchlist);
router.patch('/:id', updateWatchlist);
router.delete('/:id', deleteWatchlist);

// The centerpiece: "what changed since I last looked at this watchlist".
router.get('/:id/changes', getChangesSinceLastVisit);

// Snooze and unsnooze symbols
router.post('/:id/snooze', snoozeSymbolController);
router.post('/:id/unsnooze', unsnoozeSymbolController);

export default router;
