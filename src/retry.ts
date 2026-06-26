/**
 * Retry delivery module — Queue-based replacement for the legacy D1-polling cron.
 *
 * Inline webhook delivery failures are enqueued to RETRY_QUEUE; a queue consumer
 * drains them with graded exponential backoff. Messages that exhaust max_retries
 * fall through to the dead-letter queue (jotify-email-dlq), whose consumer
 * silently ackAll()s them — no archive table, no log, no alerting.
 */

const TIMEOUT_MS = 15000;

/** Unified queue message format. */
export type RetryMessage = {
  kind: 'webhook';
  idempotencyKey: string; // delivery id for receiver-side dedupe
  payload: WebhookRetryPayload;
};

export interface WebhookRetryPayload {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Minimal env shape needed to enqueue retries. */
export interface RetryQueueEnv {
  RETRY_QUEUE: Queue<RetryMessage>;
}

/**
 * Graded backoff in seconds, mirroring the previous cron tiers:
 *
 *   attempts <  10  ->   5 minutes
 *   attempts 10-14  ->  60 minutes
 *   attempts >= 15  -> 180 minutes
 *
 * Queues accepts delaySeconds; combined with max_retries=17 (+ 3 inline) this
 * keeps the total attempt budget ≈ 20, matching the old MAX_ATTEMPTS.
 */
export function backoffSeconds(attempts: number): number {
  if (attempts < 10) return 5 * 60;
  if (attempts < 15) return 60 * 60;
  return 3 * 60 * 60;
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempt webhook delivery with inline retries (retries parameter controls
 * how many times to retry within a single call). On final failure, the caller
 * should enqueue to RETRY_QUEUE for async retry.
 */
export async function deliverWebhookWithRetry(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  retries = 2,
  timeoutMs = TIMEOUT_MS
): Promise<boolean> {
  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (res.ok) {
        console.log(`[Retry] Webhook delivered to ${url} (status: ${res.status}, attempt: ${attempt + 1})`);
        return true;
      }
      console.warn(`[Retry] Webhook returned ${res.status} from ${url} (attempt: ${attempt + 1}/${retries + 1})`);
    } catch (err: any) {
      clearTimeout(id);
      console.error(`[Retry] Webhook attempt ${attempt + 1} failed for ${url}:`, err.message || err);
    }
    attempt++;
    if (attempt <= retries) {
      await sleep(1000 * attempt);
    }
  }
  return false;
}

/** Enqueue a failed webhook delivery for async retry via RETRY_QUEUE. */
export async function enqueueRetry(
  env: RetryQueueEnv,
  msg: RetryMessage,
  delaySeconds?: number
): Promise<void> {
  await env.RETRY_QUEUE.send(msg, delaySeconds != null ? { delaySeconds } : undefined);
}

/**
 * Attempt a single webhook delivery (retries = 0; the queue handles retry
 * scheduling via msg.retry). Returns true on success.
 */
export async function deliverOnce(msg: RetryMessage): Promise<boolean> {
  if (msg.kind === 'webhook') {
    const p = msg.payload;
    return deliverWebhookWithRetry(p.url, p.headers, p.body, 0);
  }
  return false;
}
