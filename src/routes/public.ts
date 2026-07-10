import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { getAuth } from '../auth';
import { hashPassword } from 'better-auth/crypto';
import { Env, verifyTurnstile, validateEmail, validatePasswordStrength } from '../utils';

const routes = new Hono<Env>();

const MAX_CODE_ATTEMPTS = 5;

routes.post('/api/public/send-code', async (c) => {
  const { email, type } = await c.req.json();
  if (!email || !validateEmail(email)) return c.json({ error: 'Valid email is required' }, 400);
  if (type !== 'register' && type !== 'reset') return c.json({ error: 'Invalid type' }, 400);

  const db = getDb(c.env.DB);
  const identifier = `email_code:${type}:${email.toLowerCase().trim()}`;

  const existingCode = await db.select().from(schema.verification)
    .where(eq(schema.verification.identifier, identifier))
    .then(r => r[0]);

  if (existingCode && existingCode.createdAt) {
    const elapsed = Date.now() - new Date(existingCode.createdAt).getTime();
    if (elapsed < 60 * 1000) {
      return c.json({ error: '请等待 60 秒后再重新获取验证码' }, 429);
    }
  }

  const existingUser = await db.select().from(schema.user).where(eq(schema.user.email, email.toLowerCase().trim())).then(r => r[0]);

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

  const codeBuffer = new Uint8Array(4);
  crypto.getRandomValues(codeBuffer);
  const code = (codeBuffer[0] % 10).toString() + (codeBuffer[1] % 10).toString() + (codeBuffer[2] % 10).toString() + (codeBuffer[3] % 10).toString() + (Date.now() % 10).toString() + ((Date.now() >>> 4) % 10).toString();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
  await db.insert(schema.verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: code,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    const fromName = c.env.RESEND_FROM_NAME || 'Jotify Mailer';
    const fromEmail = c.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const resendIdempotencyKey = `jotify/code/${email}/${Date.now()}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': resendIdempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: `[Jotify] Verification Code: ${code}`,
        text: `Your verification code is: ${code}. It expires in 3 minutes.`,
      }),
    });
    if (!res.ok) {
      console.error('Resend error: status=', res.status);
      return c.json({ error: 'Failed to send verification email' }, 500);
    }
  } catch {
    return c.json({ error: 'Failed to send verification email' }, 500);
  }

  return c.json({ success: true, message: 'Verification code sent' });
});

routes.post('/api/public/register', async (c) => {
  const body = await c.req.json();
  const { email, password, name, code, turnstileToken } = body;
  if (c.env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY);
    if (!ok) {
      return c.json({ error: 'Turnstile 验证失败' }, 400);
    }
  }
  if (!email || !password || !name || !code) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  if (!validateEmail(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }
  const pwdErr = validatePasswordStrength(password);
  if (pwdErr) {
    return c.json({ error: pwdErr }, 400);
  }

  const allowRegister = c.env.ALLOW_REGISTER !== 'false';
  if (!allowRegister) {
    return c.json({ error: 'Registration is closed' }, 400);
  }

  const db = getDb(c.env.DB);
  const identifier = `email_code:register:${email.toLowerCase().trim()}`;
  const record = await db.select().from(schema.verification)
    .where(and(eq(schema.verification.identifier, identifier), eq(schema.verification.value, code)))
    .then(r => r[0]);

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

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
  } catch {
    return c.json({ error: 'Registration failed' }, 400);
  }
});

routes.post('/api/public/verify-code', async (c) => {
  const { email, code, type } = await c.req.json();
  if (!email || !code || !type) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const db = getDb(c.env.DB);
  const identifier = `email_code:${type}:${email.toLowerCase().trim()}`;
  const record = await db.select().from(schema.verification)
    .where(eq(schema.verification.identifier, identifier))
    .then(r => r[0]);

  if (!record) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  if (record.value !== code) {
    const attemptsKey = `code_attempts:${identifier}`;
    const attemptsResult = await c.env.DB.prepare(
      'SELECT value FROM verification WHERE identifier = ?'
    ).bind(attemptsKey).first() as any;
    const attempts = (attemptsResult?.value ? parseInt(attemptsResult.value) : 0) + 1;

    if (attempts >= MAX_CODE_ATTEMPTS) {
      await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
      await c.env.DB.prepare('DELETE FROM verification WHERE identifier = ?').bind(attemptsKey).run();
      return c.json({ error: 'Too many failed attempts. Please request a new code.' }, 400);
    }

    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), attemptsKey, attempts.toString(), record.expiresAt.getTime().toString(), new Date().toISOString(), new Date().toISOString()).run();

    return c.json({ error: 'Invalid verification code' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM verification WHERE identifier = ?').bind(`code_attempts:${identifier}`).run();
  return c.json({ success: true });
});

routes.post('/api/public/reset-password', async (c) => {
  const body = await c.req.json();
  const { email, password, code, turnstileToken } = body;
  if (c.env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY);
    if (!ok) {
      return c.json({ error: 'Turnstile 验证失败' }, 400);
    }
  }
  if (!email || !password || !code) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  const pwdErr = validatePasswordStrength(password);
  if (pwdErr) {
    return c.json({ error: pwdErr }, 400);
  }

  const db = getDb(c.env.DB);
  const identifier = `email_code:reset:${email.toLowerCase().trim()}`;
  const record = await db.select().from(schema.verification)
    .where(and(eq(schema.verification.identifier, identifier), eq(schema.verification.value, code)))
    .then(r => r[0]);

  if (!record || record.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
  }

  const targetUser = await db.select().from(schema.user).where(eq(schema.user.email, email.toLowerCase().trim())).then(r => r[0]);
  if (!targetUser || targetUser.role === 'superadmin') {
    return c.json({ error: 'Invalid operation' }, 400);
  }

  try {
    const hashedPassword = await hashPassword(password);
    await db.update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, targetUser.id));

    await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
    return c.json({ success: true, message: 'Password reset success' });
  } catch {
    return c.json({ error: 'Reset password failed' }, 500);
  }
});

routes.get('/api/public/config', async (c) => {
  return c.json({
    allowRegister: c.env.ALLOW_REGISTER !== 'false',
    requireApproval: c.env.REQUIRE_APPROVAL === 'true',
    maxDomainsPerUser: parseInt(c.env.MAX_DOMAINS_PER_USER || '1'),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
  });
});

export default routes;
