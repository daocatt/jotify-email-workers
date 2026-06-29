import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/domains', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.domains).where(eq(schema.domains.userId, session.dbUser.id));
  return c.json({ domains: list });
});

routes.post('/api/domains', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { domain } = await c.req.json();
  const cleanDomain = domain?.trim().toLowerCase();
  if (!cleanDomain || !cleanDomain.includes('.')) {
    return c.json({ error: 'Invalid domain name' }, 400);
  }

  const db = getDb(c.env.DB);

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

routes.delete('/api/domains/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);
  
  await db.delete(schema.domains).where(
    and(eq(schema.domains.id, id), eq(schema.domains.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

export default routes;
