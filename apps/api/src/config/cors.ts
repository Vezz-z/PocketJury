// ==============================================================================
// PocketJury API — CORS Configuration
// ==============================================================================

import cors from "cors";
import { env } from "./env";

export const corsOptions: cors.CorsOptions = {
  origin: [env.FRONTEND_URL],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id", "Retry-After"],
  maxAge: 600, // 10 minutes
};
