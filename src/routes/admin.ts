import { Hono } from 'hono';
import { eq, or, and, sql, desc } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { getAuth } from '../auth';
import { Env, getSessionUser, validatePasswordStrength, maskEmail } from '../utils';

const routes = new Hono<Env>();

async function writeAuditLog(db: ReturnType<typeof getDb>, actor: { id: string; role: string; email: string }, action: string, target: { id?: string; email?: string } | null, detail: string | null, ip: string | null) {
  try {
    await db.insert(schema.auditLog).values({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId: target?.id || null,
      targetEmail: target?.email || null,
      detail,
      ip,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err);
  }
}

routes.get('/api/admin/users', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const search = (c.req.query('search') || '').trim().toLowerCase();
  const perPage = 20;

  const db = getDb(c.env.DB);
  const searchFilter = search
    ? or(
        sql`lower(${schema.user.name}) LIKE ${'%' + search + '%'}`,
        sql`lower(${schema.user.email}) LIKE ${'%' + search + '%'}`
      )
    : undefined;

  const base = {
    id: schema.user.id,
    name: schema.user.name,
    email: schema.user.email,
    role: schema.user.role,
    status: schema.user.status,
    createdAt: schema.user.createdAt,
  };

  if (session.dbUser.role === 'superadmin') {
    const where = and(
      or(eq(schema.user.role, 'user'), eq(schema.user.role, 'admin')),
      ...(searchFilter ? [searchFilter] : []),
    );
    const total = await db.select({ count: sql<number>`count(*)` }).from(schema.user)
      .where(where).then(r => r[0]?.count || 0);
    const list = await db.select({ ...base, mustChangePassword: schema.user.mustChangePassword }).from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    return c.json({ users: list, total, page });
  } else {
    const where = and(
      eq(schema.user.role, 'user'),
      ...(searchFilter ? [searchFilter] : []),
    );
    const total = await db.select({ count: sql<number>`count(*)` }).from(schema.user)
      .where(where).then(r => r[0]?.count || 0);
    const list = await db.select(base).from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    return c.json({ users: list, total, page });
  }
});

routes.post('/api/admin/users/:id/approve', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  const target = await db.select().from(schema.user).where(eq(schema.user.id, targetId)).then(r => r[0]);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (target.role !== 'user') {
    return c.json({ error: 'Can only approve regular users' }, 400);
  }
  if (target.status !== 'pending') {
    return c.json({ error: 'User is not in pending status' }, 400);
  }

  await db.update(schema.user)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(schema.user.id, targetId));

  const ip = c.req.header('cf-connecting-ip') || null;
  await writeAuditLog(db, session.dbUser, 'approve_user', { id: targetId, email: target.email }, null, ip);

  return c.json({ success: true });
});

routes.post('/api/admin/users/:id/reject', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  const target = await db.select().from(schema.user).where(eq(schema.user.id, targetId)).then(r => r[0]);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (target.role !== 'user') {
    return c.json({ error: 'Can only reject regular users' }, 400);
  }
  if (target.status !== 'pending') {
    return c.json({ error: 'User is not in pending status' }, 400);
  }

  await db.update(schema.user)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(schema.user.id, targetId));

  const ip = c.req.header('cf-connecting-ip') || null;
  await writeAuditLog(db, session.dbUser, 'reject_user', { id: targetId, email: target.email }, null, ip);

  return c.json({ success: true });
});

routes.post('/api/admin/add-admin', async (c) => {
  const session = await getSessionUser(c);
  if (!session || session.dbUser.role !== 'superadmin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  const pwdErr = validatePasswordStrength(password);
  if (pwdErr) {
    return c.json({ error: pwdErr }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    const result = await auth.api.signUpEmail({
      body: { email, password, name }
    });

    if (result?.user) {
      await db.update(schema.user)
        .set({ role: 'admin', status: 'approved', emailVerified: true, mustChangePassword: true })
        .where(eq(schema.user.id, result.user.id));
      const ip = c.req.header('cf-connecting-ip') || null;
      await writeAuditLog(db, session.dbUser, 'add_admin', { id: result.user.id, email }, null, ip);
      return c.json({ success: true });
    }
  } catch {
    return c.json({ error: 'Failed to create admin user' }, 400);
  }
});

routes.post('/api/admin/users/:id/reset-password', async (c) => {
  const session = await getSessionUser(c);
  if (!session || (session.dbUser.role !== 'admin' && session.dbUser.role !== 'superadmin')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const { password } = await c.req.json();
  if (!password) {
    return c.json({ error: 'New password is required' }, 400);
  }
  const pwdErr = validatePasswordStrength(password);
  if (pwdErr) {
    return c.json({ error: pwdErr }, 400);
  }

  const db = getDb(c.env.DB);
  const target = await db.select().from(schema.user).where(eq(schema.user.id, targetId)).then(r => r[0]);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }
  if (target.role === 'superadmin') {
    return c.json({ error: 'Cannot reset superadmin password' }, 400);
  }
  if (session.dbUser.role === 'admin' && target.role !== 'user') {
    return c.json({ error: 'Admins can only reset regular user passwords' }, 400);
  }

  try {
    const hashedPassword = await hashPassword(password);
    await db.update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, targetId));
    await db.delete(schema.session).where(eq(schema.session.userId, targetId));
    await db.update(schema.user)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(schema.user.id, targetId));
  } catch {
    return c.json({ error: 'Failed to reset password' }, 500);
  }

  const ip = c.req.header('cf-connecting-ip') || null;
  await writeAuditLog(db, session.dbUser, 'reset_user_password', { id: targetId, email: target.email }, null, ip);

  return c.json({ success: true });
});

routes.delete('/api/admin/users/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session || session.dbUser.role !== 'superadmin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const targetId = c.req.param('id');
  const db = getDb(c.env.DB);

  const target = await db.select().from(schema.user).where(eq(schema.user.id, targetId)).then(r => r[0]);
  if (!target || target.role === 'superadmin') {
    return c.json({ error: 'Cannot delete superadmin' }, 400);
  }

  await db.delete(schema.session).where(eq(schema.session.userId, targetId));
  await db.delete(schema.account).where(eq(schema.account.userId, targetId));
  await db.delete(schema.user).where(eq(schema.user.id, targetId));

  const ip = c.req.header('cf-connecting-ip') || null;
  await writeAuditLog(db, session.dbUser, 'delete_user', { id: targetId, email: target.email }, `role=${target.role}`, ip);

  return c.json({ success: true });
});

export default routes;
