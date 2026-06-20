import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, or } from 'drizzle-orm';
import * as schema from './db/schema';
import { getAuth } from './auth';
import { getDb } from './db';
import PostalMime from 'postal-mime';
import { hashPassword } from 'better-auth/crypto';

// ── Bindings and Hono Types ──────────────────────────────────────────────────

interface Bindings {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  ALLOW_REGISTER: string; // 'true' or 'false'
  REQUIRE_APPROVAL: string; // 'true' or 'false'
  MAX_DOMAINS_PER_USER: string; // default "1"
  JOTIFY_API_URL: string; // VPS URL (no trailing slash)
  INBOUND_API_TOKEN: string; // Inbound post token for Hono VPS
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
  credentials: true,
}));

// Helper to get authenticated user session
async function getSessionUser(c: any) {
  const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.user) return null;
  // If account is not active, return null
  const db = getDb(c.env.DB);
  const u = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id)).then(r => r[0]);
  if (!u || u.status !== 'approved') return null;
  return { ...session, dbUser: u };
}

// ── Superadmin Autoseeding Middleware ────────────────────────────────────────

app.use('*', async (c, next) => {
  const db = getDb(c.env.DB);
  const userCount = await db.select({ count: sql`count(*)` }).from(schema.user).then(r => r[0]?.count || 0);
  if (userCount === 0) {
    console.log('🌱 Seeding default superadmin user admin@jotify.cc...');
    try {
      const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
      await auth.api.signUpEmail({
        body: {
          email: 'admin@jotify.cc',
          password: 'admin123456',
          name: 'Super Admin',
        }
      });
      // Force status to approved and role to superadmin
      await db.update(schema.user)
        .set({ role: 'superadmin', status: 'approved' })
        .where(eq(schema.user.email, 'admin@jotify.cc'));
      console.log('✅ Superadmin seeded successfully.');
    } catch (err: any) {
      console.error('❌ Superadmin seeding failed:', err.message);
    }
  }
  await next();
});

// ── Better Auth Middleware ───────────────────────────────────────────────────

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  return auth.handler(c.req.raw);
});

// ── Auth helper API endpoints ────────────────────────────────────────────────

// Send verification code
app.post('/api/public/send-code', async (c) => {
  const { email, type } = await c.req.json();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  const db = getDb(c.env.DB);
  const existingUser = await db.select().from(schema.user).where(eq(schema.user.email, email)).then(r => r[0]);

  if (type === 'register') {
    const allowRegister = c.env.ALLOW_REGISTER !== 'false';
    if (!allowRegister) {
      return c.json({ error: 'Registration is closed' }, 400);
    }
    if (existingUser) {
      return c.json({ error: 'Email already registered' }, 400);
    }
  } else if (type === 'reset') {
    if (!existingUser) {
      return c.json({ error: 'Email not found' }, 404);
    }
    if (existingUser.role === 'superadmin') {
      return c.json({ error: 'Superadmin password cannot be reset via email code' }, 400);
    }
  }

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const identifier = `email_code:${type}:${email}`;
  
  // Save verification record
  await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
  await db.insert(schema.verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: code,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Send email via Resend API
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Jotify Mailer <onboarding@resend.dev>',
        to: [email],
        subject: `[Jotify] Verification Code: ${code}`,
        text: `Your verification code is: ${code}. It expires in 10 minutes.`,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend error:', errText);
      return c.json({ error: 'Failed to send verification email' }, 500);
    }
  } catch (err: any) {
    console.error('Failed to send email:', err);
    return c.json({ error: 'Failed to send verification email' }, 500);
  }

  return c.json({ success: true, message: 'Verification code sent' });
});

