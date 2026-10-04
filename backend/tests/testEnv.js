// Environment khusus test. DB_HOST/PORT/USER/PASSWORD tetap diambil dari backend/.env
// (atau environment CI); DB_NAME selalu diarahkan ke database *_test.
import os from 'node:os';
import path from 'node:path';

export const TEST_DB_NAME = process.env.TEST_DB_NAME || 'susi_community_test';
export const TEST_UPLOAD_DIR = path.join(os.tmpdir(), 'susi-community-test-uploads');

export const TEST_ENV = {
  NODE_ENV: 'test',
  DB_NAME: TEST_DB_NAME,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
  FRONTEND_URL: 'http://localhost:5173',
  // Batas tinggi agar suite tidak terkena rate limit; tests/auth.ratelimit.test.js menurunkannya.
  RATE_LIMIT_MAX: '100000',
  AUTH_RATE_LIMIT_MAX: '100000',
  PUBLIC_RATE_LIMIT_MAX: '100000',
  VISIT_RATE_LIMIT_MAX: '100000',
  UPLOAD_DIR: TEST_UPLOAD_DIR,
};
