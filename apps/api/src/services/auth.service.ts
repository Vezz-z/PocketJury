// ==============================================================================
// PocketJury API — Auth Service
// ==============================================================================

import prisma from "../config/database";
import redis from "../config/redis";
import { randomUUID, createHash, timingSafeEqual } from "crypto";
import { hashPassword, verifyPassword } from "../utils/hash";
import { encrypt, hashForLookup } from "../utils/encryption";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { checkBruteForce, recordFailedLogin, resetLoginAttempts } from "../middleware/bruteForce";
import { createError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { validateEmailDomain } from "../utils/emailValidator";
import { sendOtpEmail, sendMagicLinkEmail, sendVerificationEmail, sendMfaEmail, sendPasswordResetEmail } from "./emailService";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";
import { CACHE_TTL, OTP } from "@pocketjury/shared";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth?: string;
  contactPhone?: string;
  preferredLanguage: string;
}

interface LoginInput {
  email: string;
  password: string;
  ip: string;
}

interface AuthResult {
  user?: {
    id: string;
    email: string;
    authProvider: string;
    googleId: string | null;
    role: string;
    preferredLanguage: string;
    isVerified: boolean;
    profile: {
      fullName: string;
      dateOfBirth: string | null;
      personaMode: string;
      profileCompleted: boolean;
    } | null;
  };
  accessToken?: string;
  refreshToken?: string;
  mfaRequired?: boolean;
}

