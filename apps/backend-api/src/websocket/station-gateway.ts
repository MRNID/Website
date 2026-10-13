import { WebSocket } from 'ws';
import { RoleName } from '@packing-proof/shared-types';
import { DatabaseRepository } from '@packing-proof/database';

export interface StationClientMetadata {
  userId: string;
  username: string;
  role: RoleName;
  businessId: string;
  warehouseId?: string | null;
  subscribedStationId?: string | null;
}

interface ConnectedStationClient extends StationClientMetadata {
  ws: WebSocket;
  registeredAt: number;
  lastVerifiedAt: number;
}

export interface StationScopeCache {
  id: string;
  code: string;
  warehouseId: string;
  businessId?: string;
  cachedAt: number;
}

export class StationGateway {
  private static clients: Map<WebSocket, ConnectedStationClient> = new Map();
  private static stationCache: Map<string, StationScopeCache> = new Map();
  private static revalidationInterval: NodeJS.Timeout | null = null;

  static {
    // Start periodic background verification every 15 seconds
    this.revalidationInterval = setInterval(() => {
      this.revalidateAllClients().catch((err) => {
        console.error('[StationGateway] Revalidation error:', err);
      });
    }, 15000);
    if (this.revalidationInterval.unref) {
      this.revalidationInterval.unref();
    }
  }

