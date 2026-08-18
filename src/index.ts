import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { getAuth } from './auth';
import { getDb } from './db';
import { Bindings, Env, verifyTurnstile, maskEmail } from './utils';
import { handleEmail, handleQueue } from './email-handler';
import { RetryMessage } from './retry';
import { RateLimiterDO } from './rate-limiter-do';

import publicRoutes from './routes/public';
import userRoutes from './routes/user';
import domainRoutes from './routes/domains';
import destinationRoutes from './routes/destinations';
import forwardRuleRoutes from './routes/forward-rules';
import webhookRoutes from './routes/webhooks';
import webhookRuleRoutes from './routes/webhook-rules';
import failedWebhookRoutes from './routes/failed-webhooks';
import adminRoutes from './routes/admin';

const app = new Hono<Env>();

app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return null;
    if (origin === 'http://localhost:5173' || origin === 'http://localhost:8787') {
      return origin;
    }
    const configuredUrl = c.env.BETTER_AUTH_URL?.trim();
    if (configuredUrl) {
      try {
        const parsed = new URL(configuredUrl);
        if (origin === parsed.origin) {
          return origin;
        }
      } catch {}
    }
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-CSRF-Token'],
  credentials: true,
}));

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

app.use('*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  if (!c.env.RATE_LIMITER) {
    await next();
    return;
  }
  const id = c.env.RATE_LIMITER.idFromName(`ip:${ip}`);
  const stub = c.env.RATE_LIMITER.get(id);
  const result = await stub.check(ip, 120, 60_000);
  if (!result.allowed) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});

let seedPromise: Promise<void> | null = null;

async function ensureSuperadminSeeded(env: Bindings) {
  const db = getDb(env.DB);
  const adminEmail = env.SUPERADMIN_EMAIL;
  const adminPassword = env.SUPERADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const existing = await db.select({ id: schema.user.id }).from(schema.user)
    .where(eq(schema.user.email, adminEmail)).then(r => r[0]);
  if (existing) return;

  console.log(`[Seeding] Seeding default superadmin user ${maskEmail(adminEmail)}...`);
  try {
    const auth = getAuth(env.DB, env.BETTER_AUTH_SECRET, env.BETTER_AUTH_URL);
    await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: 'Super Admin' }
    });
    await db.update(schema.user)
      .set({ role: 'superadmin', status: 'approved', mustChangePassword: true })
      .where(eq(schema.user.email, adminEmail));
    console.log('[Seeding] Superadmin seeded successfully.');
  } catch {
    console.error('[Seeding] Superadmin seeding failed');
  }
}

app.use('*', async (c, next) => {
  if (!seedPromise) {
    seedPromise = ensureSuperadminSeeded(c.env);
  }
  await seedPromise;
  await next();
});

app.post('/api/auth/sign-in/email', async (c, next) => {
  let bodyText = '';
  let email = '';
  try {
    bodyText = await c.req.text();
    const body = JSON.parse(bodyText);
    email = (body.email || '').toLowerCase().trim();
    if (c.env.TURNSTILE_SECRET_KEY) {
      const ok = await verifyTurnstile(body.turnstileToken, c.env.TURNSTILE_SECRET_KEY);
      if (!ok) {
        return c.json({ message: 'Turnstile 验证失败' }, 400);
      }
    }
  } catch (err) {
    return c.json({ message: '请求格式错误' }, 400);
  }
  c.req.raw = new Request(c.req.raw, { body: bodyText });

  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  if (c.env.RATE_LIMITER) {
    const ipId = c.env.RATE_LIMITER.idFromName(`login:ip:${ip}`);
    const ipStub = c.env.RATE_LIMITER.get(ipId);
    const ipResult = await ipStub.check(ip, 10, 60_000);
    if (!ipResult.allowed) {
      return c.json({ message: 'Too many requests' }, 429);
    }
    if (email) {
      const acctId = c.env.RATE_LIMITER.idFromName(`login:acct:${email}`);
      const acctStub = c.env.RATE_LIMITER.get(acctId);
      if (await acctStub.isBlocked(email, 5, 15 * 60_000)) {
        return c.json({ message: 'Too many attempts. Please try again later.' }, 429);
      }
    }
  }

  await next();

  if (c.env.RATE_LIMITER && email) {
    const acctId = c.env.RATE_LIMITER.idFromName(`login:acct:${email}`);
    const acctStub = c.env.RATE_LIMITER.get(acctId);
    if (c.res && c.res.status >= 400) {
      await acctStub.recordFailure(email, 15 * 60_000);
    } else if (c.res && c.res.status === 200) {
      await acctStub.clear(email);
    }
  }
});

app.post('/api/auth/sign-up/email', (c) => {
  return c.json({ message: 'Registration is handled via /api/public/register' }, 404);
});

app.post('/api/auth/request-password-reset', (c) => {
  return c.json({ message: 'Password reset is handled via /api/public/reset-password' }, 404);
});

app.post('/api/auth/reset-password', (c) => {
  return c.json({ message: 'Password reset is handled via /api/public/reset-password' }, 404);
});

app.get('/api/auth/reset-password/:token', (c) => {
  return c.json({ message: 'Password reset is handled via /api/public/reset-password' }, 404);
});

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  return auth.handler(c.req.raw);
});

app.route('/', publicRoutes);
app.route('/', userRoutes);
app.route('/', domainRoutes);
app.route('/', destinationRoutes);
app.route('/', forwardRuleRoutes);
app.route('/', webhookRoutes);
app.route('/', webhookRuleRoutes);
app.route('/', failedWebhookRoutes);
app.route('/', adminRoutes);

app.get('*', async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404 && !c.req.path.startsWith('/api/')) {
      return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url), c.req.raw));
    }
    return res;
  }
  return c.text('Not Found', 404);
});

export { RateLimiterDO } from './rate-limiter-do';

async function runCleanup(db: D1Database): Promise<void> {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const retentionIdempotency = new Date(now - 30 * day).toISOString();
  const retentionAudit = now - 90 * day;
  const retentionFailed = now - 30 * day;

  const results: string[] = [];
  const di = await db.prepare('DELETE FROM delivery_idempotency WHERE created_at < ?').bind(retentionIdempotency).run();
  results.push(`delivery_idempotency=${di.meta.changes}`);
  const al = await db.prepare('DELETE FROM audit_log WHERE createdAt < ?').bind(retentionAudit).run();
  results.push(`audit_log=${al.meta.changes}`);
  const fw = await db.prepare('DELETE FROM failed_webhooks WHERE createdAt < ?').bind(retentionFailed).run();
  results.push(`failed_webhooks=${fw.meta.changes}`);
  const v = await db.prepare('DELETE FROM verification WHERE expiresAt < ?').bind(now).run();
  results.push(`verification=${v.meta.changes}`);
  const ca = await db.prepare('DELETE FROM code_attempts WHERE expiresAt < ?').bind(now).run();
  results.push(`code_attempts=${ca.meta.changes}`);

  console.log(`[Cleanup] ${results.join(', ')}`);
}

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cleanup] Running scheduled cleanup (cron: ${controller.cron})`);
    try {
      await runCleanup(env.DB);
    } catch (err) {
      console.error('[Cleanup] Failed:', err);
    }
  },

  async email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext): Promise<void> {
    return handleEmail(message, env, ctx);
  },

  async queue(batch: MessageBatch<RetryMessage>, env: Bindings, ctx: ExecutionContext): Promise<void> {
    return handleQueue(batch, env, ctx);
  },
};