export class AuthService {
  private formatGoogleBirthday(person: GooglePersonResponse): string | null {
    const birthday = person.birthdays?.find((entry) => {
      const date = entry.date;
      return date?.year && date.month && date.day;
    });

    if (!birthday?.date?.year || !birthday.date.month || !birthday.date.day) {
      return null;
    }

    const year = birthday.date.year.toString().padStart(4, "0");
    const month = birthday.date.month.toString().padStart(2, "0");
    const day = birthday.date.day.toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashOtp(otp: string): string {
    return createHash("sha256").update(otp).digest("hex");
  }

  private getOtpRedisKey(emailHash: string): string {
    return `otp:${emailHash}`;
  }

  private getMagicLinkUsedKey(jti: string): string {
    return `magiclink:used:${jti}`;
  }

  private getMagicLinkSecret(): Uint8Array {
    // Derive a symmetric key from the existing JWT private key for magic link signing
    const hash = createHash("sha256").update(env.ENCRYPTION_KEY).digest();
    return new Uint8Array(hash);
  }

  private async fetchGoogleDateOfBirth(accessToken?: string): Promise<string | null> {
    if (!accessToken) return null;

    try {
      const response = await fetch(
        "https://people.googleapis.com/v1/people/me?personFields=birthdays",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        logger.warn({ status: response.status }, "Google People API birthday fetch failed");
        return null;
      }

      const person = (await response.json()) as GooglePersonResponse;
      return this.formatGoogleBirthday(person);
    } catch (err) {
      logger.warn({ err }, "Unable to fetch Google birthday");
      return null;
    }
  }

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
    const encryptedDob = input.dateOfBirth ? encrypt(input.dateOfBirth) : null;
    const encryptedPhone = input.contactPhone ? encrypt(input.contactPhone) : null;

    const verificationCode = this.generateCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const user = await prisma.user.create({
      data: {
        email: encryptedEmail,
        emailHash,
        passwordHash,
        authProvider: "EMAIL",
        preferredLanguage: input.preferredLanguage,
        isVerified: false,
        verificationCode,
        verificationExpires,
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

    await sendVerificationEmail(input.email, verificationCode);

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
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: input.fullName,
            dateOfBirth: input.dateOfBirth || null,
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

    if (!user.isVerified) {
      const code = this.generateCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code, verificationExpires: new Date(Date.now() + 15 * 60 * 1000) }
      });
      await sendVerificationEmail(input.email, code);
      throw createError("Email not verified. A new code has been sent.", 403);
    }

    if (user.mfaEnabled) {
      const otp = this.generateCode();
      const otpHash = this.hashOtp(otp);
      const otpKey = this.getOtpRedisKey(emailHash);
      const ttl = env.OTP_TTL_SECONDS;

      await redis.set(
        otpKey,
        JSON.stringify({ hash: otpHash, attempts: 0 }),
        "EX",
        ttl
      );
      await sendMfaEmail(input.email, otp);
      return { mfaRequired: true };
    }

    // User is verified and MFA is not required -> Issue tokens directly
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
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            dateOfBirth: null,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  async googleAuth(googleId: string, email: string, name: string, googleAccessToken?: string): Promise<AuthResult> {
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

    if (!user) {
      throw createError("Failed to create or find Google user", 500);
    }

    if (user.profile) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          profile: {
            update: {
              fullName: encrypt(name),
            },
          },
        },
        include: { profile: true },
      });
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
        id: user!.id,
        email,
        authProvider: user!.authProvider,
        googleId: user!.googleId,
        role: user!.role,
        preferredLanguage: user!.preferredLanguage,
        isVerified: user!.isVerified,
        profile: user!.profile
          ? {
            fullName: name,
            dateOfBirth: null,
            personaMode: user!.profile.personaMode,
            profileCompleted: user!.profile.profileCompleted,
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

  async verifyEmail(email: string, code: string): Promise<AuthResult> {
    const emailHash = hashForLookup(email);
    const user = await prisma.user.findUnique({
      where: { emailHash },
      include: { profile: true },
    });

    if (!user) throw createError("User not found", 404);
    if (user.isVerified) throw createError("Email already verified", 400);
    if (!user.verificationCode || user.verificationCode !== code) {
      throw createError("Invalid verification code", 401);
    }
    if (user.verificationExpires && new Date() > user.verificationExpires) {
      throw createError("Verification code expired", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationCode: null, verificationExpires: null, lastLoginAt: new Date() },
    });

    if (user.mfaEnabled) {
      const mfaCode = this.generateCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: mfaCode, verificationExpires: new Date(Date.now() + 15 * 60 * 1000) }
      });
      await sendMfaEmail(email, mfaCode);
      return { mfaRequired: true };
    }

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
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: true,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            dateOfBirth: null,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  async verifyMfa(email: string, code: string): Promise<AuthResult> {
    const emailHash = hashForLookup(email);
    const otpKey = this.getOtpRedisKey(emailHash);

    // 1. Retrieve stored OTP data from Redis
    const stored = await redis.get(otpKey);
    if (!stored) {
      throw createError("Verification code expired. Please log in again.", 401);
    }

    const otpData = JSON.parse(stored) as { hash: string; attempts: number };

    // 2. Check max attempts
    if (otpData.attempts >= OTP.MAX_ATTEMPTS) {
      await redis.del(otpKey);
      throw createError("Too many failed attempts. Please log in again.", 429);
    }

    // 3. Constant-time comparison via SHA-256
    const enteredHash = this.hashOtp(code);
    const storedBuf = Buffer.from(otpData.hash, "hex");
    const enteredBuf = Buffer.from(enteredHash, "hex");

    if (storedBuf.length !== enteredBuf.length || !timingSafeEqual(storedBuf, enteredBuf)) {
      otpData.attempts += 1;
      const ttl = await redis.ttl(otpKey);
      await redis.set(otpKey, JSON.stringify(otpData), "EX", ttl > 0 ? ttl : env.OTP_TTL_SECONDS);
      throw createError("Invalid verification code", 401);
    }

    // 4. Code valid — invalidate it
    await redis.del(otpKey);

    // 5. Fetch user and create session
    const user = await prisma.user.findUnique({
      where: { emailHash },
      include: { profile: true },
    });

    if (!user) throw createError("User not found", 404);
    if (!user.isActive) throw createError("Account is deactivated", 403);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: null, verificationExpires: null, lastLoginAt: new Date() },
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
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            dateOfBirth: null,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }
  // ==========================================================================
  // OTP Passwordless Flow
  // ==========================================================================

  async requestOtpLogin(email: string, ip: string): Promise<{ message: string }> {
    // 1. Validate email domain
    const validation = await validateEmailDomain(email);
    if (!validation.valid) {
      throw createError(validation.reason, 400);
    }

    // 2. Check brute force
    const bruteCheck = await checkBruteForce(email, ip);
    if (bruteCheck.blocked) {
      throw createError(
        `Too many requests. Try again in ${bruteCheck.retryAfter} seconds.`,
        429
      );
    }

    // 3. Check user exists
    const emailHash = hashForLookup(email);
    const user = await prisma.user.findUnique({ where: { emailHash } });
    if (!user) {
      // Don't reveal whether the account exists — return success anyway
      logger.warn({ email: emailHash }, "OTP requested for non-existent account");
      return { message: "If an account exists, a code has been sent to your email." };
    }

    if (!user.isActive) {
      throw createError("Account is deactivated", 403);
    }

    // 4. Generate OTP and store hashed in Redis
    const otp = this.generateCode();
    const otpHash = this.hashOtp(otp);
    const otpKey = this.getOtpRedisKey(emailHash);
    const ttl = env.OTP_TTL_SECONDS;

    await redis.set(
      otpKey,
      JSON.stringify({ hash: otpHash, attempts: 0 }),
      "EX",
      ttl
    );

    // 5. Send email
    await sendOtpEmail(email, otp);

    return { message: "If an account exists, a code has been sent to your email." };
  }

  async verifyOtpLogin(email: string, otp: string, ip: string): Promise<AuthResult> {
    const emailHash = hashForLookup(email);
    const otpKey = this.getOtpRedisKey(emailHash);

    // 1. Retrieve stored OTP data
    const stored = await redis.get(otpKey);
    if (!stored) {
      throw createError("No OTP found. Request a new one.", 401);
    }

    const otpData = JSON.parse(stored) as { hash: string; attempts: number };

    // 2. Check max attempts
    if (otpData.attempts >= OTP.MAX_ATTEMPTS) {
      await redis.del(otpKey);
      throw createError("Too many failed attempts. Request a new OTP.", 429);
    }

    // 3. Constant-time comparison
    const enteredHash = this.hashOtp(otp);
    const storedBuf = Buffer.from(otpData.hash, "hex");
    const enteredBuf = Buffer.from(enteredHash, "hex");

    if (storedBuf.length !== enteredBuf.length || !timingSafeEqual(storedBuf, enteredBuf)) {
      // Increment attempts
      otpData.attempts += 1;
      const ttl = await redis.ttl(otpKey);
      await redis.set(otpKey, JSON.stringify(otpData), "EX", ttl > 0 ? ttl : env.OTP_TTL_SECONDS);
      await recordFailedLogin(email, ip);
      throw createError("Invalid OTP.", 401);
    }

    // 4. OTP valid — invalidate it
    await redis.del(otpKey);
    await resetLoginAttempts(email);

    // 5. Fetch user and create session
    const user = await prisma.user.findUnique({
      where: { emailHash },
      include: { profile: true },
    });

    if (!user) throw createError("User not found", 404);
    if (!user.isActive) throw createError("Account is deactivated", 403);

    // Auto-verify email if not verified (user proved ownership via OTP)
    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verificationCode: null, verificationExpires: null },
      });
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
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: true,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            dateOfBirth: null,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  // ==========================================================================
  // Magic Link Passwordless Flow
  // ==========================================================================

  async requestMagicLink(email: string, ip: string): Promise<{ message: string }> {
    // 1. Validate email domain
    const validation = await validateEmailDomain(email);
    if (!validation.valid) {
      throw createError(validation.reason, 400);
    }

    // 2. Check brute force
    const bruteCheck = await checkBruteForce(email, ip);
    if (bruteCheck.blocked) {
      throw createError(
        `Too many requests. Try again in ${bruteCheck.retryAfter} seconds.`,
        429
      );
    }

    // 3. Check user exists
    const emailHash = hashForLookup(email);
    const user = await prisma.user.findUnique({ where: { emailHash } });
    if (!user) {
      // Don't reveal whether the account exists
      logger.warn({ email: emailHash }, "Magic link requested for non-existent account");
      return { message: "If an account exists, a login link has been sent to your email." };
    }

    if (!user.isActive) {
      throw createError("Account is deactivated", 403);
    }

    // 4. Generate JWT magic link token
    const jti = randomUUID();
    const secret = this.getMagicLinkSecret();
    const token = await new SignJWT({
      sub: emailHash,
      jti,
      purpose: "magic_login",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(`${env.MAGIC_LINK_TTL_MINUTES}m`)
      .setIssuer("pocketjury")
      .setAudience("pocketjury-magic")
      .sign(secret);

    // 5. Store jti in Redis so we can enforce single-use
    await redis.set(
      this.getMagicLinkUsedKey(jti),
      "pending",
      "EX",
      env.MAGIC_LINK_TTL_MINUTES * 60
    );

    // 6. Build magic URL and send email
    const baseUrl = env.MAGIC_LINK_BASE_URL || env.FRONTEND_URL;
    const magicUrl = `${baseUrl}/verify-magic?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail(email, magicUrl);

    return { message: "If an account exists, a login link has been sent to your email." };
  }

  async verifyMagicLink(token: string): Promise<AuthResult> {
    const secret = this.getMagicLinkSecret();

    // 1. Verify JWT signature and expiry
    let payload;
    try {
      const result = await jwtVerify(token, secret, {
        issuer: "pocketjury",
        audience: "pocketjury-magic",
      });
      payload = result.payload;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_JWT_EXPIRED") {
        throw createError("Link has expired. Request a new one.", 401);
      }
      throw createError("Invalid or tampered link.", 401);
    }

    // 2. Validate purpose
    if (payload.purpose !== "magic_login") {
      throw createError("Invalid token purpose.", 401);
    }

    const jti = payload.jti;
    if (!jti) {
      throw createError("Invalid token.", 401);
    }

    // 3. Check single-use: token must exist and be "pending"
    const usedKey = this.getMagicLinkUsedKey(jti);
    const status = await redis.get(usedKey);
    if (!status) {
      throw createError("Link has expired. Request a new one.", 401);
    }
    if (status === "used") {
      throw createError("Link already used.", 401);
    }

    // Mark as used
    await redis.set(usedKey, "used", "EX", 60); // Keep for 60s to prevent race conditions

    // 4. Fetch user by emailHash (stored in sub claim)
    const emailHash = payload.sub;
    if (!emailHash) {
      throw createError("Invalid token.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { emailHash },
      include: { profile: true },
    });

    if (!user) throw createError("User not found", 404);
    if (!user.isActive) throw createError("Account is deactivated", 403);

    // Auto-verify email if not verified (user proved ownership via magic link)
    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, verificationCode: null, verificationExpires: null },
      });
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
        email: "[verified]",
        authProvider: user.authProvider,
        googleId: user.googleId,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        isVerified: true,
        profile: user.profile
          ? {
            fullName: "[encrypted]",
            dateOfBirth: null,
            personaMode: user.profile.personaMode,
            profileCompleted: user.profile.profileCompleted,
          }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---------------------------------------------------------------------------
  // Change Password (authenticated users)
  // ---------------------------------------------------------------------------

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError("User not found", 404);
    if (!user.isActive) throw createError("Account is deactivated", 403);

    // Google-only accounts cannot change password
    if (user.authProvider === "GOOGLE" && !user.passwordHash) {
      throw createError("Password is managed by Google. Use Google to change it.", 400);
    }

    if (!user.passwordHash) {
      throw createError("No password set for this account", 400);
    }

    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw createError("Current password is incorrect", 401);
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    logger.info({ userId }, "Password changed successfully");
  }

  // ---------------------------------------------------------------------------
  // Forgot Password — Request Reset Link
  // ---------------------------------------------------------------------------

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const emailHash = hashForLookup(email);
    const user = await prisma.user.findUnique({ where: { emailHash } });

    // Always return success to prevent email enumeration
    const successMsg = { message: "If an account exists, a reset link has been sent." };

    if (!user || !user.isActive) return successMsg;
    if (user.authProvider === "GOOGLE" && !user.passwordHash) return successMsg;

    // Generate a short-lived JWT reset token
    const secret = new TextEncoder().encode(env.JWT_PRIVATE_KEY);
    const resetToken = await new SignJWT({ sub: user.id, purpose: "password_reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .setJti(randomUUID())
      .sign(secret);

    // Store token hash in DB for single-use enforcement
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const baseUrl = env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/en/reset-password?token=${encodeURIComponent(resetToken)}`;

    await sendPasswordResetEmail(email, resetUrl);
    logger.info({ userId: user.id }, "Password reset link sent");

    return successMsg;
  }

  // ---------------------------------------------------------------------------
  // Reset Password — Validate Token & Set New Password
  // ---------------------------------------------------------------------------

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const secret = new TextEncoder().encode(env.JWT_PRIVATE_KEY);
    let payload: { sub?: string; purpose?: string };

    try {
      const result = await jwtVerify(token, secret);
      payload = result.payload as { sub?: string; purpose?: string };
    } catch {
      throw createError("Reset link is invalid or has expired.", 401);
    }

    if (payload.purpose !== "password_reset" || !payload.sub) {
      throw createError("Invalid reset token.", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw createError("User not found or deactivated.", 404);
    }

    // Single-use: verify token hash matches
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!user.passwordResetToken || user.passwordResetToken !== tokenHash) {
      throw createError("Reset link has already been used.", 401);
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw createError("Reset link has expired.", 401);
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all existing sessions for security
    const keys = await redis.keys(`refresh:${user.id}:*`);
    if (keys.length > 0) await redis.del(...keys);

    logger.info({ userId: user.id }, "Password reset successfully, all sessions invalidated");
  }

  // ---------------------------------------------------------------------------
  // Cancel OTP Session (when user edits email in OTP step)
  // ---------------------------------------------------------------------------

  async cancelOtpSession(email: string): Promise<void> {
    const emailHash = hashForLookup(email);
    const otpKey = this.getOtpRedisKey(emailHash);

    // Delete OTP key and attempt counter
    await redis.del(otpKey);
    await redis.del(`${otpKey}:attempts`);

    logger.info({ emailHash }, "OTP session cancelled (email edit)");
  }
}

export const authService = new AuthService();

interface GooglePersonResponse {
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
  }>;
}

