import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
await import('../apps/backend-api/dist/config.js');
const { getDbPool, closeDbPool, sql } = await import('../packages/database/dist/index.js');
const args = process.argv.slice(2);
const option = key => args[args.indexOf(key) + 1];
let outputCreated = false;
const output = args.includes('--out') ? resolve(option('--out')) : '';
try {
  if (!args.includes('--station-id') || !args.includes('--backend') || !output) throw new Error('Usage: node scripts/provision-worker.mjs --station-id UUID --backend wss://server/ws/worker --out PACK01.worker.env');
  if (existsSync(output)) throw new Error('Output already exists; use a new output filename to rotate credentials.');
  const endpoint = new URL(option('--backend'));
  if (endpoint.protocol !== 'wss:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Remote worker connection requires WSS.');
  const stationId = option('--station-id');
  const pool = await getDbPool();
  const station = (await pool.request().input('id', sql.VarChar(36), stationId).query('SELECT id, code FROM stations WHERE id = @id')).recordset[0];
  if (!station || !/^[A-Za-z0-9_-]{2,30}$/.test(station.code)) throw new Error('Station not found or code invalid');
  const token = randomBytes(32).toString('hex');
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).input('station', sql.VarChar(36), stationId)
      .input('hash', sql.VarChar(255), createHash('sha256').update(token).digest('hex'))
      .input('id', sql.VarChar(36), randomUUID()).query(`
        UPDATE workers WITH (UPDLOCK, SERIALIZABLE) SET token_hash = @hash WHERE station_id = @station;
        IF @@ROWCOUNT = 0 INSERT INTO workers (id, station_id, token_hash, status) VALUES (@id, @station, @hash, 'OFFLINE');`);
    const lines = [
      `STATION_ID=${stationId}`, `STATION_CODE=${station.code}`, `WORKER_TOKEN=${token}`,
      `BACKEND_WS_URL=${endpoint.toString()}`, `LOCAL_ARCHIVE_DIR=D:/PackingVideo/${station.code}`,
      `LOCAL_TEMP_DIR=D:/PackingVideo/${station.code}/temp`, `JOURNAL_DIR=D:/PackingVideo/${station.code}/journal`
    ];
    writeFileSync(output, lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    outputCreated = true;
    await transaction.commit();
    console.log('Worker credentials provisioned. Deliver the generated env file privately to this station. Existing credentials for this station are revoked.');
  } catch (error) {
    await transaction.rollback();
    if (outputCreated) unlinkSync(output);
    throw error;
  }
} catch (error) { console.error('Provisioning failed:', error.message); process.exitCode = 1; }
finally { await closeDbPool(); }
