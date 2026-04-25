// ==============================================================================
// PocketJury API — Auth Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";
import { authLimiter, registerLimiter } from "../middleware/rateLimiter";
import { auditLog } from "../middleware/audit";
import { validate } from "../middleware/validate";
import { verifyRefreshToken } from "../utils/jwt";
import { env } from "../config/env";

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").refine(
    (val) => !isNaN(new Date(val).getTime()) && new Date(val) < new Date(),
    "Must be a valid date in the past"
  ),
  contactPhone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  preferredLanguage: z.enum(["en", "hi", "ta", "bn"]).default("en"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// POST /api/v1/auth/register
router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  auditLog("REGISTER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/api/v1/auth/refresh",
      });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  auditLog("LOGIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
        ip: req.ip || "unknown",
      });

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/google
router.post(
  "/google",
  authLimiter,
  validate(googleAuthSchema),
  auditLog("GOOGLE_AUTH"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In production, verify the idToken with Google's token info endpoint
      // For now, we trust the token and extract claims
      const tokenInfoResponse = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${req.body.idToken}`
      );

      if (!tokenInfoResponse.ok) {
        res.status(401).json({ error: "Invalid Google token" });
        return;
      }

      const tokenInfo = await tokenInfoResponse.json() as {
        sub: string;
        email: string;
        name: string;
        aud: string;
      };

      // Verify the token was issued for our application
      if (env.GOOGLE_CLIENT_ID && tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
        res.status(401).json({ error: "Token audience mismatch" });
        return;
      }

      const result = await authService.googleAuth(
        tokenInfo.sub,
        tokenInfo.email,
        tokenInfo.name
      );

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
router.post(
  "/refresh",
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: "Refresh token required" });
        return;
      }

      // Decode token to get userId without full verification (for lookup)
      const payload = await verifyRefreshToken(refreshToken);

      if (!payload.sub) {
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }

      const sessionId = typeof payload.sid === "string" ? payload.sid : undefined;
      const tokens = await authService.refreshTokens(payload.sub, refreshToken, sessionId);

      res.cookie("accessToken", tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ accessToken: tokens.accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
router.post(
  "/logout",
  authMiddleware,
  auditLog("LOGOUT"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.sub) {
        const sessionId = typeof req.user.sid === "string" ? req.user.sid : undefined;
        await authService.logout(req.user.sub, sessionId);
      }

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken", { path: "/api/v1/auth/refresh" });
      res.json({ message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
