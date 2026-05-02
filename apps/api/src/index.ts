// ==============================================================================
// PocketJury API — Express Application Entry Point
// ==============================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { env } from "./config/env";
import { corsOptions } from "./config/cors";
import redis from "./config/redis";
import { requestIdMiddleware } from "./middleware/requestId";
import { generalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import chatRoutes from "./routes/chat.routes";
import dlsaRoutes from "./routes/dlsa.routes";
import feedbackRoutes from "./routes/feedback.routes";

const app = express();

// Trust first proxy (nginx) for correct req.ip behind reverse proxy
app.set("trust proxy", 1);

// ---- Global Middleware ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

app.use(cors(corsOptions));
app.use(compression({
  // Do NOT compress SSE responses — compression buffers the entire response,
  // which completely defeats real-time token streaming.
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

// ---- Health Check ----
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "pocketjury-api",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// ---- API Routes ----
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", generalLimiter, userRoutes);
app.use("/api/v1/chats", generalLimiter, chatRoutes);
app.use("/api/v1/dlsa", generalLimiter, dlsaRoutes);
app.use("/api/v1/feedback", generalLimiter, feedbackRoutes);

// ---- 404 Handler ----
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---- Error Handler ----
app.use(errorHandler);

// ---- Server Startup ----
async function start() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info("Redis connected");

    // Start server
    app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `PocketJury API server running on port ${env.PORT}`
      );
    });
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, "Shutdown signal received");
    try {
      await redis.quit();
      logger.info("Redis disconnected");
    } catch {
      // Ignore
    }
    process.exit(0);
  });
});

start();

export default app;
