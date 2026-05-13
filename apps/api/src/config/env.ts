// ==============================================================================
// PocketJury API — Environment Configuration (Validated with Zod)
// ==============================================================================

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Auth
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),

  // AI Service
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),

  // Frontend
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Passwordless Auth
  MAGIC_LINK_BASE_URL: z.string().url().optional(),
  VALIDATE_MX_RECORDS: z.coerce.boolean().default(false),
  OTP_TTL_SECONDS: z.coerce.number().default(600),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().default(15),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
