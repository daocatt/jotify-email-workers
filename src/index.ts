import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq, sql } from 'drizzle-orm';
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
  exposeHeaders: ['Set-Cookie'],
  credentials: true,
}));

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
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user).then(r => r[0]?.count || 0);
  if (userCount > 0) return;

  const adminEmail = env.SUPERADMIN_EMAIL;
  const adminPassword = env.SUPERADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('[Seeding] SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be configured to seed the initial admin.');
    return;
  }
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
  } catch (err: any) {
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
  if (c.env.TURNSTILE_SECRET_KEY) {
    try {
      const bodyText = await c.req.text();
      const body = JSON.parse(bodyText);
      const ok = await verifyTurnstile(body.turnstileToken, c.env.TURNSTILE_SECRET_KEY);
      if (!ok) {
        return c.json({ message: 'Turnstile 验证失败' }, 400);
      }
      c.req.raw = new Request(c.req.raw, { body: bodyText });
    } catch (err) {
      return c.json({ message: '请求格式错误' }, 400);
    }
  }
  await next();
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
app.route('/', adminRoutes);

export { RateLimiterDO } from './rate-limiter-do';

export default {
  fetch: app.fetch,

  async email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext): Promise<void> {
    return handleEmail(message, env, ctx);
  },

  async queue(batch: MessageBatch<RetryMessage>, env: Bindings, ctx: ExecutionContext): Promise<void> {
    return handleQueue(batch, env, ctx);
  },
};
