const express = require('express');
const path = require('path');
const config = require('./config/app');
const { getAllTenants, getTenantConfig, resolveTenant } = require('./functions/tenant');
const { formatDate } = require('./functions/utils');
const { registerPlugins } = require('./plugins/demo-plugin');
const { authenticateUser, signToken, requireAuth, sanitizeUser } = require('./functions/auth');
const { getUsersByTenant } = require('./config/users');

const app = express();
const PORT = config.port;

app.use(express.json());

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/image', express.static(path.join(__dirname, 'image')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    app: config.appName,
    mode: config.tenantMode,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Thiếu username hoặc password.',
    });
  }

  const user = authenticateUser({ username, password });

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Username hoặc password không đúng.',
    });
  }

  const token = signToken(user);

  return res.json({
    success: true,
    data: {
      token,
      user,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

app.get('/api/tenants', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: getAllTenants(),
    meta: {
      defaultTenant: config.defaultTenant,
      generatedAt: formatDate(),
    },
  });
});

app.get('/api/users', requireAuth, (req, res) => {
  const tenantId = req.query.tenantId || req.user.tenantId;

  if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Bạn không có quyền xem dữ liệu tenant này.',
    });
  }

  const tenantUsers = getUsersByTenant(tenantId).map(sanitizeUser);

  return res.json({
    success: true,
    data: tenantUsers,
  });
});

app.get('/api/tenant/:tenantId', requireAuth, (req, res) => {
  const tenant = getTenantConfig(req.params.tenantId) || resolveTenant(req.params.tenantId);

  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'TENANT_NOT_FOUND',
      message: 'Tenant không tồn tại trong cấu hình hệ thống.',
    });
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenant.id) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Bạn không có quyền truy cập tenant này.',
    });
  }

  return res.json({
    success: true,
    data: tenant,
  });
});

app.get('/api/dashboard/:tenantId', requireAuth, (req, res) => {
  const tenant = getTenantConfig(req.params.tenantId) || resolveTenant(req.params.tenantId);

  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'TENANT_NOT_FOUND',
      message: 'Tenant không tồn tại.',
    });
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenant.id) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Bạn không có quyền xem dashboard tenant này.',
    });
  }

  res.json({
    success: true,
    data: {
      tenant,
      summary: {
        orders: 1240,
        revenue: 142000000,
        activeUsers: 328,
        conversionRate: 6.8,
      },
      timeline: [
        { label: 'Jan', value: 45 },
        { label: 'Feb', value: 55 },
        { label: 'Mar', value: 68 },
        { label: 'Apr', value: 72 },
        { label: 'May', value: 81 },
        { label: 'Jun', value: 94 },
      ],
    },
  });
});

registerPlugins(app);

app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin login: http://localhost:${PORT}/admin/login.html`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin/`);
});
