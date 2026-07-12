import { createHash } from 'crypto';

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(raw: string): {
  email: string;
  emailNormalized: string;
} {
  const trimmed = raw.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return { email: trimmed, emailNormalized: trimmed.toLowerCase() };
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  const email = `${local}@${domain}`;
  return {
    email,
    emailNormalized: `${local.toLowerCase()}@${domain}`,
  };
}

export function isValidEmail(raw: string): boolean {
  const { email } = normalizeEmail(raw);
  if (email.length > 254) return false;
  return EMAIL_PATTERN.test(email);
}

/** Stable opaque externalId — never the raw email. */
export function emailExternalId(emailNormalized: string): string {
  const digest = createHash('sha256')
    .update(emailNormalized)
    .digest('hex')
    .slice(0, 32);
  return `email_${digest}`;
}
