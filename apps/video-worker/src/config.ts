import * as path from 'node:path';

export const workerConfig = {
  stationCode: process.env.STATION_CODE || 'PACK01',
  stationId: process.env.STATION_ID || '801F89A1-23A8-4349-8839-C509B4015B72',
  workerToken: process.env.WORKER_TOKEN || 'st_secret_token_pack01',
  backendWsUrl: process.env.BACKEND_WS_URL || 'ws://localhost:4000/ws/worker',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  tempDir: process.env.LOCAL_TEMP_DIR || 'D:\\PackingVideoTemp',
  archiveDir: process.env.LOCAL_ARCHIVE_DIR || 'D:\\PackingVideo',
  nasDir: process.env.NAS_SHARE_DIR || '\\\\SERVER\\PackingVideo',
  journalDir: process.env.JOURNAL_DIR || path.join(process.cwd(), '.journal')
};