  /**
   * Register an authenticated WebSocket client with tenant & warehouse scoping metadata
   */
  static registerClient(ws: WebSocket, metadata: StationClientMetadata): void {
    const client: ConnectedStationClient = {
      ...metadata,
      ws,
      registeredAt: Date.now(),
      lastVerifiedAt: Date.now()
    };

    this.clients.set(ws, client);

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });

    // Send initial connection acknowledgement with assigned scope
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'CONNECTION_AUTHENTICATED',
        data: {
          userId: metadata.userId,
          role: metadata.role,
          businessId: metadata.businessId,
          warehouseId: metadata.warehouseId,
          subscribedStationId: metadata.subscribedStationId
        },
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Revoke and immediately disconnect all active WebSocket sessions for a specific user ID.
   * Triggered when account is locked, password reset, or permissions/roles change.
   */
  static revokeUser(userId: string, reason: string = 'ACCOUNT_REVOKED_OR_ROLE_CHANGED'): void {
    for (const [ws, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'AUTH_REVOKED',
              data: { reason },
              timestamp: new Date().toISOString()
            }));
            ws.close(4001, reason);
          }
        } catch {
          // ignore error on close
        }
        this.clients.delete(ws);
      }
    }
  }

  /**
   * Resolve station scoping information (with 60-second in-memory cache)
   */
  static async resolveStationScope(stationIdOrCode: string): Promise<StationScopeCache | null> {
    const now = Date.now();
    const cached = this.stationCache.get(stationIdOrCode);
    if (cached && now - cached.cachedAt < 60000) {
      return cached;
    }

    try {
      let st: any = null;
      if (stationIdOrCode.includes('-')) {
        st = await DatabaseRepository.findStationById(stationIdOrCode);
      }
      if (!st) {
        st = await DatabaseRepository.findStationByCode(stationIdOrCode);
      }
      if (!st && !stationIdOrCode.includes('-')) {
        st = await DatabaseRepository.findStationById(stationIdOrCode);
      }

      if (st) {
        const entry: StationScopeCache = {
          id: st.id,
          code: st.code,
          warehouseId: st.warehouseId,
          businessId: st.businessId,
          cachedAt: now
        };
        this.stationCache.set(st.id, entry);
        this.stationCache.set(st.code, entry);
        return entry;
      }
    } catch (err: any) {
      console.warn('[StationGateway] Error resolving station scope:', err.message);
    }

    return null;
  }

  /**
   * Periodically recheck all connected clients against live database state.
   * Immediately terminates connections if user account was locked or deactivated.
   */
  private static async revalidateAllClients(): Promise<void> {
    if (this.clients.size === 0) return;

    for (const [ws, client] of this.clients.entries()) {
      try {
        const liveUser = await DatabaseRepository.findUserById(client.userId);
        if (!liveUser || !liveUser.isActive) {
          console.log(`[StationGateway] Disconnecting locked/deactivated user ${client.username} (${client.userId})`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'AUTH_REVOKED',
              data: { reason: 'Tài khoản đã bị khóa hoặc ngừng hoạt động' },
              timestamp: new Date().toISOString()
            }));
            ws.close(4001, 'Tài khoản bị khóa');
          }
          this.clients.delete(ws);
          continue;
        }

        // If role or warehouse assignment changed in database, revoke session to re-authenticate
        if (
          liveUser.role !== client.role ||
          (liveUser.warehouseId || null) !== (client.warehouseId || null) ||
          (liveUser.businessId || '') !== (client.businessId || '')
        ) {
          console.log(`[StationGateway] Disconnecting user ${client.username} due to role/scope change`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'AUTH_REVOKED',
              data: { reason: 'Quyền hạn hoặc kho phân bổ đã thay đổi' },
              timestamp: new Date().toISOString()
            }));
            ws.close(4001, 'Phân quyền thay đổi');
          }
          this.clients.delete(ws);
          continue;
        }

        client.lastVerifiedAt = Date.now();
      } catch (err: any) {
        console.warn(`[StationGateway] Error revalidating user ${client.userId}:`, err.message);
      }
    }
  }

  /**
   * Broadcast an event strictly scoped by business, warehouse, and station.
   * If scope or scope.businessId is missing, event is dropped to prevent cross-tenant data leakage.
   */
  static async broadcast(
    event: string,
    data: any,
    scope?: { businessId?: string; warehouseId?: string; stationId?: string }
  ): Promise<void> {
    if (!scope || !scope.businessId) {
      console.warn(`[StationGateway] Broadcast of "${event}" dropped: missing required businessId scope`);
      return;
    }

    const payload = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });

    for (const [ws, client] of this.clients.entries()) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      // 1. Cross-tenant isolation: client must match event's businessId (SUPER_ADMIN can observe system-wide)
      if (client.role !== 'SUPER_ADMIN') {
        if (client.businessId !== scope.businessId) {
          // Strictly reject cross-business event delivery
          continue;
        }
      }

      // 2. Warehouse scoping for operational roles (PACKING_USER, WAREHOUSE_MANAGER)
      // Operational roles MUST be assigned to a warehouse, and must match event's warehouseId
      if (client.role === 'WAREHOUSE_MANAGER' || client.role === 'PACKING_USER') {
        if (!client.warehouseId) {
          // Unassigned operational staff receives no warehouse-scoped operational events
          continue;
        }
        if (scope.warehouseId && client.warehouseId !== scope.warehouseId) {
          // Strictly reject cross-warehouse event delivery
          continue;
        }
      }

      // 3. Station subscription check (if client subscribed to a specific station)
      if (client.subscribedStationId && scope.stationId) {
        if (client.subscribedStationId !== scope.stationId) {
          continue;
        }
      }

      // Send strictly scoped event
      ws.send(payload);
    }
  }

  /**
   * Broadcast packing session state changed with automatic station and warehouse scope resolution.
   * Aborts immediately if station scope or businessId cannot be resolved.
   */
  static async broadcastSessionState(
    sessionId: string,
    stationId: string,
    status: string,
    trackingCode?: string,
    details?: any
  ): Promise<void> {
    const stScope = await this.resolveStationScope(stationId);

    const businessId = details?.businessId || stScope?.businessId;
    const warehouseId = details?.warehouseId || stScope?.warehouseId;
    const resolvedStationId = stScope?.id || stationId;

    if (!businessId) {
      console.warn(`[StationGateway] broadcastSessionState aborted: unable to resolve business scope for station ${stationId}`);
      return;
    }

    await this.broadcast(
      'SESSION_STATE_CHANGED',
      {
        sessionId,
        stationId: resolvedStationId,
        stationCode: stScope?.code || details?.stationCode,
        status,
        trackingCode,
        ...details
      },
      {
        businessId,
        warehouseId,
        stationId: resolvedStationId
      }
    );
  }

  /**
   * Return number of currently connected authenticated clients
   */
  static getConnectedCount(): number {
    return this.clients.size;
  }
}
