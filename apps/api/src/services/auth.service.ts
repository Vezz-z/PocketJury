// ==============================================================================
// PocketJury API — Auth Service
// ==============================================================================

import prisma from "../config/database";
import redis from "../config/redis";
import { randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "../utils/hash";
import { encrypt, hashForLookup } from "../utils/encryption";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { checkBruteForce, recordFailedLogin, resetLoginAttempts } from "../middleware/bruteForce";
import { createError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { CACHE_TTL } from "@pocketjury/shared";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  contactPhone?: string;
  preferredLanguage: string;
}

interface LoginInput {
  email: string;
  password: string;
  ip: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    role: string;
    preferredLanguage: string;
    isVerified: boolean;
    profile: {
      fullName: string;
      personaMode: string;
      profileCompleted: boolean;
    } | null;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private getLegacyRefreshKey(userId: string): string {
    return `refresh:${userId}`;
  }

  private getSessionRefreshKey(userId: string, sessionId: string): string {
    return `refresh:${userId}:${sessionId}`;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const emailHash = hashForLookup(input.email);

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { emailHash } });
    if (existing) {
      throw createError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);
    const encryptedEmail = encrypt(input.email.toLowerCase().trim());
    const encryptedName = encrypt(input.fullName);
    const encryptedDob = encrypt(input.dateOfBirth);
    const encryptedPhone = input.contactPhone ? encrypt(input.contactPhone) : null;

    const user = await prisma.user.create({
      data: {
        email: encryptedEmail,
        emailHash,
        passwordHash,
        authProvider: "EMAIL",
        preferredLanguage: input.preferredLanguage,
        isVerified: false,
        profile: {
          create: {
            fullName: encryptedName,
            dateOfBirth: encryptedDob,
            contactPhone: encryptedPhone,
          },
        },
        consents: {
          create: {
            consentType: "DATA_PROCESSING",
            granted: true,
            grantedAt: new Date(),
          },
        },
      },
      include: { profile: true },
    });

    const sessionId = randomUUID();
    const accessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
      lang: user.preferredLanguage,
      sessionId,
    });
    const refreshToken = await signRefreshToken(user.id, sessionId);

    // Store refresh token in Redis
    await redis.set(
      this.getSessionRefreshKey(user.id, sessionId),
      refreshToken,
      "EX",
      CACHE_TTL.REFRESH_TOKEN
    );

    return {
      user: {
        id: user.id,
        email: input.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: input.fullName,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    // Check brute force protection
    const bruteCheck = await checkBruteForce(input.email, input.ip);
    if (bruteCheck.blocked) {
      throw createError(
        `Too many failed login attempts. Try again in ${bruteCheck.retryAfter} seconds.`,
        429
      );
    }

    const emailHash = hashForLookup(input.email);
    const user = await prisma.user.findUnique({
      where: { emailHash },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      await recordFailedLogin(input.email, input.ip);
      throw createError("Invalid email or password", 401);
    }

    if (!user.isActive) {
      throw createError("Account is deactivated", 403);
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      await recordFailedLogin(input.email, input.ip);
      throw createError("Invalid email or password", 401);
    }

    // Reset brute force counter on success
    await resetLoginAttempts(input.email);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionId = randomUUID();
    const accessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
      lang: user.preferredLanguage,
      sessionId,
    });
    const refreshToken = await signRefreshToken(user.id, sessionId);

    await redis.set(this.getSessionRefreshKey(user.id, sessionId), refreshToken, "EX", CACHE_TTL.REFRESH_TOKEN);

    return {
      user: {
        id: user.id,
        email: input.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  async googleAuth(googleId: string, email: string, name: string): Promise<AuthResult> {
    const emailHash = hashForLookup(email);
    let user = await prisma.user.findUnique({
      where: { googleId },
      include: { profile: true },
    });

    if (!user) {
      // Check if email exists with different provider
      const existingByEmail = await prisma.user.findUnique({ where: { emailHash } });
      if (existingByEmail) {
        // Link Google to existing account (preserve original authProvider)
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId },
          include: { profile: true },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: encrypt(email.toLowerCase().trim()),
            emailHash,
            authProvider: "GOOGLE",
            googleId,
            isVerified: true,
            profile: {
              create: {
                fullName: encrypt(name),
                dateOfBirth: encrypt(""),
              },
            },
            consents: {
              create: {
                consentType: "DATA_PROCESSING",
                granted: true,
                grantedAt: new Date(),
              },
            },
          },
          include: { profile: true },
        });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionId = randomUUID();
    const accessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
      lang: user.preferredLanguage,
      sessionId,
    });
    const refreshToken = await signRefreshToken(user.id, sessionId);
    await redis.set(this.getSessionRefreshKey(user.id, sessionId), refreshToken, "EX", CACHE_TTL.REFRESH_TOKEN);

    return {
      user: {
        id: user.id,
        email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: name,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    userId: string,
    currentRefreshToken: string,
    sessionId?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshKey = sessionId
      ? this.getSessionRefreshKey(userId, sessionId)
      : this.getLegacyRefreshKey(userId);
    const stored = await redis.get(refreshKey);
    if (!stored || stored !== currentRefreshToken) {
      // Possible token reuse attack — invalidate only the affected session
      await redis.del(refreshKey);
      throw createError("Invalid refresh token", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw createError("User not found or deactivated", 401);
    }

    const effectiveSessionId = sessionId || randomUUID();
    const accessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
      lang: user.preferredLanguage,
      sessionId: effectiveSessionId,
    });
    const refreshToken = await signRefreshToken(user.id, effectiveSessionId);

    // Rotate refresh token
    if (!sessionId) {
      await redis.del(this.getLegacyRefreshKey(user.id));
    }
    await redis.set(
      this.getSessionRefreshKey(user.id, effectiveSessionId),
      refreshToken,
      "EX",
      CACHE_TTL.REFRESH_TOKEN
    );

    return { accessToken, refreshToken };
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await redis.del(this.getSessionRefreshKey(userId, sessionId));
      return;
    }

    await redis.del(this.getLegacyRefreshKey(userId));
  }
}

export const authService = new AuthService();
