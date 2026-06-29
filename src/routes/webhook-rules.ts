import { Hono } from 'hono';
import { eq, and, sql, isNull } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser, validateRegexPattern } from '../utils';

const routes = new Hono<Env>();

routes.get('/api/webhook-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const list = await db.select().from(schema.webhookRules).where(eq(schema.webhookRules.userId, session.dbUser.id));
  return c.json({ rules: list });
});

routes.post('/api/webhook-rules', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { usernamePattern, subdomain, domainId, webhookId } = await c.req.json();
  if (!usernamePattern || !domainId || !webhookId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const regexErr = validateRegexPattern(usernamePattern);
  if (regexErr) return c.json({ error: regexErr }, 400);

  const db = getDb(c.env.DB);
  const [ownDomain, ownWebhook] = await Promise.all([
    db.select().from(schema.domains)
      .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
      .then(r => r[0]),
    db.select().from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, webhookId), eq(schema.webhooks.userId, session.dbUser.id)))
      .then(r => r[0]),
  ]);

  if (!ownDomain || !ownWebhook) {
    return c.json({ error: 'Invalid domain or webhook' }, 400);
  }

  const cleanSubdomain = subdomain?.trim().toLowerCase() || null;
  const existingRules = await db.select()
    .from(schema.webhookRules)
    .where(
      and(
        eq(schema.webhookRules.userId, session.dbUser.id),
        eq(schema.webhookRules.domainId, domainId),
        cleanSubdomain ? eq(schema.webhookRules.subdomain, cleanSubdomain) : isNull(schema.webhookRules.subdomain),
        eq(schema.webhookRules.usernamePattern, usernamePattern)
      )
    );

  if (existingRules.length >= 2) {
    return c.json({ error: '每个收信地址最多只能关联两个不同的 Webhook 接口' }, 400);
  }

  await db.insert(schema.webhookRules).values({
    userId: session.dbUser.id,
    usernamePattern,
    subdomain: cleanSubdomain,
    domainId,
    webhookId,
    createdAt: new Date(),
  });
  return c.json({ success: true });
});

routes.delete('/api/webhook-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const db = getDb(c.env.DB);

  await db.delete(schema.webhookRules).where(
    and(eq(schema.webhookRules.id, id), eq(schema.webhookRules.userId, session.dbUser.id))
  );
  return c.json({ success: true });
});

routes.put('/api/webhook-rules/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'));
  const { usernamePattern, subdomain, domainId, webhookId } = await c.req.json();
  if (!usernamePattern || !domainId || !webhookId) {
    return c.json({ error: 'Missing parameters' }, 400);
  }

  const regexErr = validateRegexPattern(usernamePattern);
  if (regexErr) return c.json({ error: regexErr }, 400);

  const db = getDb(c.env.DB);
  const [ownDomain, ownWebhook] = await Promise.all([
    db.select().from(schema.domains)
      .where(and(eq(schema.domains.id, domainId), eq(schema.domains.userId, session.dbUser.id)))
      .then(r => r[0]),
    db.select().from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, webhookId), eq(schema.webhooks.userId, session.dbUser.id)))
      .then(r => r[0]),
  ]);

  if (!ownDomain || !ownWebhook) {
    return c.json({ error: 'Invalid domain or webhook' }, 400);
  }

  const cleanSubdomain = subdomain?.trim().toLowerCase() || null;
  const existingRules = await db.select()
    .from(schema.webhookRules)
    .where(
      and(
        eq(schema.webhookRules.userId, session.dbUser.id),
        eq(schema.webhookRules.domainId, domainId),
        cleanSubdomain ? eq(schema.webhookRules.subdomain, cleanSubdomain) : isNull(schema.webhookRules.subdomain),
        eq(schema.webhookRules.usernamePattern, usernamePattern),
        sql`${schema.webhookRules.id} != ${id}`
      )
    );

  if (existingRules.length >= 2) {
    return c.json({ error: '每个收信地址最多只能关联两个不同的 Webhook 接口' }, 400);
  }

  await db.update(schema.webhookRules)
    .set({
      usernamePattern,
      subdomain: cleanSubdomain,
      domainId,
      webhookId,
    })
    .where(and(eq(schema.webhookRules.id, id), eq(schema.webhookRules.userId, session.dbUser.id)));

  return c.json({ success: true });
});

export default routes;
