// ==============================================================================
// PocketJury API — Rate Limiter Middleware (Redis-backed)
// ==============================================================================

import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";
import { logger } from "../utils/logger";

function createLimiter(keyPrefix: string, points: number, duration: number) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${keyPrefix}`,
    points,
    duration,
    blockDuration: 0,
  });
}

export function rateLimiter(
  keyPrefix: string,
  points: number,
  duration: number,
  keyExtractor: (req: Request) => string = (req) => req.ip || "unknown"
) {
  const limiter = createLimiter(keyPrefix, points, duration);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyExtractor(req);
      const result = await limiter.consume(key);

      res.set({
        "X-RateLimit-Limit": String(points),
        "X-RateLimit-Remaining": String(result.remainingPoints),
        "X-RateLimit-Reset": String(Math.ceil(result.msBeforeNext / 1000)),
      });

      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(err.msBeforeNext / 1000);
        res.set("Retry-After", String(retryAfter));
        res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfter,
        });
        return;
      }

      logger.error({ err }, "Rate limiter error");
      next();
    }
  };
}

// Pre-configured limiters
export const authLimiter = rateLimiter("auth", 5, 60);
export const registerLimiter = rateLimiter("register", 20, 3600);
export const queryLimiter = rateLimiter(
  "query",
  10,
  60,
  (req) => req.user?.sub || req.ip || "unknown"
);
export const generalLimiter = rateLimiter(
  "general",
  100,
  60,
  (req) => req.user?.sub || req.ip || "unknown"
);
