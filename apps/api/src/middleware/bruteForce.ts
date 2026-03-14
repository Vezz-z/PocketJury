// ==============================================================================
// PocketJury API — Brute Force Protection
// ==============================================================================

import { RateLimiterRedis } from "rate-limiter-flexible";
import redis from "../config/redis";
import { logger } from "../utils/logger";

// Per-email: 5 failed attempts → 15 min block
const loginLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "bf:login",
  points: 5,
  duration: 900, // 15 minutes
  blockDuration: 900,
});

// Per-IP: 10 failed attempts in 1 hour → 1 hour block
const ipLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "bf:ip",
  points: 10,
  duration: 3600,
  blockDuration: 3600,
});

export async function checkBruteForce(email: string, ip: string): Promise<{ blocked: boolean; retryAfter?: number }> {
  try {
    const [emailResult, ipResult] = await Promise.allSettled([
      loginLimiter.get(email),
      ipLimiter.get(ip),
    ]);

    if (emailResult.status === "fulfilled" && emailResult.value) {
      if (emailResult.value.remainingPoints <= 0) {
        return { blocked: true, retryAfter: Math.ceil(emailResult.value.msBeforeNext / 1000) };
      }
    }

    if (ipResult.status === "fulfilled" && ipResult.value) {
      if (ipResult.value.remainingPoints <= 0) {
        return { blocked: true, retryAfter: Math.ceil(ipResult.value.msBeforeNext / 1000) };
      }
    }

    return { blocked: false };
  } catch (err) {
    logger.error({ err }, "Brute force check error");
    return { blocked: false };
  }
}

export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  try {
    await Promise.allSettled([
      loginLimiter.consume(email),
      ipLimiter.consume(ip),
    ]);
  } catch {
    // Already blocked, ignore
  }
}

export async function resetLoginAttempts(email: string): Promise<void> {
  try {
    await loginLimiter.delete(email);
  } catch {
    // Ignore
  }
}
