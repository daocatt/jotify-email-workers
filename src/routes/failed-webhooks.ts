import { Hono } from 'hono';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDb } from '../db';
import { Env, getSessionUser, buildWebhookHeaders } from '../utils';
import { RetryMessage } from '../retry';

const routes = new Hono<Env>();

const PER_PAGE = 20;

routes.get('/api/failed-webhooks', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const db = getDb(c.env.DB);
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const search = (c.req.query('search') || '').trim().toLowerCase();

  const base = eq(schema.failedWebhooks.userId, session.dbUser.id);
  const where = search
    ? and(base, or(
        sql`lower(${schema.failedWebhooks.url}) LIKE ${'%' + search + '%'}`,
        sql`lower(${schema.failedWebhooks.deliveryId}) LIKE ${'%' + search + '%'}`
      ))
    : base;

  const total = await db.select({ count: sql<number>`count(*)` }).from(schema.failedWebhooks)
    .where(where).then(r => r[0]?.count || 0);

  const failures = await db.select({
    id: schema.failedWebhooks.id,
    webhookId: schema.failedWebhooks.webhookId,
    webhookName: schema.webhooks.name,
    url: schema.failedWebhooks.url,
    deliveryId: schema.failedWebhooks.deliveryId,
    attempts: schema.failedWebhooks.attempts,
    createdAt: schema.failedWebhooks.createdAt,
  }).from(schema.failedWebhooks)
    .leftJoin(schema.webhooks, eq(schema.failedWebhooks.webhookId, schema.webhooks.id))
    .where(where)
    .orderBy(desc(schema.failedWebhooks.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);

  return c.json({ failures, total, page });
});

routes.post('/api/failed-webhooks/:id/retry', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  const db = getDb(c.env.DB);
  const rec = await db.select().from(schema.failedWebhooks)
    .where(and(eq(schema.failedWebhooks.id, id), eq(schema.failedWebhooks.userId, session.dbUser.id)))
    .then(r => r[0]);
  if (!rec) return c.json({ error: 'Record not found' }, 404);

  const webhook = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, rec.webhookId)).then(r => r[0]);
  if (!webhook) return c.json({ error: 'Webhook has been deleted' }, 400);

  let payload: unknown;
  try {
    payload = JSON.parse(rec.payload);
  } catch {
    return c.json({ error: 'Stored payload is corrupted' }, 400);
  }

  const deliveryId = ((payload as any)?.delivery_id) || `retry/${rec.id}/${Date.now()}`;
  const headers = await buildWebhookHeaders(webhook, payload, c.env);
  const retryMsg: RetryMessage = {
    kind: 'webhook',
    idempotencyKey: deliveryId,
    payload: { url: webhook.url, headers, body: payload },
  };

  try {
    await c.env.RETRY_QUEUE.send(retryMsg);
  } catch (err: any) {
    return c.json({ error: 'Failed to enqueue retry: ' + (err?.message || 'unknown') }, 500);
  }

  await db.delete(schema.failedWebhooks).where(eq(schema.failedWebhooks.id, id));
  return c.json({ success: true });
});

routes.delete('/api/failed-webhooks/:id', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const id = parseInt(c.req.param('id'), 10);
  const db = getDb(c.env.DB);
  await db.delete(schema.failedWebhooks)
    .where(and(eq(schema.failedWebhooks.id, id), eq(schema.failedWebhooks.userId, session.dbUser.id)));
  return c.json({ success: true });
});

export default routes;
