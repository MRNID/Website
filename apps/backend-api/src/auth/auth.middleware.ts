import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { JwtTokenPayload } from '@packing-proof/shared-types';

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
  try {
    const payload = AuthService.verifyToken(token);
    request.user = payload;
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'TOKEN_EXPIRED_OR_INVALID', message: 'JWT token is invalid or expired' }
    });
  }
}

export function checkWarehouseAccess(user: JwtTokenPayload, targetWarehouseId: string): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return user.warehouseId === targetWarehouseId;
}
