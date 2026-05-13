// ==============================================================================
// PocketJury API — Email Domain Validation (Gatekeeper)
// ==============================================================================

import { promises as dns } from "dns";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Allowlist of reputable email providers. Only emails from these domains
 * are accepted for OTP / magic-link passwordless flows.
 */
const ALLOWED_DOMAINS = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.in",
  "yahoo.fr",
  "ymail.com",
  "rocketmail.com",
  // Microsoft
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Proton
  "proton.me",
  "protonmail.com",
  "pm.me",
  // Others
  "zoho.com",
  "aol.com",
  "tutanota.com",
  "fastmail.com",
]);

/**
 * Known disposable / temporary email providers to block explicitly.
 */
const BLOCKED_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "temp-mail.org",
  "10minutemail.com",
  "throwaway.email",
  "trashmail.com",
  "fakeinbox.com",
  "yopmail.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "spamgourmet.com",
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export interface EmailValidationResult {
  valid: boolean;
  reason: string;
}

/**
 * Validates that an email address belongs to a reputable, non-disposable
 * provider. Runs format check → blocked list → allowlist → optional MX lookup.
 */
export async function validateEmailDomain(
  email: string
): Promise<EmailValidationResult> {
  const cleaned = email.trim().toLowerCase();

  // 1. Basic format check
  if (!EMAIL_REGEX.test(cleaned)) {
    return { valid: false, reason: "Invalid email format" };
  }

  const domain = cleaned.split("@")[1];

  // 2. Block disposable providers
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: "Disposable email addresses are not allowed" };
  }

  // 3. Must be in allowlist
  if (!ALLOWED_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Only emails from known providers are allowed (e.g. Gmail, Yahoo, Outlook, Proton)",
    };
  }

  // 4. Optional MX record check (behind env flag)
  if (env.VALIDATE_MX_RECORDS) {
    try {
      await dns.resolveMx(domain);
    } catch (err) {
      logger.warn({ domain, err }, "MX record lookup failed for domain");
      return { valid: false, reason: "Email domain does not appear to accept mail" };
    }
  }

  return { valid: true, reason: "OK" };
}
