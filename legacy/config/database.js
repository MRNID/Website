const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'TenantAdminDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT || 30000),
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 30000),
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 0),
    idleTimeoutMillis: 30000,
  },
};

async function connectDb() {
  try {
    await sql.connect(config);
    console.log('SQL Server connected successfully.');
    return sql;
  } catch (error) {
    console.error('SQL Server connection failed:', error.message);
    throw error;
  }
}

module.exports = {
  sql,
  config,
  connectDb,
};
