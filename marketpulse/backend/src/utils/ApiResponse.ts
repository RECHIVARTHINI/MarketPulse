import { Response } from 'express';

// Every successful response goes through this shape so the frontend
// never has to guess where the payload lives.
export function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: meta || {},
  });
}
