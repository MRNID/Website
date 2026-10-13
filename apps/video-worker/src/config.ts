import * as path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = process.env.WORKER_ENV_FILE || (existsSync('.env') ? '.env' : fileURLToPath(new URL('../../../.env', import.meta.url)));
if (existsSync(envPath)) process.loadEnvFile(envPath);
const backendWsUrl = process.env.BACKEND_WS_URL || 'ws://localhost:4000/ws/worker';
const backendUrl = new URL(backendWsUrl);
backendUrl.protocol = backendUrl.protocol === 'wss:' ? 'https:' : 'http:';

export const workerConfig = {
  stationCode: process.env.STATION_CODE || 'PACK01',
  stationId: process.env.STATION_ID || '',
  workerToken: process.env.WORKER_TOKEN || '',
  backendWsUrl,
  backendApiOrigin: backendUrl.origin,
  ffmpegPath: process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg',
  tempDir: process.env.LOCAL_TEMP_DIR || 'D:\\PackingVideoTemp',
  archiveDir: process.env.LOCAL_ARCHIVE_DIR || 'D:\\PackingVideo',
  nasDir: process.env.NAS_SHARE_DIR || '\\\\SERVER\\PackingVideo',
  journalDir: process.env.JOURNAL_DIR || path.join(process.cwd(), '.journal')
};
