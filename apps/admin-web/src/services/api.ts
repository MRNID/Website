import { API_BASE } from './endpoints';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  warehouseId?: string;
  businessId?: string;
  businessName?: string;
  accessToken: string;
}

export interface VideoRecord {
  id: string;
  filename: string;
  local_path: string;
  nas_path?: string;
  duration: number;
  file_size: number;
  sha256: string;
  thumbnail_path?: string;
  sync_status: string;
  sync_error?: string;
  storage_owner?: string;
  drive_file_id?: string;
  is_locked: boolean;
  dispute_status: 'NONE' | 'UNDER_REVIEW' | 'SUBMITTED_TO_CARRIER' | 'WON' | 'LOST';
  created_at: string;
  tracking_code: string;
  order_code: string;
  platform: string;
  station_name: string;
  station_code: string;
  operator_name: string;
}

export interface DashboardStats {
  packedToday: number;
  activeRecordingNow: number;
  disputesCount: number;
  totalStations: number;
  onlineStations: number;
}

export interface LogisticsDashboardData {
  summary: {
    totalOrders: number;
    completedOrders: number;
    recordingOrders: number;
    pendingOrders: number;
    disputedOrders: number;
    fulfillmentRate: number;
    avgDurationSeconds: number;
    minDurationSeconds: number;
    maxDurationSeconds: number;
    totalPackingMinutes: number;
  };
  hourlyThroughput: Array<{
    hour: number;
    hourLabel: string;
    orderCount: number;
    avgDuration: number;
  }>;
  operatorLeaderboard: Array<{
    rank: number;
    userId: string;
    operatorName: string;
    packedCount: number;
    avgDuration: number;
    disputeCount: number;
    accuracyRate: number;
  }>;
  platformBreakdown: Array<{
    platform: string;
    totalCount: number;
    packedCount: number;
    percentage: number;
  }>;
  stationProductivity: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    sessionCount: number;
    avgDuration: number;
  }>;
  timeRange: 'today' | '7days' | '30days';
}

export interface HashVerifyResult {
  videoId: string;
  dbHash: string;
  calculatedHash: string;
  isMatch: boolean;
  verifiedAt: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  apiKey?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  planTier: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  monthlyOrderLimit: number;
  maxStations: number;
  retentionDays: number;
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED';
  subscriptionExpiresAt?: string;
  daysRemaining: number;
  pricePerMonth: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  usage: {
    ordersThisMonth: number;
    monthlyOrderLimit: number;
    usagePercent: number;
    stationCount: number;
    maxStations: number;
    totalOrders: number;
    totalVideos: number;
    totalVideoBytes: number;
  };
}

export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  expiredTenants: number;
  totalMrr: number;
  totalOrdersThisMonth: number;
  totalVideoStorageBytes: number;
}

export interface TenantQuotaStatus {
  isAllowed: boolean;
  reason?: string;
  planTier: string;
  monthlyOrderLimit: number;
  ordersThisMonth: number;
  usagePercent: number;
  subscriptionStatus: string;
}

export interface StaffUser {
  id: string;
  businessId: string;
  businessName: string;
  businessCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  roleId: string;
  roleName: string;
  roleDescription?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalPacked: number;
    packedToday: number;
  };
}

export interface RoleRecord {
  id: string;
  businessId: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

class AdminApiService {
  private token: string | null = localStorage.getItem('admin_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as any),
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error?.message || `Request failed with status ${res.status}`);
    }

