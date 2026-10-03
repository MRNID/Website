const users = [
  {
    id: 'user-001',
    username: 'admin.alpha',
    password: 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7',
    fullName: 'Nguyen Van A',
    email: 'admin.alpha@example.com',
    role: 'SUPER_ADMIN',
    tenantId: 'tenant-alpha',
    isActive: true,
  },
  {
    id: 'user-002',
    username: 'admin.beta',
    password: 'e86f78a8a3caf0b60d8e74e5942aa6d86dc150cd3c03338aef25b7d2d7e3acc7',
    fullName: 'Tran Thi B',
    email: 'admin.beta@example.com',
    role: 'SUPER_ADMIN',
    tenantId: 'tenant-beta',
    isActive: true,
  },
  {
    id: 'user-003',
    username: 'manager.alpha',
    password: 'e8392925a98c9c22795d1fc5d0dfee5b9a6943f6b768ec5a2a0c077e5ed119cf',
    fullName: 'Le Thi C',
    email: 'manager.alpha@example.com',
    role: 'TENANT_MANAGER',
    tenantId: 'tenant-alpha',
    isActive: true,
  },
];

function findUserByUsername(username) {
  return users.find((user) => user.username.toLowerCase() === String(username).toLowerCase());
}

function getUsersByTenant(tenantId) {
  return users.filter((user) => user.tenantId === tenantId);
}

module.exports = {
  users,
  findUserByUsername,
  getUsersByTenant,
};
