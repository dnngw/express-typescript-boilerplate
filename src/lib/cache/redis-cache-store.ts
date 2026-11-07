import { Redis } from 'ioredis';

import type { Logger } from '@/lib/logger';

import type { CacheStore } from './cache-store';

export class RedisCacheStore implements CacheStore {
  readonly driver = 'redis';
  private readonly client: Redis;

  constructor(url: string, logger: Logger, keyPrefix = 'app:') {
    this.client = new Redis(url, { keyPrefix, maxRetriesPerRequest: 3 });
    // Without a listener, ioredis would print every connection error as unhandled.
    this.client.on('error', (error) => {
      logger.error({ err: error }, 'Redis error');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys);
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
