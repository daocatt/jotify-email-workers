import { DurableObject } from 'cloudflare:workers';

interface RateEntry {
  count: number;
  resetAt: number;
}

type RateLimiterEnv = { RATE_LIMITER: DurableObjectNamespace };

export class RateLimiterDO extends DurableObject<RateLimiterEnv> {
  private counts: Map<string, RateEntry> = new Map();

  async check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    let entry = this.counts.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      this.counts.set(key, entry);
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    if (this.counts.size > 50000) {
      for (const [k, v] of this.counts) {
        if (v.resetAt <= now) this.counts.delete(k);
      }
    }

    try {
      await this.ctx.storage.setAlarm(entry.resetAt);
    } catch {}

    return { allowed, remaining };
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    let nextAlarm = Infinity;
    for (const [k, v] of this.counts) {
      if (v.resetAt <= now) {
        this.counts.delete(k);
      } else {
        nextAlarm = Math.min(nextAlarm, v.resetAt);
      }
    }
    if (nextAlarm < Infinity && this.counts.size > 0) {
      try {
        await this.ctx.storage.setAlarm(nextAlarm);
      } catch {}
    }
  }
}