// Register account
app.post('/api/public/register', async (c) => {
  const { email, password, name, code } = await c.req.json();
  if (!email || !password || !name || !code) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const allowRegister = c.env.ALLOW_REGISTER !== 'false';
  if (!allowRegister) {
    return c.json({ error: 'Registration is closed' }, 400);
  }

  const db = getDb(c.env.DB);
  const identifier = `email_code:register:${email}`;
  const record = await db.select().from(schema.verification)
    .where(and(eq(schema.verification.identifier, identifier), eq(schema.verification.value, code)))
    .then(r => r[0]);

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  // Create user using Better Auth internal api
  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    const result = await auth.api.signUpEmail({
      body: { email, password, name }
    });

    if (result?.user) {
      const requireApproval = c.env.REQUIRE_APPROVAL === 'true';
      await db.update(schema.user)
        .set({
          role: 'user',
          status: requireApproval ? 'pending' : 'approved',
          emailVerified: true,
        })
        .where(eq(schema.user.id, result.user.id));
      
      await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
      return c.json({ success: true, message: requireApproval ? 'Register success. Pending admin approval.' : 'Register success. Please login.' });
    }
  } catch (err: any) {
    return c.json({ error: err.message || 'Registration failed' }, 400);
  }
});

// Reset Password
app.post('/api/public/reset-password', async (c) => {
  const { email, password, code } = await c.req.json();
  if (!email || !password || !code) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  const identifier = `email_code:reset:${email}`;
  const record = await db.select().from(schema.verification)
    .where(and(eq(schema.verification.identifier, identifier), eq(schema.verification.value, code)))
    .then(r => r[0]);

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  const targetUser = await db.select().from(schema.user).where(eq(schema.user.email, email)).then(r => r[0]);
  if (!targetUser || targetUser.role === 'superadmin') {
    return c.json({ error: 'Invalid operation' }, 400);
  }

  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    // Overwrite password
    const hashedPassword = await hashPassword(password);
    await db.update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, targetUser.id));

    await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
    return c.json({ success: true, message: 'Password reset success' });
  } catch (err: any) {
    return c.json({ error: err.message || 'Reset password failed' }, 500);
  }
});

// Get public config
app.get('/api/public/config', async (c) => {
  return c.json({
    allowRegister: c.env.ALLOW_REGISTER !== 'false',
    requireApproval: c.env.REQUIRE_APPROVAL === 'true',
    maxDomainsPerUser: parseInt(c.env.MAX_DOMAINS_PER_USER || '1'),
  });
});

// ── Private / Authenticated API routes ───────────────────────────────────────

// Get User Profile details
app.get('/api/user/me', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ session: session.session, user: session.dbUser });
});

// Change Password (for Superadmin or approved users)
app.post('/api/user/change-password', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { newPassword } = await c.req.json();
  if (!newPassword || newPassword.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    const hashedPassword = await hashPassword(newPassword);
    await db.update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, session.dbUser.id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Inbound Domains CRUD ─────────────────────────────────────────────────────

app.get('/api/domains', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.domains).where(eq(schema.domains.userId, session.dbUser.id));
  return c.json({ domains: list });
});

app.post('/api/domains', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { domain } = await c.req.json();
  const cleanDomain = domain?.trim().toLowerCase();
  if (!cleanDomain || !cleanDomain.includes('.')) {
    return c.json({ error: 'Invalid domain name' }, 400);
  }

  const db = getDb(c.env.DB);

  // Check limits
  if (session.dbUser.role !== 'superadmin') {
    const maxDomains = parseInt(c.env.MAX_DOMAINS_PER_USER || '1');
    const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.domains)
      .where(eq(schema.domains.userId, session.dbUser.id))
      .then(r => r[0]?.count || 0);

    if (currentCount >= maxDomains) {
      return c.json({ error: `You have reached the maximum inbound domains limit of ${maxDomains}` }, 400);
    }
  }

  try {
    await db.insert(schema.domains).values({
      userId: session.dbUser.id,
      domain: cleanDomain,
      createdAt: new Date(),
    });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Domain already exists or is configured elsewhere' }, 400);
  }
});

