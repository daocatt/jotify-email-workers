import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { getDb } from './db';
import PostalMime from 'postal-mime';
import {
  deliverWebhookWithRetry,
  enqueueRetry,
  backoffSeconds,
  deliverOnce,
  RetryMessage,
} from './retry';
import { Bindings, hashShortKey, maskEmail, validateRegexPattern, safeRegexTest, buildWebhookHeaders, sanitizeWebhookHeaders } from './utils';

async function streamToArrayBuffer(stream: ReadableStream, size: number): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const result = new Uint8Array(size);
  let offset = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.set(value, offset);
    offset += value.length;
  }

  return result.buffer;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function markDeliveryStatus(db: D1Database, key: string, status: string): Promise<void> {
  try {
    await db.prepare('UPDATE delivery_idempotency SET status = ? WHERE idempotency_key = ?')
      .bind(status, key).run();
  } catch {
    console.warn('[Email Worker] Failed to update delivery idempotency status');
  }
}

export async function handleEmail(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext): Promise<void> {
  const to = message.to.toLowerCase().trim();
  const from = message.from.toLowerCase().trim();
  console.log(`[Email Worker] Inbound email: from=${maskEmail(from)} to=${maskEmail(to)}`);

  const db = getDb(env.DB);
  const parsedDomain = to.split('@')[1];
  if (!parsedDomain) {
    message.setReject('Address not allowed');
    return;
  }

  let matchedDomain = await db.select().from(schema.domains)
    .where(eq(schema.domains.domain, parsedDomain))
    .then(r => r[0]);
  if (!matchedDomain) {
    const parentDomain = parsedDomain.split('.').slice(-2).join('.');
    if (parentDomain !== parsedDomain) {
      matchedDomain = await db.select().from(schema.domains)
        .where(eq(schema.domains.domain, parentDomain))
        .then(r => r[0]);
    }
    if (!matchedDomain) {
      console.warn(`[Email Worker] Domain ${parsedDomain} not registered. Rejecting.`);
      message.setReject('Domain not registered');
      return;
    }
  }

  const messageId = message.headers?.get?.('message-id')?.trim() || '';
  const dateHeader = message.headers?.get?.('date')?.trim() || '';
  const dedupKey = messageId
    ? `mid:${messageId}`
    : `h:${await hashShortKey(`${from}|${to}|${dateHeader}`)}`;
  try {
    const inserted = await env.DB.prepare(`
      INSERT OR IGNORE INTO delivery_idempotency (idempotency_key, status, created_at) VALUES (?, 'pending', ?)
    `).bind(dedupKey, new Date().toISOString()).run();
    if (!inserted?.meta?.changes) {
      console.log(`[Email Worker] Duplicate inbound message ${dedupKey}, already processed. Skipping.`);
      return;
    }
  } catch {
    console.warn('[Email Worker] Idempotency check failed. Continuing.');
  }

  const deliveryUuid = crypto.randomUUID();
  const username = to.split('@')[0];

  try {
    const [allForwardRules, allWebhookRules] = await Promise.all([
      db.select({
        rule: schema.forwardRules,
        domain: schema.domains.domain,
        destination: schema.destinations.email,
      })
      .from(schema.forwardRules)
      .innerJoin(schema.domains, eq(schema.forwardRules.domainId, schema.domains.id))
      .innerJoin(schema.destinations, eq(schema.forwardRules.destinationId, schema.destinations.id))
      .where(eq(schema.forwardRules.userId, matchedDomain.userId)),

      db.select({
        rule: schema.webhookRules,
        domain: schema.domains.domain,
        webhook: schema.webhooks,
      })
      .from(schema.webhookRules)
      .innerJoin(schema.domains, eq(schema.webhookRules.domainId, schema.domains.id))
      .innerJoin(schema.webhooks, eq(schema.webhookRules.webhookId, schema.webhooks.id))
      .where(eq(schema.webhookRules.userId, matchedDomain.userId)),
    ]);

    let ruleMatched = false;
    for (const r of allForwardRules) {
      if (parsedDomain !== r.domain && !parsedDomain.endsWith('.' + r.domain)) continue;
      if (r.rule.subdomain) {
        const expectedSub = parsedDomain.replace('.' + r.domain, '');
        if (expectedSub !== r.rule.subdomain) continue;
      }
      const regexErr = validateRegexPattern(r.rule.usernamePattern);
      if (regexErr) {
        console.error(`[Email Worker] Invalid regex pattern in forward rule: ${regexErr}`);
        continue;
      }
      const matched = safeRegexTest(r.rule.usernamePattern, username);
      if (matched) {
        try {
          console.log(`[Email Worker] Match forwarding rule! Forwarding to: ${maskEmail(r.destination)}`);
          await message.forward(r.destination);
          ruleMatched = true;
        } catch (err) {
          console.error(`[Email Worker] Forward failed for ${maskEmail(to)} to ${maskEmail(r.destination)}:`, err);
        }
      }
    }

    let webhookMatched = false;
    let rawEmail: ArrayBuffer | null = null;

    for (const w of allWebhookRules) {
      if (parsedDomain !== w.domain && !parsedDomain.endsWith('.' + w.domain)) continue;
      if (w.rule.subdomain) {
        const expectedSub = parsedDomain.replace('.' + w.domain, '');
        if (expectedSub !== w.rule.subdomain) continue;
      }
      const regexErr = validateRegexPattern(w.rule.usernamePattern);
      if (regexErr) {
        console.error(`[Email Worker] Invalid regex pattern in webhook rule: ${regexErr}`);
        continue;
      }
      const matched = safeRegexTest(w.rule.usernamePattern, username);
      if (!matched) continue;

      try {
        console.log(`[Email Worker] Match webhook rule! Triggering HTTP POST to: ${w.webhook.url.replace(/\/\/[^@]+@/, '//***@')}`);

        if (!rawEmail) {
          rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
        }

        const parser = new PostalMime();
        const parsed = await parser.parse(rawEmail);
        const subject = parsed.subject || '';
        const text = parsed.text || stripHtml(parsed.html || '');

        const attachmentUrls: Array<{ filename: string; mimeType: string; size: number; url: string }> = [];
        if (env.ATTACHMENT_BUCKET && env.R2_PUBLIC_URL && parsed.attachments && parsed.attachments.length > 0) {
          for (const att of parsed.attachments) {
            const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
            const uniqueId = crypto.randomUUID();
            const safeFilename = att.filename ? att.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'unnamed';
            const r2Key = `${dateStr}/${uniqueId}/${safeFilename}`;

            await env.ATTACHMENT_BUCKET.put(r2Key, att.content, {
              httpMetadata: {
                contentType: att.mimeType || 'application/octet-stream',
                contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(att.filename || 'attachment')}`
              }
            });

            let attachmentUrl: string;
            try {
              const signedUrlObj = await (env.ATTACHMENT_BUCKET as any).createSignedUrl(r2Key, 3600);
              if (signedUrlObj) {
                attachmentUrl = signedUrlObj;
              } else {
                console.warn(`[Email Worker] Signed URL not available for ${r2Key}, skipping attachment URL`);
                continue;
              }
            } catch {
              console.warn(`[Email Worker] Failed to create signed URL for ${r2Key}, skipping attachment URL`);
              continue;
            }

            attachmentUrls.push({
              filename: att.filename || 'unnamed',
              mimeType: att.mimeType || 'application/octet-stream',
              size: typeof att.content === 'string' ? att.content.length : (att.content as ArrayBuffer).byteLength,
              url: attachmentUrl
            });
          }
        }

        const webhookIdempotencyKey = `jotify/webhook/${w.webhook.id}/${deliveryUuid}`;
        const payload = {
          to: to,
          from: from,
          subject,
          text,
          rawSize: message.rawSize,
          attachments: attachmentUrls,
          delivery_id: webhookIdempotencyKey,
        };

        const headers = await buildWebhookHeaders(w.webhook, payload, env);

        ctx.waitUntil((async () => {
          const success = await deliverWebhookWithRetry(w.webhook.url, headers, payload, 2, 15000);
          if (!success) {
            try {
              await enqueueRetry(env, {
                kind: 'webhook',
                idempotencyKey: webhookIdempotencyKey,
                payload: { url: w.webhook.url, headers, body: payload },
              });
            } catch (enqueueErr: any) {
              console.error(`[Email Worker] Failed to enqueue retry:`, enqueueErr.message || enqueueErr);
            }
          }
        })());

        webhookMatched = true;
      } catch (err) {
        console.error(`[Email Worker] Webhook delivery error for rule ${w.rule.usernamePattern}:`, err);
      }
    }

    if (ruleMatched || webhookMatched) {
      await markDeliveryStatus(env.DB, dedupKey, 'sent');
      return;
    }

    console.warn(`[Email Worker] No rule matched for ${maskEmail(to)}, rejecting.`);
    message.setReject('Address not allowed');
    await markDeliveryStatus(env.DB, dedupKey, 'rejected');
  } catch (err) {
    console.error(`[Email Worker] Inbound processing error for ${maskEmail(to)}:`, err);
    await markDeliveryStatus(env.DB, dedupKey, 'failed');
  }
}

export async function handleQueue(batch: MessageBatch<RetryMessage>, env: Bindings, ctx: ExecutionContext): Promise<void> {
  if (batch.queue === 'jotify-email-dlq') {
    for (const msg of batch.messages) {
      console.warn(`[DLQ] Discarding exhausted message: kind=${msg.body.kind}, key=${msg.body.idempotencyKey}, attempts=${msg.attempts}`);
      await persistFailedWebhook(env, msg);
    }
    batch.ackAll();
    return;
  }

  for (const msg of batch.messages) {
    try {
      const ok = await deliverOnce(msg.body);
      if (ok) {
        msg.ack();
      } else {
        msg.retry({ delaySeconds: backoffSeconds(msg.attempts) });
      }
    } catch {
      msg.retry({ delaySeconds: backoffSeconds(msg.attempts) });
    }
  }
}

async function persistFailedWebhook(env: Bindings, msg: Message<RetryMessage>): Promise<void> {
  if (msg.body.kind !== 'webhook') return;
  const payloadBody = (msg.body.payload?.body || {}) as any;
  const deliveryId = payloadBody?.delivery_id;
  if (!deliveryId) return;

  const m = /^jotify\/webhook\/(\d+)\//.exec(deliveryId);
  const webhookId = m ? parseInt(m[1], 10) : null;
  if (!webhookId) return;

  const db = getDb(env.DB);
  const webhook = await db.select({
    userId: schema.webhooks.userId,
    url: schema.webhooks.url,
    authType: schema.webhooks.authType,
    authToken: schema.webhooks.authToken,
  }).from(schema.webhooks).where(eq(schema.webhooks.id, webhookId)).then(r => r[0]);

  if (!webhook) {
    console.warn(`[DLQ] Webhook ${webhookId} no longer exists, skipping persistence for ${deliveryId}`);
    return;
  }

  try {
    await db.insert(schema.failedWebhooks).values({
      userId: webhook.userId,
      webhookId,
      deliveryId,
      url: webhook.url,
      headers: JSON.stringify(sanitizeWebhookHeaders(msg.body.payload?.headers || {})),
      payload: JSON.stringify(payloadBody),
      attempts: msg.attempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: schema.failedWebhooks.deliveryId });
  } catch (err) {
    console.error(`[DLQ] Failed to persist failed webhook ${deliveryId}:`, err);
  }
}
