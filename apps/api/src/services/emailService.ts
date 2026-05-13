// ==============================================================================
// PocketJury API — Centralized Email Service
// ==============================================================================
//
// In development: logs email content to console via logger.
// In production: swap the transport for Resend / SendGrid / Mailgun / SMTP.
// ==============================================================================

import { logger } from "../utils/logger";

/**
 * Send a 6-digit OTP verification code for passwordless login.
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
// Transport layer — swap this for production
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // In development, log to console
  logger.info(
    { to, subject },
    `[EMAIL] To: ${to} | Subject: ${subject}\n${body}`
  );

  // Production example (uncomment and configure):
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'noreply@yourdomain.com',
  //   to,
  //   subject,
  //   text: body,
  // });
}
