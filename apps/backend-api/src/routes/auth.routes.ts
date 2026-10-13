import { FastifyInstance } from 'fastify';
import { DatabaseRepository } from '@packing-proof/database';
import { AuthService } from '../auth/auth.service.js';
import { authenticateUser } from '../auth/auth.middleware.js';

export async function authRoutes(app: FastifyInstance) {
  // 1. Login
  app.post('/api/v1/auth/login', async (request, reply) => {
    const { username, password } = request.body as any;

    if (!username || !password) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Username and password are required' }
      });
    }

    const user = await DatabaseRepository.findUserByUsername(username);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'User not found or inactive' }
      });
    }

    const isValid = AuthService.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password' }
      });
    }

    const tokens = AuthService.generateTokens({
      sub: user.id,
      username: user.username,
      businessId: user.business_id,
      warehouseId: user.warehouse_id,
      role: user.role_name
    });

    return reply.status(200).send({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          businessId: user.business_id,
          warehouseId: user.warehouse_id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role_name
        }
      }
    });
  });

  // 2. Refresh Token
  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Refresh token is required' }
      });
    }

    try {
      const decoded = AuthService.verifyRefreshToken(refreshToken);
      const user = await DatabaseRepository.findUserById(decoded.sub);
      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User account no longer exists' }
        });
      }

      const tokens = AuthService.generateTokens({
        sub: user.id,
        username: user.username,
        businessId: user.businessId,
        warehouseId: user.warehouseId,
        role: user.role
      });

      return reply.status(200).send({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      });
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Refresh token expired or invalid' }
      });
    }
  });

  // 3. Me
  app.get('/api/v1/auth/me', { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = await DatabaseRepository.findUserById(request.user!.sub);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User profile not found' }
      });
    }
    return reply.status(200).send({
      success: true,
      data: user
    });
  });
}
