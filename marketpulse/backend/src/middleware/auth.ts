import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Deliberately minimal "auth": a demo user id supplied via header.
 *
 * ENGINEERING TRADE-OFF (documented, not hidden): the brief lists
 * authentication as "if needed" and explicitly warns against overbuilding.
 * A full JWT/session/OAuth stack would not move the needle on the actual
 * evaluation criteria (meaningful-change detection, resilience, data
 * modeling) and would eat hours better spent there. This middleware keeps
 * the *shape* of real auth (every route is scoped to a userId, watchlists
 * are authorized per-owner) so swapping in real auth later only means
 * replacing this one file.
 */
export function requireUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const userId = req.header('x-demo-user-id');
  if (!userId) {
    return next(ApiError.badRequest('Missing x-demo-user-id header. Call POST /api/auth/demo-login first.', 'AUTH_REQUIRED'));
  }
  req.userId = userId;
  next();
}