app.delete('/api/domains/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);
  
  await db.delete(schema.domains).where(
    and(eq(schema.domains.id, id), eq(schema.domains.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

// ── Forwarding Destinations CRUD ─────────────────────────────────────────────

app.get('/api/destinations', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.destinations).where(eq(schema.destinations.userId, session.dbUser.id));
  return c.json({ destinations: list });
});

app.post('/api/destinations', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { email } = await c.req.json();
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  const db = getDb(c.env.DB);
  await db.insert(schema.destinations).values({
    userId: session.dbUser.id,
    email: cleanEmail,
    createdAt: new Date(),
  });
  return c.json({ success: true });
});

app.delete('/api/destinations/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);
  
  await db.delete(schema.destinations).where(
    and(eq(schema.destinations.id, id), eq(schema.destinations.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

// ── Forwarding Rules CRUD ────────────────────────────────────────────────────

app.get('/api/forward-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.forwardRules).where(eq(schema.forwardRules.userId, session.dbUser.id));
  return c.json({ rules: list });
});

app.post('/api/forward-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { usernamePattern, subdomain, domainId, destinationId } = await c.req.json();
  if (!usernamePattern || !domainId || !destinationId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  // Verify domain and destination belong to user
  const ownDomain = await db.select().from(schema.domains)
    .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
    .then(r => r[0]);
  const ownDest = await db.select().from(schema.destinations)
    .where(and(eq(schema.destinations.id, destinationId), eq(schema.destinations.userId, session.dbUser.id)))
    .then(r => r[0]);

  if (!ownDomain || !ownDest) {
    return c.json({ error: 'Invalid domain or destination' }, 400);
  }

  // Validate regex pattern
  try {
    new RegExp(usernamePattern);
  } catch {
    return c.json({ error: 'Invalid regex username pattern' }, 400);
  }

  await db.insert(schema.forwardRules).values({
    userId: session.dbUser.id,
    usernamePattern,
    subdomain: subdomain?.trim().toLowerCase() || null,
    domainId,
    destinationId,
    createdAt: new Date(),
  });
  return c.json({ success: true });
});

app.delete('/api/forward-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.forwardRules).where(
    and(eq(schema.forwardRules.id, id), eq(schema.forwardRules.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

// ── Webhooks CRUD ────────────────────────────────────────────────────────────

app.get('/api/webhooks', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.webhooks).where(eq(schema.webhooks.userId, session.dbUser.id));
  return c.json({ webhooks: list });
});

app.post('/api/webhooks', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { name, url, authType, authToken } = await c.req.json();
  if (!name || !url) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  await db.insert(schema.webhooks).values({
    userId: session.dbUser.id,
    name,
    url,
    authType: authType || 'none',
    authToken: authToken || null,
    createdAt: new Date(),
  });
  return c.json({ success: true });
});

app.delete('/api/webhooks/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.webhooks).where(
    and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

// ── Webhook Rules CRUD ────────────────────────────────────────────────────────

app.get('/api/webhook-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.webhookRules).where(eq(schema.webhookRules.userId, session.dbUser.id));
  return c.json({ rules: list });
});

app.post('/api/webhook-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { usernamePattern, subdomain, domainId, webhookId } = await c.req.json();
  if (!usernamePattern || !domainId || !webhookId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  // Verify domain and webhook belong to user
  const ownDomain = await db.select().from(schema.domains)
    .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
    .then(r => r[0]);
  const ownWebhook = await db.select().from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, webhookId), eq(schema.webhooks.userId, session.dbUser.id)))
    .then(r => r[0]);

  if (!ownDomain || !ownWebhook) {
    return c.json({ error: 'Invalid domain or webhook' }, 400);
  }

  // Validate regex pattern
  try {
    new RegExp(usernamePattern);
  } catch {
    return c.json({ error: 'Invalid regex username pattern' }, 400);
  }

  await db.insert(schema.webhookRules).values({
    userId: session.dbUser.id,
    usernamePattern,
    subdomain: subdomain?.trim().toLowerCase() || null,
    domainId,
    webhookId,
    createdAt: new Date(),
  });
  return c.json({ success: true });
});

app.delete('/api/webhook-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.webhookRules).where(
    and(eq(schema.webhookRules.id, id), eq(schema.webhookRules.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

// ── Admin Endpoints ──────────────────────────────────────────────────────────

// List users for audit/approve
app.get('/api/admin/users', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env.DB);
  const list = await db.select({
    id: schema.user.id,
    name: schema.user.name,
    email: schema.user.email,
    role: schema.user.role,
    status: schema.user.status,
    createdAt: schema.user.createdAt,
  }).from(schema.user)
  .where(or(eq(schema.user.role, 'user'), eq(schema.user.role, 'admin')));

  return c.json({ users: list });
});

// Approve user registration
app.post('/api/admin/users/:id/approve', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  await db.update(schema.user)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(schema.user.id, targetId));

  return c.json({ success: true });
});

