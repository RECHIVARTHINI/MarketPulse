import { Response } from 'express';
import { z } from 'zod';
import { Watchlist } from '../models/Watchlist';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthedRequest } from '../middleware/auth';
import { Types } from 'mongoose';

const MAX_SYMBOLS_PER_WATCHLIST = 50; // guards against the "huge watchlist" edge case blowing up quote fan-out

const createSchema = z.object({
  name: z.string().min(1).max(80),
  symbols: z.array(z.string().min(1).max(20)).max(MAX_SYMBOLS_PER_WATCHLIST).default([]),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  addSymbols: z.array(z.string().min(1).max(20)).optional(),
  removeSymbols: z.array(z.string().min(1).max(20)).optional(),
});

export const createWatchlist = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Invalid watchlist payload', 'VALIDATION_ERROR', parsed.error.flatten());

  try {
    const watchlist = await Watchlist.create({
      userId: req.userId,
      name: parsed.data.name,
      symbols: parsed.data.symbols,
    });
    return sendSuccess(res, watchlist, undefined, 201);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict(`You already have a watchlist named "${parsed.data.name}".`, 'DUPLICATE_WATCHLIST_NAME');
    }
    throw err;
  }
});

export const listWatchlists = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const watchlists = await Watchlist.find({ userId: req.userId }).sort({ createdAt: 1 });
  return sendSuccess(res, watchlists);
});

export const getWatchlist = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const watchlist = await findOwnedWatchlist(req.userId!, req.params.id);
  return sendSuccess(res, watchlist);
});

export const updateWatchlist = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Invalid update payload', 'VALIDATION_ERROR', parsed.error.flatten());

  const watchlist = await findOwnedWatchlist(req.userId!, req.params.id);

  if (parsed.data.name) watchlist.name = parsed.data.name;

  let symbols = new Set(watchlist.symbols);
  for (const s of parsed.data.addSymbols || []) symbols.add(s.trim().toUpperCase());
  for (const s of parsed.data.removeSymbols || []) symbols.delete(s.trim().toUpperCase());

  if (symbols.size > MAX_SYMBOLS_PER_WATCHLIST) {
    throw ApiError.badRequest(`A watchlist can hold at most ${MAX_SYMBOLS_PER_WATCHLIST} symbols.`, 'WATCHLIST_TOO_LARGE');
  }

  watchlist.symbols = Array.from(symbols);

  try {
    await watchlist.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict(`You already have a watchlist named "${parsed.data.name}".`, 'DUPLICATE_WATCHLIST_NAME');
    }
    throw err;
  }

  return sendSuccess(res, watchlist);
});

export const deleteWatchlist = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const watchlist = await findOwnedWatchlist(req.userId!, req.params.id);
  await watchlist.deleteOne();
  return sendSuccess(res, { deleted: true });
});

async function findOwnedWatchlist(userId: string, watchlistId: string) {
  if (!Types.ObjectId.isValid(watchlistId)) {
    throw ApiError.badRequest('Invalid watchlist id', 'INVALID_WATCHLIST_ID');
  }
  const watchlist = await Watchlist.findOne({ _id: watchlistId, userId });
  if (!watchlist) throw ApiError.notFound('Watchlist not found', 'WATCHLIST_NOT_FOUND');
  return watchlist;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
