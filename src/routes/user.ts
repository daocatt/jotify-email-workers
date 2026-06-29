import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { getAuth } from '../auth';
import { Env, getSessionUser } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/user/me', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ session: session.session, user: session.dbUser });
});

routes.post('/api/user/change-password', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { oldPassword, newPassword } = await c.req.json();
  if (!oldPassword) {
    return c.json({ error: 'Current password is required' }, 400);
  }
  if (!newPassword || newPassword.length < 6) {
    return c.json({ error: 'New password must be at least 6 characters' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const auth = getAuth(c.env.DB, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
    const signInResult = await auth.api.signInEmail({
      body: { email: session.dbUser.email, password: oldPassword },
    });
    if (!signInResult?.user) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }
    const hashedPassword = await hashPassword(newPassword);
    await db.update(schema.account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.account.userId, session.dbUser.id));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }
});

export default routes;
