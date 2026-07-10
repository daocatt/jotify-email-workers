import { eq } from 'drizzle-orm';
import { getAuth } from './auth';
import { getDb } from './db';
import * as schema from './db/schema';

export interface Bindings {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  ALLOW_REGISTER: string;
  REQUIRE_APPROVAL: string;
  MAX_DOMAINS_PER_USER: string;
  RESEND_FROM_NAME?: string;
  RESEND_FROM_EMAIL?: string;
  SUPERADMIN_EMAIL?: string;
  SUPERADMIN_PASSWORD?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  ATTACHMENT_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  WEBHOOK_SIGNING_SECRET?: string;
  RETRY_QUEUE: Queue<import('./retry').RetryMessage>;
  RATE_LIMITER: DurableObjectNamespace<import('./rate-limiter-do').RateLimiterDO>;
}

export type Env = { Bindings: Bindings };

export async function getSessionUser(c: any) {
  const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.user) return null;
  const db = getDb(c.env.DB);
  const u = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id)).then(r => r[0]);
  if (!u || u.status !== 'approved') return null;
  return { ...session, dbUser: u };
}

export async function verifyTurnstile(token: string | undefined, secretKey: string | undefined): Promise<boolean> {
  if (!secretKey) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json() as any;
    return !!data.success;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

export async function hashShortKey(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PRIVATE_IP_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.0\./,
  /^192\.168\./,
  /^198\.1[8-9]\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

export function validateWebhookUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return 'Webhook URL must use HTTPS protocol';
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return 'Webhook URL cannot point to local/internal addresses';
    }
    if (PRIVATE_IP_RANGES.some(r => r.test(hostname))) {
      return 'Webhook URL cannot point to private IP addresses';
    }
    if (/^\[|^[0-9a-f]*:|::1?$/i.test(hostname)) {
      return 'Webhook URL cannot point to IP addresses (domain names only)';
    }
    return null;
  } catch {
    return 'Invalid webhook URL format';
  }
}

const RE_DANGEROUS = /\(\?[^)]*[+*][+*]|\(\[[^\]]*\][+*][+*]|\(\([^)]*\)[+*][+*]|\([^)]*\)[+*]\s*[+*]|\([^)]*[+*][+*][^)]*\)/;
const MAX_REGEX_LEN = 128;
const MAX_USERNAME_LEN = 256;

export function validateRegexPattern(pattern: string): string | null {
  if (!pattern || pattern.length > MAX_REGEX_LEN) {
    return `Regex pattern must be 1-${MAX_REGEX_LEN} characters`;
  }
  if (RE_DANGEROUS.test(pattern)) {
    return 'Regex pattern contains potentially dangerous nested quantifiers';
  }
  try {
    new RegExp(pattern);
    return null;
  } catch {
    return 'Invalid regex username pattern';
  }
}

export function safeRegexTest(pattern: string, input: string, flags = 'i'): boolean | null {
  if (input.length > MAX_USERNAME_LEN) return null;
  try {
    const regex = new RegExp(`^${pattern}$`, flags);
    return regex.test(input);
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain uppercase, lowercase, and a number';
  }
  return null;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`;
}

export function maskAuthToken(authType: string, token: string | null): string | null {
  if (!token) return null;
  if (authType === 'bearer') {
    const clean = token.replace(/^bearer\s+/i, '');
    return clean.length <= 6 ? '***' : `${clean.slice(0, 3)}***${clean.slice(-3)}`;
  }
  if (authType === 'header') {
    const parts = token.split(':');
    if (parts.length === 2) {
      const v = parts[1].trim();
      return `${parts[0].trim()}:${v.length <= 6 ? '***' : `${v.slice(0, 3)}***${v.slice(-3)}`}`;
    }
    return token.length <= 6 ? '***' : `${token.slice(0, 3)}***${token.slice(-3)}`;
  }
  return null;
}

export async function signWebhookPayload(payload: unknown, secret: string): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
