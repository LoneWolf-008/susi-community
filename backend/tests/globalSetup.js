// Sekali sebelum seluruh suite: kosongkan DB test lalu pasang schema.sql + semua migrasi.
// Dengan begitu migrasi ikut teruji setiap kali `npm test` dijalankan.
import fs from 'node:fs/promises';
import { TEST_ENV, TEST_UPLOAD_DIR } from './testEnv.js';

export default async function setup() {
  Object.assign(process.env, TEST_ENV);
  if (!/_test$/.test(process.env.DB_NAME)) {
    throw new Error(`Test menolak berjalan di database "${process.env.DB_NAME}" (nama harus berakhiran _test)`);
  }

  const { resetDatabase } = await import('../utils/migrate.js');
  await resetDatabase({ log: () => {} });
  await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });

  return async () => {
    await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  };
}