// Reject user registration
app.post('/api/admin/users/:id/reject', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  await db.update(schema.user)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(schema.user.id, targetId));

  return c.json({ success: true });
});

// ── Superadmin Endpoints ─────────────────────────────────────────────────────

// Add admins
app.post('/api/admin/add-admin', async (c) => {
  const session = await getSessionUser(c);
  if (!session || session.dbUser.role !== 'superadmin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    const result = await auth.api.signUpEmail({
      body: { email, password, name }
    });

    if (result?.user) {
      await db.update(schema.user)
        .set({ role: 'admin', status: 'approved', emailVerified: true })
        .where(eq(schema.user.id, result.user.id));
      return c.json({ success: true });
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Delete user or admin
app.delete('/api/admin/users/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session || session.dbUser.role !== 'superadmin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  // Can delete admins and users, but not superadmin
  const target = await db.select().from(schema.user).where(eq(schema.user.id, targetId)).then(r => r[0]);
  if (!target || target.role === 'superadmin') {
    return c.json({ error: 'Cannot delete superadmin' }, 400);
  }

  await db.delete(schema.user).where(eq(schema.user.id, targetId));
  return c.json({ success: true });
});

// ── Inbound Email Forwarding / Ingestion Trigger Logic ───────────────────────

async function forwardRawMimeToJotify(message: any, env: Bindings): Promise<void> {
  const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
  const targetUrl = `${env.JOTIFY_API_URL}/api/inbound/email`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Inbound-Token': env.INBOUND_API_TOKEN,
      },
      body: rawEmail,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Jotify API returned ${res.status}: ${errBody}`);
    }

    console.log(`[Email Worker] Inbound email successfully ingested by Jotify API.`);
  } catch (err) {
    console.error(`[Email Worker] Failed to forward raw email to Jotify API:`, err);
    throw err;
  }
}

async function streamToArrayBuffer(stream: ReadableStream, size: number): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const result = new Uint8Array(size);
  let offset = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.set(value, offset);
    offset += value.length;
  }

  return result.buffer;
}

// ── Export Unified Cloudflare Worker Handlers ────────────────────────────────

export default {
  // HTTP / API handler
  fetch: app.fetch,

  // Cloudflare Email Routing Trigger handler
  async email(message: any, env: Bindings, ctx: ExecutionContext): Promise<void> {
    const to = message.to.toLowerCase().trim();
    const from = message.from.toLowerCase().trim();
    console.log(`[Email Worker] Inbound email: from=${from} to=${to}`);

    const db = getDb(env.DB);
    const parsedDomain = to.split('@')[1];
    if (!parsedDomain) {
      message.setReject('Address not allowed');
      return;
    }

    // 1. Verify if domain is registered
    const registeredDomains = await db.select().from(schema.domains);
    const domainMatched = registeredDomains.find(d => parsedDomain === d.domain || parsedDomain.endsWith('.' + d.domain));
    if (!domainMatched) {
      console.warn(`[Email Worker] Domain ${parsedDomain} not registered inside system settings. Rejecting.`);
      message.setReject('Domain not registered');
      return;
    }

    const username = to.split('@')[0];

    // 2. Random email ingestion check: starts with "jot_"
    if (username.startsWith('jot_')) {
      console.log(`[Email Worker] Random email prefix matched! Forwarding raw MIME to Jotify VPS...`);
      await forwardRawMimeToJotify(message, env);
      return;
    }

    // 3. Match forwarding rules (regex)
    const allForwardRules = await db.select({
      rule: schema.forwardRules,
      domain: schema.domains.domain,
      destination: schema.destinations.email,
    })
    .from(schema.forwardRules)
    .innerJoin(schema.domains, eq(schema.forwardRules.domainId, schema.domains.id))
    .innerJoin(schema.destinations, eq(schema.forwardRules.destinationId, schema.destinations.id))
    .where(eq(schema.forwardRules.userId, domainMatched.userId))
    ;

    let ruleMatched = false;
    for (const r of allForwardRules) {
      if (parsedDomain !== r.domain && !parsedDomain.endsWith('.' + r.domain)) continue;
      if (r.rule.subdomain) {
        const expectedSub = parsedDomain.replace('.' + r.domain, '');
        if (expectedSub !== r.rule.subdomain) continue;
      }
      try {
        const regex = new RegExp(`^${r.rule.usernamePattern}$`, 'i');
        if (regex.test(username)) {
          console.log(`[Email Worker] Match forwarding rule! Forwarding to: ${r.destination}`);
          await message.forward(r.destination);
          ruleMatched = true;
        }
      } catch (err) {
        console.error(`[Email Worker] Invalid regex pattern: ${r.rule.usernamePattern}`, err);
      }
    }

    // 4. Match webhook rules (regex)
    const allWebhookRules = await db.select({
      rule: schema.webhookRules,
      domain: schema.domains.domain,
      webhook: schema.webhooks,
    })
    .from(schema.webhookRules)
    .innerJoin(schema.domains, eq(schema.webhookRules.domainId, schema.domains.id))
    .innerJoin(schema.webhooks, eq(schema.webhookRules.webhookId, schema.webhooks.id))
    .where(eq(schema.webhookRules.userId, domainMatched.userId))
    ;

    let webhookMatched = false;
    let rawEmail: ArrayBuffer | null = null;

    for (const w of allWebhookRules) {
      if (parsedDomain !== w.domain && !parsedDomain.endsWith('.' + w.domain)) continue;
      if (w.rule.subdomain) {
        const expectedSub = parsedDomain.replace('.' + w.domain, '');
        if (expectedSub !== w.rule.subdomain) continue;
      }
      try {
        const regex = new RegExp(`^${w.rule.usernamePattern}$`, 'i');
        if (regex.test(username)) {
          console.log(`[Email Worker] Match webhook rule! Triggering HTTP POST to: ${w.webhook.url}`);
          
          if (!rawEmail) {
            rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
          }

          const parser = new PostalMime();
          const parsed = await parser.parse(rawEmail);
          const subject = parsed.subject || '';
          const text = parsed.text || parsed.html?.replace(/<[^>]+>/g, '') || '';

          const payload = {
            to: to,
            from: from,
            subject,
            text,
            rawSize: message.rawSize,
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (w.webhook.authType === 'bearer' && w.webhook.authToken) {
            headers['Authorization'] = `Bearer ${w.webhook.authToken}`;
          } else if (w.webhook.authType === 'header' && w.webhook.authToken) {
            const parts = w.webhook.authToken.split(':');
            if (parts.length === 2) {
              headers[parts[0].trim()] = parts[1].trim();
            } else {
              headers['X-Webhook-Token'] = w.webhook.authToken;
            }
          }

          ctx.waitUntil(
            fetch(w.webhook.url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            })
            .then(res => {
              console.log(`[Email Worker] Webhook response status: ${res.status}`);
            })
            .catch(err => {
              console.error(`[Email Worker] Webhook call failed:`, err);
            })
          );

          webhookMatched = true;
        }
      } catch (err) {
        console.error(`[Email Worker] Invalid regex pattern: ${w.rule.usernamePattern}`, err);
      }
    }

    if (ruleMatched || webhookMatched) {
      return;
    }

    console.warn(`[Email Worker] No rule matched for ${to}, rejecting.`);
    message.setReject('Address not allowed');
  }
};
