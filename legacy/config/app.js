module.exports = {
  appName: process.env.APP_NAME || 'Tenant Admin Starter',
  port: Number(process.env.PORT || 3000),
  defaultTenant: process.env.DEFAULT_TENANT || 'tenant-alpha',
  tenantMode: 'single-db-multi-tenant',
  supportsPlugins: true,
  uploadDir: 'uploads',
  allowedImageExtensions: ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
};
