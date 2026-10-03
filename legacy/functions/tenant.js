const tenants = require('../config/tenants');

function getAllTenants() {
  return Object.values(tenants);
}

function resolveTenant(tenantIdOrDomain) {
  const query = String(tenantIdOrDomain || '').toLowerCase();

  const tenant = Object.values(tenants).find((item) => {
    return item.id === query || item.domain === query || item.name.toLowerCase() === query;
  });

  return tenant || null;
}

function getTenantConfig(tenantId) {
  return tenants[tenantId] || null;
}

module.exports = {
  tenants,
  getAllTenants,
  resolveTenant,
  getTenantConfig,
};
