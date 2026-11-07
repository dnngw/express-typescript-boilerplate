import { execSync } from 'node:child_process';

/** Runs once before the integration suite: brings the test database schema up to date. */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}
