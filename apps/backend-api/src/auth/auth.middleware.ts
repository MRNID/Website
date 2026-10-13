import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { JwtTokenPayload, RoleName } from '@packing-proof/shared-types';
import { DatabaseRepository } from '@packing-proof/database';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtTokenPayload;
  }
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }
    });
  }

  const token = authHeader.substring(7);
  let payload: JwtTokenPayload;
  try {
    payload = AuthService.verifyToken(token);
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'TOKEN_EXPIRED_OR_INVALID', message: 'JWT token is invalid or expired' }
    });
  }

  // Live session-state verification against database:
  // Guarantees account locking, deactivation, or role/warehouse downgrade immediately
  // revokes or restricts active sessions without waiting for token expiry.
  try {
    const liveUser = await DatabaseRepository.findUserById(payload.sub);
    if (!liveUser || !liveUser.isActive) {
      return reply.status(401).send({
        success: false,
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'Tài khoản đã bị khóa hoặc ngừng hoạt động' }
      });
    }

    request.user = {
      ...payload,
      role: (liveUser.role as RoleName) || payload.role,
      businessId: liveUser.businessId || payload.businessId,
      warehouseId: liveUser.warehouseId || null
    };
  } catch (err: any) {
    console.error('[authenticateUser] Error checking live user status:', err.message);
    return reply.status(500).send({
      success: false,
      error: { code: 'AUTH_VERIFICATION_ERROR', message: 'Lỗi xác thực phiên người dùng' }
    });
  }
}

export function checkWarehouseAccess(user: JwtTokenPayload, targetWarehouseId: string): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return user.warehouseId === targetWarehouseId;
}
