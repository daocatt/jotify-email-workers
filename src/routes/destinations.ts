import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/destinations', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.destinations).where(eq(schema.destinations.userId, session.dbUser.id));
  return c.json({ destinations: list });
});

routes.post('/api/destinations', async (c) => {
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

routes.delete('/api/destinations/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);
  
  await db.delete(schema.destinations).where(
    and(eq(schema.destinations.id, id), eq(schema.destinations.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

export default routes;
