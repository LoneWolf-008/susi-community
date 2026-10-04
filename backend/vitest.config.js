import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/testEnv.js';

export default defineConfig({
  test: {
    environment: 'node',
    env: TEST_ENV,
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // Semua berkas memakai satu DB test dan mengosongkannya di awal: jalankan berurutan.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
