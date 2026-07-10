import { Hono } from 'hono';
import { eq, or } from 'drizzle-orm';
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

  const db = getDb(c.env.DB);
  if (session.dbUser.role === 'superadmin') {
    const list = await db.select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      status: schema.user.status,
      mustChangePassword: schema.user.mustChangePassword,
      createdAt: schema.user.createdAt,
    }).from(schema.user)
    .where(or(eq(schema.user.role, 'user'), eq(schema.user.role, 'admin')));

    return c.json({ users: list });
  } else {
    const list = await db.select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      status: schema.user.status,
      createdAt: schema.user.createdAt,
    }).from(schema.user)
    .where(eq(schema.user.role, 'user'));

    return c.json({ users: list });
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
