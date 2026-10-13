import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';
import { RoleName, JwtTokenPayload } from '@packing-proof/shared-types';
import { DatabaseRepository } from '@packing-proof/database';

export const ROLE_HIERARCHY: Record<RoleName, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  WAREHOUSE_MANAGER: 60,
  CUSTOMER_SERVICE: 40,
  PACKING_USER: 20,
  VIEWER: 10
};

/**
 * PreHandler Guard requiring specific roles
 */
export function requireRoles(...allowedRoles: RoleName[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập trước khi thực hiện' }
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Vai trò ${user.role} không có quyền thực hiện thao tác này. Cần một trong các vai trò: ${allowedRoles.join(', ')}`
        }
      });
    }
  };
}

/**
 * Check if caller can assign or grant a target role
 */
export function canAssignRole(callerRole: RoleName, targetRole: RoleName): boolean {
  if (callerRole === 'SUPER_ADMIN') return true;
  if (callerRole === 'ADMIN') {
    // Admin cannot create or elevate anyone to SUPER_ADMIN
    return targetRole !== 'SUPER_ADMIN';
  }
  if (callerRole === 'WAREHOUSE_MANAGER') {
    // Warehouse manager can only assign PACKING_USER or VIEWER
    return targetRole === 'PACKING_USER' || targetRole === 'VIEWER';
  }
  return false;
}

/**
 * Check if caller can edit or delete an existing target user
 */
export function canEditTargetUser(
  caller: JwtTokenPayload,
  targetUser: { id: string; businessId: string; warehouseId?: string | null; roleName?: string; role?: string }
): { allowed: boolean; reason?: string } {
  if (caller.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  // Cross-tenant check
  if (caller.businessId !== targetUser.businessId) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền thao tác trên người dùng của doanh nghiệp khác'
    };
  }

  const targetRole = (targetUser.roleName || targetUser.role || 'PACKING_USER') as RoleName;

  if (caller.role === 'ADMIN') {
    if (targetRole === 'SUPER_ADMIN') {
      return { allowed: false, reason: 'Quản trị viên không được phép chỉnh sửa tài khoản SUPER_ADMIN' };
    }
    return { allowed: true };
  }

  if (caller.role === 'WAREHOUSE_MANAGER') {
    // Cannot edit self to change role, cannot edit other managers or admins
    if (!caller.warehouseId || caller.warehouseId !== targetUser.warehouseId) {
      return { allowed: false, reason: 'Quản lý kho chỉ được quản lý nhân viên thuộc đúng kho của mình' };
    }
    if (targetRole !== 'PACKING_USER' && targetRole !== 'VIEWER') {
      return { allowed: false, reason: 'Quản lý kho chỉ được quản lý nhân viên đóng gói và người xem' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Bạn không có quyền quản lý tài khoản người dùng' };
}

/**
 * Check Business Scope
 */
export function checkBusinessAccess(user: JwtTokenPayload, targetBusinessId: string): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return user.businessId === targetBusinessId;
}

/**
 * Check Warehouse Scope
 * Note: If caller is PACKING_USER or WAREHOUSE_MANAGER, caller MUST have warehouseId assigned.
 * Missing warehouseId does NOT grant system-wide access!
 */
export async function checkWarehouseAccessScoped(
  user: JwtTokenPayload,
  targetWarehouseId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  // ADMIN can access any warehouse owned by their business
  if (user.role === 'ADMIN') {
    const wh = await DatabaseRepository.findWarehouseById(targetWarehouseId);
    if (!wh) {
      return { allowed: false, reason: 'Kho hàng không tồn tại' };
    }
    if (wh.businessId !== user.businessId) {
      return { allowed: false, reason: 'Kho hàng không thuộc doanh nghiệp của bạn' };
    }
    return { allowed: true };
  }

  // WAREHOUSE_MANAGER and PACKING_USER must be assigned to this specific warehouse
  if (user.role === 'WAREHOUSE_MANAGER' || user.role === 'PACKING_USER') {
    if (!user.warehouseId) {
      return { allowed: false, reason: 'Tài khoản chưa được phân bổ kho làm việc cụ thể' };
    }
    if (user.warehouseId !== targetWarehouseId) {
      return { allowed: false, reason: 'Bạn không có quyền thao tác trên kho hàng này' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Vai trò của bạn không có quyền thao tác trên kho hàng' };
}

/**
 * Resolve Station Scope and verify caller has access to it
 */
export async function resolveAndVerifyStationAccess(
  user: JwtTokenPayload,
  stationId: string
): Promise<{ allowed: boolean; station?: any; reason?: string; statusCode?: number }> {
  const station = await DatabaseRepository.findStationById(stationId);
  if (!station) {
    return { allowed: false, statusCode: 404, reason: 'Trạm đóng gói không tồn tại' };
  }

  // 1. Check business scope
  if (user.role !== 'SUPER_ADMIN' && station.businessId && station.businessId !== user.businessId) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Trạm đóng gói thuộc doanh nghiệp khác. Truy cập bị từ chối'
    };
  }

  // 2. Check warehouse scope
  if (user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') {
    if (!user.warehouseId) {
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Tài khoản chưa được phân bổ kho làm việc cụ thể. Không thể thao tác trạm'
      };
    }
    if (station.warehouseId !== user.warehouseId) {
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Trạm đóng gói không thuộc kho bạn được giao quản lý'
      };
    }
  }

  return { allowed: true, station };
}

/**
 * Resolve Station Scope by station code and verify caller has access to it
 */
export async function resolveAndVerifyStationByCode(
  user: JwtTokenPayload,
  stationCode: string
): Promise<{ allowed: boolean; station?: any; reason?: string; statusCode?: number }> {
  const station = await DatabaseRepository.findStationByCode(stationCode);
  if (!station) {
    return { allowed: false, statusCode: 404, reason: `Trạm đóng gói có mã ${stationCode} không tồn tại` };
  }

  // 1. Check business scope
  if (user.role !== 'SUPER_ADMIN' && station.businessId && station.businessId !== user.businessId) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'Trạm đóng gói thuộc doanh nghiệp khác. Truy cập bị từ chối'
    };
  }

  // 2. Check warehouse scope
  if (user.role === 'PACKING_USER' || user.role === 'WAREHOUSE_MANAGER') {
    if (!user.warehouseId) {
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Tài khoản chưa được phân bổ kho làm việc cụ thể. Không thể thao tác trạm'
      };
    }
    if (station.warehouseId !== user.warehouseId) {
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Trạm đóng gói không thuộc kho bạn được giao quản lý'
      };
    }
  }

  return { allowed: true, station };
}

/**
 * Cryptographic Single-Use OAuth State Manager
 */
interface OAuthStateRecord {
  businessId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

class OAuthStateManagerClass {
  private states = new Map<string, OAuthStateRecord>();

  constructor() {
    // Periodically clean up expired states every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.states.entries()) {
        if (now > v.expiresAt) {
          this.states.delete(k);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  generateState(businessId: string, userId: string, ttlSeconds = 600): string {
    const stateToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.states.set(stateToken, {
      businessId,
      userId,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000
    });
    return stateToken;
  }

  consumeState(stateToken: string): { businessId: string; userId: string } | null {
    if (!stateToken || !this.states.has(stateToken)) {
      return null;
    }
    const record = this.states.get(stateToken)!;
    // Single-use: delete immediately
    this.states.delete(stateToken);

    if (Date.now() > record.expiresAt) {
      return null;
    }

    return {
      businessId: record.businessId,
      userId: record.userId
    };
  }
}

export const OAuthStateManager = new OAuthStateManagerClass();
