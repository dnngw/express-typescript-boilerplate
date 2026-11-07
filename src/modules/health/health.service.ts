import type { CacheStore } from '@/lib/cache';
import type { PrismaClient } from '@/lib/prisma';

type ComponentStatus = 'up' | 'down';

interface ComponentHealth {
  status: ComponentStatus;
  latencyMs?: number;
}

export interface HealthReport {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, ComponentHealth & { driver?: string }>;
}

export class HealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheStore,
  ) {}

  async getReadiness(): Promise<HealthReport> {
    const [database, cache] = await Promise.all([
      this.measure(async () => {
        await this.prisma.$queryRaw`SELECT 1`;
        return true;
      }),
      this.measure(() => this.cache.ping()),
    ]);

    return {
      status: database.status === 'up' && cache.status === 'up' ? 'ok' : 'error',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, cache: { ...cache, driver: this.cache.driver } },
    };
  }

  private async measure(check: () => Promise<boolean>): Promise<ComponentHealth> {
    const startedAt = performance.now();
    try {
      const healthy = await check();
      if (!healthy) return { status: 'down' };
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch {
      return { status: 'down' };
    }
  }
}
