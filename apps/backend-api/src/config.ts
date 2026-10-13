import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load before evaluating configuration, including when started from apps/backend-api.
const envPath = existsSync('.env') ? '.env' : fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || [
  'packing-video-proof-super-secure-jwt-secret-key-32chars',
  'super-secret-jwt-key-minimum-32-chars-length!'
].includes(jwtSecret)) {
  throw new Error('JWT_SECRET must be a private, randomly generated secret of at least 32 characters.');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  ffmpegPath: process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg',
  db: {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Tgb@2020',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'packing_proof_db',
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS'
  }
};
