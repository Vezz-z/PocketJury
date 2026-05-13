// ==============================================================================
// PocketJury API — Auth Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { authService } from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";
import { authLimiter, registerLimiter, otpLimiter, magicLinkLimiter } from "../middleware/rateLimiter";
import { auditLog } from "../middleware/audit";
import { validate } from "../middleware/validate";
import { verifyRefreshToken } from "../utils/jwt";
import { env } from "../config/env";
import { CACHE_TTL } from "@pocketjury/shared";

// Initialize Google OAuth2 client for server-side ID token verification
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

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
  accessToken: z.string().min(1).optional(),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const otpRequestSchema = z.object({
  email: z.string().email(),
});

const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Code must be 6 digits"),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
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

      if (result.mfaRequired) {
        res.status(202).json({
          mfaRequired: true,
          message: "Verification code sent to email",
        });
        return;
      }

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/api/v1/auth/refresh",
      });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
        mfaRequired: false,
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

      if (result.mfaRequired) {
        res.status(202).json({
          mfaRequired: true,
          message: "MFA code sent to email",
        });
        return;
      }

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken, mfaRequired: false });
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
      // Cryptographically verify the Google ID token using google-auth-library
      // This validates the token signature, expiry, audience, and issuer
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        res.status(401).json({ error: "Invalid Google token payload" });
        return;
      }

      const result = await authService.googleAuth(
        payload.sub,
        payload.email,
        payload.name || payload.email.split("@")[0],
        req.body.accessToken
      );

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth/refresh",
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
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CACHE_TTL.REFRESH_TOKEN * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ accessToken: tokens.accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/verify-email
router.post(
  "/verify-email",
  authLimiter,
  validate(verifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.verifyEmail(req.body.email, req.body.code);

      if (result.mfaRequired) {
        res.status(202).json({
          mfaRequired: true,
          message: "MFA code sent to email",
        });
        return;
      }

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CACHE_TTL.REFRESH_TOKEN * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken, mfaRequired: false });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/verify-mfa
router.post(
  "/verify-mfa",
  authLimiter,
  validate(verifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.verifyMfa(req.body.email, req.body.code);

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CACHE_TTL.REFRESH_TOKEN * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken, mfaRequired: false });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/otp/request
router.post(
  "/otp/request",
  otpLimiter,
  validate(otpRequestSchema),
  auditLog("OTP_REQUEST"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.requestOtpLogin(
        req.body.email,
        req.ip || "unknown"
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/otp/verify
router.post(
  "/otp/verify",
  authLimiter,
  validate(otpVerifySchema),
  auditLog("OTP_VERIFY"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.verifyOtpLogin(
        req.body.email,
        req.body.code,
        req.ip || "unknown"
      );

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CACHE_TTL.REFRESH_TOKEN * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/magic-link/request
router.post(
  "/magic-link/request",
  magicLinkLimiter,
  validate(magicLinkRequestSchema),
  auditLog("MAGIC_LINK_REQUEST"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.requestMagicLink(
        req.body.email,
        req.ip || "unknown"
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/auth/magic-link/verify
router.get(
  "/magic-link/verify",
  authLimiter,
  auditLog("MAGIC_LINK_VERIFY"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }

      const result = await authService.verifyMagicLink(token);

      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CACHE_TTL.REFRESH_TOKEN * 1000,
        path: "/api/v1/auth/refresh",
      });

      res.json({ user: result.user, accessToken: result.accessToken });
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

// -- Validation schemas for new routes --
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const cancelOtpSchema = z.object({
  email: z.string().email(),
});

// POST /api/v1/auth/change-password
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  auditLog("CHANGE_PASSWORD"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.sub) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      await authService.changePassword(
        req.user.sub,
        req.body.currentPassword,
        req.body.newPassword
      );
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/forgot-password
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  auditLog("FORGOT_PASSWORD"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.requestPasswordReset(req.body.email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/reset-password
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  auditLog("RESET_PASSWORD"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body.token, req.body.newPassword);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/cancel-otp
router.post(
  "/cancel-otp",
  authLimiter,
  validate(cancelOtpSchema),
  auditLog("CANCEL_OTP"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.cancelOtpSession(req.body.email);
      res.json({ message: "OTP session cancelled" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

