module.exports = {
  'tenant-alpha': {
    id: 'tenant-alpha',
    name: 'Alpha Commerce',
    domain: 'alpha.example.com',
    owner: 'Nguyen Van A',
    theme: {
      primary: '#2563eb',
      accent: '#10b981',
      bg: '#f8fafc',
      text: '#0f172a',
    },
    modules: ['orders', 'inventory', 'reports', 'customers'],
    storage: {
      maxUploadMb: 500,
      basePath: '/uploads/tenant-alpha'
    }
  },
  'tenant-beta': {
    id: 'tenant-beta',
    name: 'Beta Retail',
    domain: 'beta.example.com',
    owner: 'Tran Thi B',
    theme: {
      primary: '#7c3aed',
      accent: '#f59e0b',
      bg: '#fff7ed',
      text: '#1f2937',
    },
    modules: ['orders', 'marketing', 'customers', 'analytics'],
    storage: {
      maxUploadMb: 800,
      basePath: '/uploads/tenant-beta'
    }
  }
};
