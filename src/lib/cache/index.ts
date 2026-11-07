import { config } from '@/config';
import { logger } from '@/lib/logger';

import type { CacheStore } from './cache-store';
import { MemoryCacheStore } from './memory-cache-store';
import { RedisCacheStore } from './redis-cache-store';

function createCacheStore(): CacheStore {
  if (config.redis.url) return new RedisCacheStore(config.redis.url, logger);
  return new MemoryCacheStore();
}

/** Shared cache instance: Redis when `REDIS_URL` is set, in-memory otherwise. */
export const cache = createCacheStore();

export type { CacheStore };
