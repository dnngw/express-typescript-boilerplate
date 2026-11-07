import type { PrismaClient } from '@/lib/prisma';

type ComponentStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, { status: ComponentStatus; latencyMs?: number }>;
}

export class HealthService {
  constructor(private readonly prisma: PrismaClient) {}

  async getReadiness(): Promise<HealthReport> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'error',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }

  private async checkDatabase(): Promise<{ status: ComponentStatus; latencyMs?: number }> {
    const startedAt = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch {
      return { status: 'down' };
    }
  }
}
