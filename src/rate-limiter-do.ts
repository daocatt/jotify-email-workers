import { DurableObject } from 'cloudflare:workers';

interface RateEntry {
  count: number;
  resetAt: number;
}

type RateLimiterEnv = { RATE_LIMITER: DurableObjectNamespace };

export class RateLimiterDO extends DurableObject<RateLimiterEnv> {
  private async getEntry(key: string): Promise<RateEntry | null> {
    return (await this.ctx.storage.get<RateEntry>(key)) ?? null;
  }

  async check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    let entry = await this.getEntry(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    await this.ctx.storage.put(key, entry);

    try {
      await this.ctx.storage.setAlarm(entry.resetAt);
    } catch {}

    return { allowed, remaining };
  }

  /** Peek whether a key has already exceeded its failure budget (no increment). */
  async isBlocked(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = await this.getEntry(key);
    if (!entry || now >= entry.resetAt) return false;
    return entry.count >= limit;
  }

  /** Record a failure against a key, blocking further attempts once limit is hit. */
  async recordFailure(key: string, windowMs: number): Promise<void> {
    const now = Date.now();
    let entry = await this.getEntry(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }
    entry.count++;
    await this.ctx.storage.put(key, entry);
    try {
      await this.ctx.storage.setAlarm(entry.resetAt);
    } catch {}
  }

  /** Clear a key's counters (e.g. after a successful login). */
  async clear(key: string): Promise<void> {
    await this.ctx.storage.delete(key);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    let nextAlarm = Infinity;
    const expired: string[] = [];
    for (const [k, v] of await this.ctx.storage.list<RateEntry>()) {
      if (v.resetAt <= now) {
        expired.push(k);
      } else {
        nextAlarm = Math.min(nextAlarm, v.resetAt);
      }
    }
    if (expired.length > 0) {
      await this.ctx.storage.delete(expired);
    }
    if (nextAlarm < Infinity) {
      try {
        await this.ctx.storage.setAlarm(nextAlarm);
      } catch {}
    }
  }
}
