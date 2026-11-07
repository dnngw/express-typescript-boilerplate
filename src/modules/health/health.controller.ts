import type { Request, Response } from 'express';

import type { HealthService } from './health.service';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: the process is running. Should never touch external dependencies. */
  liveness = (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  };

  /** Readiness: the app can serve traffic (database reachable, ...). */
  readiness = async (_req: Request, res: Response): Promise<void> => {
    const report = await this.healthService.getReadiness();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  };
}
