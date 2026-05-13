// ==============================================================================
// PocketJury API — Centralized Email Service
// ==============================================================================
//
// Transport priority (checked in order):
//   1. Resend  — if RESEND_API_KEY is set
//   2. SMTP    — if SMTP_HOST is set (e.g. Gmail via Nodemailer)
//   3. Console — fallback for development (no real email sent)
//
// No code changes are needed to switch modes — just set env vars.
// ==============================================================================

import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Build transports once at startup
// ---------------------------------------------------------------------------

// Resend transport (lazy import so the package is optional at runtime)
let resendClient: { emails: { send: (opts: ResendSendOptions) => Promise<unknown> } } | null = null;
if (process.env.RESEND_API_KEY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resend } = require("resend") as { Resend: new (key: string) => typeof resendClient };
    resendClient = new Resend(process.env.RESEND_API_KEY) as typeof resendClient;
    logger.info("[EMAIL] Transport: Resend");
  } catch {
    logger.warn("[EMAIL] RESEND_API_KEY is set but 'resend' package is not installed. Falling back.");
  }
}

// SMTP transport via Nodemailer
const smtpTransport = !resendClient && process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465 (TLS), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

if (smtpTransport) {
  logger.info(`[EMAIL] Transport: SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
}

if (!resendClient && !smtpTransport) {
  logger.warn("[EMAIL] No email transport configured — emails will be logged to console only.");
  logger.warn("[EMAIL] To enable real emails, set SMTP_HOST or RESEND_API_KEY in your .env file.");
}

// ---------------------------------------------------------------------------
// Public sending functions
// ---------------------------------------------------------------------------

/**
 * Send a 6-digit OTP for passwordless login.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = "Your PocketJury login code";
  const body = `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
  await sendEmail(to, subject, body);
}

/**
 * Send a magic link for one-click passwordless login.
 */
export async function sendMagicLinkEmail(to: string, magicUrl: string): Promise<void> {
  const subject = "Your PocketJury login link";
  const body = `Click the link below to log in:\n\n${magicUrl}\n\nThis link expires in 15 minutes and can only be used once.`;
  await sendEmail(to, subject, body);
}

/**
 * Send an email verification code (registration flow).
 */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const subject = "Verify your PocketJury account";
  const body = `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`;
  await sendEmail(to, subject, body);
}

/**
 * Send an MFA verification code (login flow).
 */
export async function sendMfaEmail(to: string, code: string): Promise<void> {
  const subject = "Your PocketJury MFA code";
  const body = `Your MFA login code is: ${code}\n\nThis code expires in 15 minutes. Do not share it.`;
  await sendEmail(to, subject, body);
}

/**
 * Send a password reset link.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your PocketJury password";
  const body = `Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 15 minutes and can only be used once.\n\nIf you did not request this, please ignore this email.`;
  await sendEmail(to, subject, body);
}

// ---------------------------------------------------------------------------
// Internal transport dispatcher
// ---------------------------------------------------------------------------

interface ResendSendOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@pocketjury.app";

  if (resendClient) {
    await resendClient.emails.send({ from, to, subject, text: body });
    logger.info({ to, subject }, "[EMAIL] Sent via Resend");
    return;
  }

  if (smtpTransport) {
    await smtpTransport.sendMail({ from, to, subject, text: body });
    logger.info({ to, subject }, "[EMAIL] Sent via SMTP");
    return;
  }

  // Development fallback — log to console
  logger.info(
    { to, subject },
    `[EMAIL] To: ${to} | Subject: ${subject}\n${body}`
  );
}
