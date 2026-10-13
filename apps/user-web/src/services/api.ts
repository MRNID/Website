import { API_BASE } from './endpoints';

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  role: string;
  warehouseId?: string;
  accessToken: string;
}

export interface StationInfo {
  id: string;
  code: string;
  name: string;
  status: string;
  lastHeartbeatAt?: string;
  camera?: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
}

export interface ActiveSessionData {
  stationId: string;
  stationStatus: string;
  activeSession: {
    sessionId: string;
    status: string;
    startTime: string;
    elapsedSeconds: number;
  } | null;
  worker: {
    status: string;
  };
}

export interface BarcodeValidationResult {
  isValid: boolean;
  platform: string;
  cleanedCode: string;
  orderCode?: string;
  isDuplicate: boolean;
  previousPackedAt?: string;
  customer?: {
    customerName?: string;
    phone?: string;
    address?: string;
    note?: string;
    items?: Array<{ sku: string; name: string; quantity: number; price?: number }>;
  };
}

class ApiService {
  private token: string | null = localStorage.getItem('token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
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

  async login(username: string, password: string): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    const session: UserSession = {
      ...json.data.user,
      accessToken: json.data.accessToken
    };
    this.setToken(session.accessToken);
    return session;
  }

  async getCurrentUser(): Promise<any> {
    return this.request('/auth/me');
  }

  async getStations(): Promise<StationInfo[]> {
    return this.request('/stations');
  }

  async getStationActive(stationId: string): Promise<ActiveSessionData> {
    return this.request(`/packing/stations/${stationId}/active`);
  }

  async getRecentSessions(stationId: string, limit = 10): Promise<any[]> {
    return this.request(`/packing/stations/${stationId}/recent?limit=${limit}`);
  }

  async validateBarcode(trackingCode: string, stationId: string): Promise<BarcodeValidationResult> {
    return this.request('/packing/validate-barcode', {
      method: 'POST',
      body: JSON.stringify({ trackingCode, stationId })
    });
  }

  async startPacking(params: {
    stationId: string;
    trackingCode: string;
    orderCode?: string;
    platform?: string;
  }): Promise<{ sessionId: string; status: string }> {
    return this.request('/packing/start', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async stopPacking(sessionId: string): Promise<{ sessionId: string; status: string }> {
    return this.request('/packing/stop', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }

  async cancelPacking(sessionId: string, reason?: string): Promise<{ sessionId: string; status: string }> {
    return this.request('/packing/cancel', {
      method: 'POST',
      body: JSON.stringify({ sessionId, reason })
    });
  }

  async forceUnlock(stationId: string, reason: string): Promise<void> {
    return this.request(`/stations/${stationId}/force-unlock`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async getOrders(): Promise<any[]> {
    return this.request('/orders');
  }

  async seedOrders(): Promise<any> {
    return this.request('/orders/seed', { method: 'POST' });
  }
}

export const api = new ApiService();
