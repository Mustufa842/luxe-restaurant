/**
 * Zero-cost in-memory rate limiter — sliding window, no Redis required.
 *
 * TRADE-OFF (be aware of this): state lives in the Node process's memory.
 * On serverless platforms with multiple concurrent instances (e.g. Vercel
 * under real load), each instance has its own counter, so the effective
 * limit is "per-instance" rather than truly global — a determined attacker
 * spread across instances could exceed the nominal limit. For a
 * single-instance deploy (one VPS, one long-running Node server, or
 * Vercel at low traffic) this is a real, working limiter. If you outgrow
 * it, swap this file for Upstash Redis later — every call site stays the
 * same (`checkRateLimit(key, tier)`), only the implementation changes.
 */

type Tier = "standard" | "sensitive";

const WINDOWS_MS: Record<Tier, number> = {
  standard: 60_000,
  sensitive: 60_000,
};

const LIMITS: Record<Tier, number> = {
  standard: 60,
  sensitive: 10,
};

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow unbounded with one-off IPs.
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupIfNeeded() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of buckets.entries()) {
    const maxWindow = Math.max(...Object.values(WINDOWS_MS));
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < maxWindow);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export async function checkRateLimit(
  key: string,
  tier: Tier = "standard"
): Promise<{ success: boolean; remaining: number; limit: number }> {
  cleanupIfNeeded();

  const now = Date.now();
  const windowMs = WINDOWS_MS[tier];
  const limit = LIMITS[tier];

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  const success = bucket.timestamps.length < limit;
  if (success) {
    bucket.timestamps.push(now);
  }
  buckets.set(key, bucket);

  return { success, remaining: Math.max(0, limit - bucket.timestamps.length), limit };
}