    return data.data;
  }

  async login(username: string, password: string): Promise<AdminUser> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    const user: AdminUser = {
      ...json.data.user,
      accessToken: json.data.accessToken
    };
    this.setToken(user.accessToken);
    return user;
  }

  async getMe(): Promise<any> {
    return this.request('/auth/me');
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request('/admin/dashboard');
  }

  async getStations(params?: { businessId?: string; warehouseId?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.businessId) q.append('businessId', params.businessId);
    if (params?.warehouseId) q.append('warehouseId', params.warehouseId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/stations${qs}`);
  }

  async getWarehouses(businessId?: string): Promise<any[]> {
    const qs = businessId ? `?businessId=${businessId}` : '';
    return this.request(`/admin/warehouses${qs}`);
  }

  async searchVideos(params: {
    trackingCode?: string;
    orderCode?: string;
    stationId?: string;
    disputeStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: VideoRecord[]; total: number }> {
    const query = new URLSearchParams();
    if (params.trackingCode) query.append('trackingCode', params.trackingCode);
    if (params.orderCode) query.append('orderCode', params.orderCode);
    if (params.stationId) query.append('stationId', params.stationId);
    if (params.disputeStatus && params.disputeStatus !== 'ALL') query.append('disputeStatus', params.disputeStatus);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/videos?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to search videos');
    }
    return {
      items: json.data,
      total: json.pagination.total
    };
  }

  getVideoShareUrl(videoId: string): string {
    const url = new URL(window.location.origin);
    url.searchParams.set('tab', 'videos');
    url.searchParams.set('videoId', videoId);
    return url.toString();
  }

  async getVideoDetail(videoId: string): Promise<VideoRecord> {
    return this.request(`/videos/${encodeURIComponent(videoId)}`);
  }

  async getVideoPlayback(videoId: string): Promise<{ url: string; source: string }> {
    const result = await this.request<{ ticket: string; source: string }>(`/videos/${encodeURIComponent(videoId)}/playback`, { method: 'POST' });
    return { url: `${API_BASE}/videos/${encodeURIComponent(videoId)}/stream?ticket=${encodeURIComponent(result.ticket)}`, source: result.source };
  }

  async verifyVideoHash(videoId: string): Promise<HashVerifyResult> {
    return this.request(`/videos/${videoId}/verify-hash`, {
      method: 'POST'
    });
  }

  async updateDisputeLock(videoId: string, isLocked: boolean, disputeStatus: string, lockReason?: string): Promise<void> {
    return this.request(`/videos/${videoId}/dispute`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked, disputeStatus, lockReason })
    });
  }

  async forceUnlockStation(stationId: string, reason: string): Promise<void> {
    return this.request(`/stations/${stationId}/force-unlock`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async getSettings(): Promise<{ storageConfigs: any[]; settings: Record<string, string> }> {
    return this.request('/admin/settings');
  }

  async updateSettings(data: { storageConfigs?: any[]; settings?: Record<string, string> }): Promise<void> {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async createStation(data: any): Promise<{ stationId: string }> {
    return this.request('/admin/stations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateStation(id: string, data: any): Promise<{ stationId: string }> {
    return this.request(`/admin/stations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async updateCamera(id: string, data: any): Promise<{ message: string }> {
    return this.request(`/admin/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async testCameraConnection(data: { rtspUrl?: string; ipAddress?: string; port?: number }): Promise<{
    host?: string;
    port?: number;
    reachable: boolean;
    latencyMs: number;
    message: string;
  }> {
    return this.request('/admin/cameras/test', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getLogisticsDashboardStats(timeRange: 'today' | '7days' | '30days' = 'today'): Promise<LogisticsDashboardData> {
    return this.request(`/admin/logistics-dashboard?timeRange=${timeRange}`);
  }

  async getOrders(params?: { search?: string; status?: string; platform?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.platform && params.platform !== 'ALL') query.append('platform', params.platform);
    return this.request(`/orders?${query.toString()}`);
  }

  async seedOrders(): Promise<any> {
    return this.request('/orders/seed', { method: 'POST' });
  }

  async deleteOrder(orderId: string): Promise<any> {
    return this.request(`/orders/${orderId}`, { method: 'DELETE' });
  }

  async manualCompleteOrder(orderId: string, reason?: string): Promise<any> {
    return this.request(`/orders/${orderId}/manual-complete`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async purgeOrders(): Promise<any> {
    return this.request('/orders/purge', { method: 'DELETE' });
  }

  async importOrders(orders: any[]): Promise<any> {
    return this.request('/orders/import', {
      method: 'POST',
      body: JSON.stringify({ orders })
    });
  }

  getTemplateUrl(): string {
    return `${API_BASE}/orders/template`;
  }

  async getStorageOverview(retentionDays: number = 30): Promise<{
    totalVideos: number;
    totalBytes: number;
    expiredVideosCount: number;
    expiredBytes: number;
    lockedVideosCount: number;
  }> {
    return this.request(`/admin/storage/overview?retentionDays=${retentionDays}`);
  }

  async cleanupStorage(retentionDays: number = 30): Promise<{
    deletedVideosCount: number;
    freedBytes: number;
    message: string;
  }> {
    return this.request('/admin/storage/cleanup', {
      method: 'POST',
      body: JSON.stringify({ retentionDays })
    });
  }

  // --- MULTI-TENANT & SUBSCRIPTION SAAS METHODS ---

  async getTenants(search?: string): Promise<TenantRecord[]> {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    return this.request(`/admin/tenants?${query.toString()}`);
  }

  async getTenantStats(): Promise<TenantStats> {
    return this.request('/admin/tenants/stats');
  }

  async getMyQuota(): Promise<TenantQuotaStatus> {
    return this.request('/admin/tenants/my-quota');
  }

  async getTenantById(id: string): Promise<any> {
    return this.request(`/admin/tenants/${id}`);
  }

  async createTenant(data: any): Promise<any> {
    return this.request('/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTenant(id: string, data: any): Promise<any> {
    return this.request(`/admin/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async renewTenant(id: string, months: number = 1): Promise<any> {
    return this.request(`/admin/tenants/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ months })
    });
  }

  async rotateTenantApiKey(id: string): Promise<{ apiKey: string; message: string }> {
    return this.request(`/admin/tenants/${id}/rotate-api-key`, {
      method: 'POST'
    });
  }

  async getStaffUsers(params?: { businessId?: string; warehouseId?: string; search?: string; roleName?: string }): Promise<StaffUser[]> {
    const q = new URLSearchParams();
    if (params?.businessId) q.append('businessId', params.businessId);
    if (params?.warehouseId) q.append('warehouseId', params.warehouseId);
    if (params?.search) q.append('search', params.search);
    if (params?.roleName) q.append('roleName', params.roleName);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/admin/users${qs}`);
  }

  async getRoles(businessId?: string): Promise<RoleRecord[]> {
    const qs = businessId ? `?businessId=${businessId}` : '';
    return this.request(`/admin/roles${qs}`);
  }

  async createStaffUser(data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    phone?: string;
    roleName?: string;
    roleId?: string;
    warehouseId?: string;
    businessId?: string;
  }): Promise<StaffUser> {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateStaffUser(id: string, data: {
    fullName?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    warehouseId?: string;
    isActive?: boolean;
    password?: string;
  }): Promise<StaffUser> {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<any> {
    return this.request(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    });
  }

  // Google Drive Cloud Storage Integration
  async getGoogleDriveStatus(businessId: string): Promise<any> {
    return this.request(`/businesses/${businessId}/google-drive`);
  }

  async disconnectGoogleDrive(businessId: string): Promise<any> {
    return this.request(`/businesses/${businessId}/google-drive`, {
      method: 'DELETE'
    });
  }

  async testSyncGoogleDrive(businessId: string): Promise<any> {
    return this.request(`/businesses/${businessId}/google-drive/test-sync`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async getGoogleAuthUrl(businessId: string): Promise<string> {
    const res = await this.request<{ authUrl: string }>(`/auth/google/url?businessId=${businessId}`);
    return res.authUrl;
  }

  // Camera PTZ / Zoom & Pan Control
  async sendPtzCommand(data: {
    ipAddress?: string;
    action?: 'start' | 'stop';
    code: 'Up' | 'Down' | 'Left' | 'Right' | 'ZoomWide' | 'ZoomTele';
    arg1?: number;
    arg2?: number;
    arg3?: number;
  }): Promise<{ message: string }> {
    const res = await this.request<{ message: string }>('/admin/cameras/ptz-command', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res;
  }
}

export const adminApi = new AdminApiService();
