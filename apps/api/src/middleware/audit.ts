// ==============================================================================
// PocketJury API — Audit Log Middleware
// ==============================================================================

import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { logger } from "../utils/logger";

export function auditLog(action: string, resourceType?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Capture response finish to log after completion
    const originalEnd = res.end;
    const startTime = Date.now();

    res.end = function (...args: Parameters<typeof originalEnd>) {
      // Log async — do not block response
      const duration = Date.now() - startTime;
      setImmediate(async () => {
        try {
          await prisma.auditLog.create({
            data: {
              userId: req.user?.sub || null,
              action,
              resourceType: resourceType || null,
              resourceId: ((req.params?.id || req.params?.chatId) as string) ?? null,
              ipAddress: req.ip || null,
              userAgent: (req.headers["user-agent"] as string) || null,
              metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: duration,
              },
            },
          });
        } catch (err) {
          logger.error({ err }, "Failed to write audit log");
        }
      });

      return originalEnd.apply(res, args);
    } as typeof originalEnd;

    next();
  };
}
