import type { CacheStore } from './cache-store';

interface Entry {
  /** Stored serialized, like Redis, so callers can't mutate cached objects by reference. */
  value: string;
  expiresAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Process-local cache. Fine for development, tests, and single-instance deployments.
 * With several instances, use Redis so cache invalidation reaches every instance.
 */
export class MemoryCacheStore implements CacheStore {
  readonly driver = 'memory';
  private readonly entries = new Map<string, Entry>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => {
      this.sweep();
    }, SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(null);

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(JSON.parse(entry.value) as T);
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  delete(...keys: string[]): Promise<void> {
    for (const key of keys) this.entries.delete(key);
    return Promise.resolve();
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }

  disconnect(): Promise<void> {
    clearInterval(this.sweeper);
    this.entries.clear();
    return Promise.resolve();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
