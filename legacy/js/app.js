const tenantSelect = document.getElementById('tenant-select');
const tenantTitle = document.getElementById('tenant-title');
const tenantDomain = document.getElementById('tenant-domain');
const brandName = document.getElementById('brand-name');
const tenantDetails = document.getElementById('tenant-details');
const chart = document.getElementById('chart');
const currentUserBox = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');

const tokenKey = 'tenant_admin_token';
const userKey = 'tenant_admin_user';

function getAuthHeaders() {
  const token = localStorage.getItem(tokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  window.location.href = '/admin/login.html';
}

async function loadCurrentUser() {
  const userJson = localStorage.getItem(userKey);
  if (!userJson) {
    redirectToLogin();
    return null;
  }

  try {
    const user = JSON.parse(userJson);
    currentUserBox.textContent = `${user.fullName} (${user.role})`;
    return user;
  } catch (error) {
    redirectToLogin();
    return null;
  }
}

async function loadTenants() {
  const token = localStorage.getItem(tokenKey);
  if (!token) {
    redirectToLogin();
    return;
  }

  const res = await fetch('/api/tenants', {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    redirectToLogin();
    return;
  }

  const json = await res.json();

  if (!json.success) {
    return;
  }

  const tenants = json.data;
  tenantSelect.innerHTML = tenants
    .map(
      (tenant) =>
        `<option value="${tenant.id}">${tenant.name}</option>`
    )
    .join('');

  const defaultId = tenants[0]?.id || 'tenant-alpha';
  tenantSelect.value = defaultId;
  await loadDashboard(defaultId);
}

async function loadDashboard(tenantId) {
  const res = await fetch(`/api/dashboard/${tenantId}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    redirectToLogin();
    return;
  }

  const json = await res.json();

  if (!json.success) {
    return;
  }

  const tenant = json.data.tenant;
  const summary = json.data.summary;

  tenantTitle.textContent = tenant.name;
  tenantDomain.textContent = tenant.domain;
  brandName.textContent = tenant.name;

  document.getElementById('orders-total').textContent = summary.orders.toLocaleString();
  document.getElementById('revenue-total').textContent = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(summary.revenue);
  document.getElementById('active-users').textContent = summary.activeUsers.toLocaleString();
  document.getElementById('conversion-rate').textContent = `${summary.conversionRate}%`;

  const bars = json.data.timeline
    .map(
      (point) =>
        `<div class="bar" data-label="${point.label}" style="height: ${point.value}%"></div>`
    )
    .join('');

  chart.innerHTML = bars;

  tenantDetails.innerHTML = `
    <li><span>ID</span><strong>${tenant.id}</strong></li>
    <li><span>Owner</span><strong>${tenant.owner}</strong></li>
    <li><span>Domain</span><strong>${tenant.domain}</strong></li>
    <li><span>Modules</span><strong>${tenant.modules.join(', ')}</strong></li>
    <li><span>Storage limit</span><strong>${tenant.storage.maxUploadMb} MB</strong></li>
  `;
}

tenantSelect.addEventListener('change', async (event) => {
  await loadDashboard(event.target.value);
});

logoutBtn.addEventListener('click', () => {
  redirectToLogin();
});

(async function init() {
  const user = await loadCurrentUser();
  if (!user) {
    return;
  }

  await loadTenants();
})();
