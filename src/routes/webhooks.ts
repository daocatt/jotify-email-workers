import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser, validateWebhookUrl } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/webhooks', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.webhooks).where(eq(schema.webhooks.userId, session.dbUser.id));
  return c.json({ webhooks: list });
});

routes.post('/api/webhooks', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { name, url, authType, authToken } = await c.req.json();
  if (!name || !url) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  const urlErr = validateWebhookUrl(url);
  if (urlErr) return c.json({ error: urlErr }, 400);

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

routes.delete('/api/webhooks/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.webhooks).where(
    and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

routes.put('/api/webhooks/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const { name, url, authType, authToken } = await c.req.json();
  if (!name || !url) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  const urlErr = validateWebhookUrl(url);
  if (urlErr) return c.json({ error: urlErr }, 400);

  const db = getDb(c.env.DB);
  await db.update(schema.webhooks)
    .set({
      name,
      url,
      authType: authType || 'none',
      authToken: authToken || null,
    })
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, session.dbUser.id)));

  return c.json({ success: true });
});

export default routes;
