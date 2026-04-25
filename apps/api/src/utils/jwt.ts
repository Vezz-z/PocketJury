// ==============================================================================
// PocketJury API — JWT Utilities (RS256)
// ==============================================================================

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from "jose";
import { randomUUID } from "crypto";
import { env } from "../config/env";

export interface TokenPayload extends JWTPayload {
  sub: string;
  role: string;
  lang: string;
  sid?: string;
}

let privateKey: CryptoKey;
let publicKey: CryptoKey;

async function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKey) {
    // .env stores PEM with literal \n — convert to real newlines for jose
    const pem = env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n");
    privateKey = await importPKCS8(pem, "RS256");
  }
  return privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!publicKey) {
    const pem = env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");
    publicKey = await importSPKI(pem, "RS256");
  }
  return publicKey;
}

export async function signAccessToken(payload: {
  userId: string;
  role: string;
  lang: string;
  sessionId?: string;
}): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({
    sub: payload.userId,
    role: payload.role,
    lang: payload.lang,
    ...(payload.sessionId ? { sid: payload.sessionId } : {}),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .setIssuer("pocketjury")
    .setAudience("pocketjury-api")
    .sign(key);
}

export async function signRefreshToken(userId: string, sessionId?: string): Promise<string> {
  const key = await getPrivateKey();
  const effectiveSessionId = sessionId ?? randomUUID();
  return new SignJWT({ sub: userId, sid: effectiveSessionId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRY)
    .setIssuer("pocketjury")
    .setAudience("pocketjury-refresh")
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: "pocketjury",
    audience: "pocketjury-api",
  });
  return payload as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: "pocketjury",
    audience: "pocketjury-refresh",
  });
  return payload;
}
