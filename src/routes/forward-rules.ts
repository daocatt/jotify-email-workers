import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser, validateRegexPattern } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/forward-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.forwardRules).where(eq(schema.forwardRules.userId, session.dbUser.id));
  return c.json({ rules: list });
});

routes.post('/api/forward-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { usernamePattern, subdomain, domainId, destinationId } = await c.req.json();
  if (!usernamePattern || !domainId || !destinationId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const regexErr = validateRegexPattern(usernamePattern);
  if (regexErr) return c.json({ error: regexErr }, 400);

  const db = getDb(c.env.DB);
  const [ownDomain, ownDest] = await Promise.all([
    db.select().from(schema.domains)
      .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
      .then(r => r[0]),
    db.select().from(schema.destinations)
      .where(and(eq(schema.destinations.id, destinationId), eq(schema.destinations.userId, session.dbUser.id)))
      .then(r => r[0]),
  ]);

  if (!ownDomain || !ownDest) {
    return c.json({ error: 'Invalid domain or destination' }, 400);
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

routes.delete('/api/forward-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.forwardRules).where(
    and(eq(schema.forwardRules.id, id), eq(schema.forwardRules.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

routes.put('/api/forward-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const { usernamePattern, subdomain, domainId, destinationId } = await c.req.json();
  if (!usernamePattern || !domainId || !destinationId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const regexErr = validateRegexPattern(usernamePattern);
  if (regexErr) return c.json({ error: regexErr }, 400);

  const db = getDb(c.env.DB);
  const [ownDomain, ownDest] = await Promise.all([
    db.select().from(schema.domains)
      .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
      .then(r => r[0]),
    db.select().from(schema.destinations)
      .where(and(eq(schema.destinations.id, destinationId), eq(schema.destinations.userId, session.dbUser.id)))
      .then(r => r[0]),
  ]);

  if (!ownDomain || !ownDest) {
    return c.json({ error: 'Invalid domain or destination' }, 400);
  }

  await db.update(schema.forwardRules)
    .set({
      usernamePattern,
      subdomain: subdomain?.trim().toLowerCase() || null,
      domainId,
      destinationId,
    })
    .where(and(eq(schema.forwardRules.id, id), eq(schema.forwardRules.userId, session.dbUser.id)));

  return c.json({ success: true });
});

export default routes;
