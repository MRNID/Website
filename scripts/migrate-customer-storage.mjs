import { readFileSync } from 'node:fs';
await import('../apps/backend-api/dist/config.js');
const { getDbPool, closeDbPool, sql } = await import('../packages/database/dist/index.js');
try {
  const pool = await getDbPool();
  if (!process.argv.includes('--apply')) {
    const res = await pool.request().query("SELECT COL_LENGTH('dbo.videos','storage_owner') AS storage_owner, COL_LENGTH('dbo.videos','drive_file_id') AS drive_file_id");
    console.log('Customer storage schema:', res.recordset[0]);
  } else {
    const migration = readFileSync(new URL('../packages/database/sqlserver/migrations/20261012_customer_storage.sql', import.meta.url), 'utf8');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const batch of migration.split(/^GO\s*$/m).filter(s => s.trim())) await new sql.Request(transaction).batch(batch);
      await transaction.commit();
      console.log('Applied additive customer-storage migration. Existing video ownership was preserved.');
    } catch (error) { await transaction.rollback(); throw error; }
  }
} catch (error) { console.error('Migration failed:', error.message); process.exitCode = 1; }
finally { await closeDbPool(); }
