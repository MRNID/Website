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
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Invalid DB_PORT');
  if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required in production');
  return {
    ...(port === undefined ? {} : { port }),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Tgb@2020',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'packing_proof_db',
    requestTimeout: 60000,
    connectionTimeout: 30000,
    options: {
      instanceName: port === undefined ? (process.env.DB_INSTANCE ?? 'SQLEXPRESS') || undefined : undefined,
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || (process.env.DB_TRUST_SERVER_CERTIFICATE === undefined && process.env.NODE_ENV !== 'production'),
      encrypt: process.env.DB_ENCRYPT === 'true' || (process.env.DB_ENCRYPT === undefined && process.env.NODE_ENV === 'production'),
      requestTimeout: 60000
    },
    pool: {
      max: 50,
      min: 5,
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
