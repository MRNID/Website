const API_BASE = 'http://localhost:4000/api/v1';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  warehouseId?: string;
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

export interface HashVerifyResult {
  videoId: string;
  dbHash: string;
  calculatedHash: string;
  isMatch: boolean;
  verifiedAt: string;
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
      'Content-Type': 'application/json',
      ...(options.headers as any),
    };

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

  async getStations(): Promise<any[]> {
    return this.request('/stations');
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

  getVideoStreamUrl(videoId: string): string {
    return `${API_BASE}/videos/${videoId}/stream`;
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
}

export const adminApi = new AdminApiService();
