import * as sql from 'mssql';

export interface SqlServerConfig {
  user?: string;
  password?: string;
  server: string;
  database: string;
  instanceName?: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

let pool: sql.ConnectionPool | null = null;

export function getDefaultConfig(): sql.config {
  return {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Tgb@2020',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'packing_proof_db',
    options: {
      instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
      trustServerCertificate: true,
      encrypt: false
    },
    pool: {
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000
    }
  };
}

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    const config = getDefaultConfig();
    pool = await new sql.ConnectionPool(config).connect();
  }
  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { sql };
