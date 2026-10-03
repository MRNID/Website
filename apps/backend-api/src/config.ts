export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'packing-video-proof-super-secure-jwt-secret-key-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  db: {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Tgb@2020',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'packing_proof_db',
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS'
  }
};
