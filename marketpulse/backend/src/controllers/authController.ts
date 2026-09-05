import { Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthedRequest } from '../middleware/auth';

const demoLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80).optional(),
});

/**
 * Demo "login": find-or-create a user by email and hand back its id, which
 * the frontend then sends as the x-demo-user-id header on every subsequent
 * request. See middleware/auth.ts for why this is intentionally minimal.
 */
export const demoLogin = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const parsed = demoLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid email', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const { email, displayName } = parsed.data;

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $setOnInsert: { email: email.toLowerCase(), displayName: displayName || email.split('@')[0] } },
    { upsert: true, new: true }
  );

  return sendSuccess(res, { userId: user._id, email: user.email, displayName: user.displayName, attentionBudget: user.attentionBudget });
});
