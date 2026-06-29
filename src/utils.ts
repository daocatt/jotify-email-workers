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
  RETRY_QUEUE: Queue<import('./retry').RetryMessage>;
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

export function validateWebhookUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'Webhook URL must use HTTP or HTTPS protocol';
    }
    return null;
  } catch {
    return 'Invalid webhook URL format';
  }
}

export function validateRegexPattern(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch {
    return 'Invalid regex username pattern';
  }
}
