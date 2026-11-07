/**
 * Minimal key-value cache contract. Services depend on this interface, not on Redis,
 * so the implementation can be swapped (Redis in production, in-memory in dev/tests).
 */
export interface CacheStore {
  readonly driver: string;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
  ping(): Promise<boolean>;
  disconnect(): Promise<void>;
}
