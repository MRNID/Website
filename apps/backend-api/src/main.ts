import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { authRoutes } from './routes/auth.routes.js';
import { packingRoutes } from './routes/packing.routes.js';
import { videoRoutes } from './routes/video.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { mobileRoutes } from './routes/mobile.routes.js';
import { googleDriveRoutes } from './routes/google-drive.routes.js';
import { workerStorageRoutes } from './routes/worker-storage.routes.js';
import { openApiRoutes } from './routes/open-api.routes.js';
import { WorkerGateway } from './websocket/worker-gateway.js';
import { StationGateway } from './websocket/station-gateway.js';
import { AuthService } from './auth/auth.service.js';
import { DatabaseRepository } from '@packing-proof/database';
import { resolveAndVerifyStationAccess, resolveAndVerifyStationByCode } from './auth/authorization.guard.js';
import { RoleName } from '@packing-proof/shared-types';

export async function createServer() {
  const app = Fastify({
    logger: {
      serializers: {
        req: (request) => ({ method: request.method, url: request.url?.split('?')[0], hostname: request.hostname })
      },
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    }
  });

  // 1. CORS
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // 2. Multipart support for Mobile Video Proof uploads (up to 100MB)
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB
    }
  });

  // 3. Health check
  app.get('/health', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // 4. Register Routes
  await app.register(authRoutes);
  await app.register(packingRoutes);
  await app.register(videoRoutes);
  await app.register(tenantRoutes);
  await app.register(userRoutes);
  await app.register(mobileRoutes);
  await app.register(googleDriveRoutes);
  await app.register(openApiRoutes);
  await app.register(workerStorageRoutes);

  return app;
}

async function start() {
  const app = await createServer();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[BackendAPI] REST Server listening on http://${config.host}:${config.port}`);

    // Attach native WebSocket servers to the same HTTP server
    const wssWorker = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    const wssStation = new WebSocketServer({ noServer: true });

    app.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);

      if (url.pathname === '/ws/worker') {
        const stationId = url.searchParams.get('stationId') || '';
        const token = (request.headers['x-worker-token'] as string) || url.searchParams.get('token') || '';

        wssWorker.handleUpgrade(request, socket, head, (ws) => {
          void WorkerGateway.handleConnection(ws, stationId, token).catch(() => ws.close(1011, 'Worker authentication unavailable'));
        });
      } else if (url.pathname === '/ws/station') {
        const token =
          (request.headers['authorization']?.replace(/^Bearer\s+/i, '')) ||
          (request.headers['sec-websocket-protocol']) ||
          url.searchParams.get('token') ||
          '';

        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"UNAUTHORIZED","message":"Yêu cầu token xác thực để kết nối WebSocket trạm"}\r\n');
          socket.destroy();
          return;
        }

        let payload: any;
        try {
          payload = AuthService.verifyToken(token);
        } catch {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"INVALID_TOKEN","message":"Token xác thực không hợp lệ hoặc đã hết hạn"}\r\n');
          socket.destroy();
          return;
        }

        DatabaseRepository.findUserById(payload.sub).then(async (liveUser) => {
          if (!liveUser || !liveUser.isActive) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"ACCOUNT_DEACTIVATED","message":"Tài khoản đã bị khóa hoặc ngừng hoạt động"}\r\n');
            socket.destroy();
            return;
          }

          const userRole = (liveUser.role as RoleName) || payload.role;
          const userBizId = liveUser.businessId || payload.businessId;
          const userWhId = liveUser.warehouseId || null;

          // Operational roles (PACKING_USER, WAREHOUSE_MANAGER) must be assigned to a specific warehouse
          if ((userRole === 'PACKING_USER' || userRole === 'WAREHOUSE_MANAGER') && !userWhId) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"ACCESS_DENIED","message":"Tài khoản chưa được phân bổ kho làm việc cụ thể. Không thể kết nối WebSocket trạm"}\r\n');
            socket.destroy();
            return;
          }

          const requestedStationId = url.searchParams.get('stationId') || '';
          const requestedStationCode = url.searchParams.get('stationCode') || '';
          let resolvedSubscribedStationId: string | null = null;

          // If client requested a specific station (by ID or code), verify access permissions
          if (requestedStationId || requestedStationCode) {
            const stationAccess = requestedStationId
              ? await resolveAndVerifyStationAccess({
                  sub: liveUser.id,
                  username: liveUser.username,
                  role: userRole,
                  businessId: userBizId,
                  warehouseId: userWhId
                }, requestedStationId)
              : await resolveAndVerifyStationByCode({
                  sub: liveUser.id,
                  username: liveUser.username,
                  role: userRole,
                  businessId: userBizId,
                  warehouseId: userWhId
                }, requestedStationCode);

            if (!stationAccess.allowed) {
              const statusCode = stationAccess.statusCode || 403;
              socket.write(`HTTP/1.1 ${statusCode} Forbidden\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{"error":"ACCESS_DENIED","message":"${stationAccess.reason || 'Không có quyền truy cập trạm này'}"}\r\n`);
              socket.destroy();
              return;
            }
            resolvedSubscribedStationId = stationAccess.station?.id || requestedStationId || null;
          }

          wssStation.handleUpgrade(request, socket, head, (ws) => {
            StationGateway.registerClient(ws, {
              userId: liveUser.id,
              username: liveUser.username,
              role: userRole,
              businessId: userBizId,
              warehouseId: userWhId,
              subscribedStationId: resolvedSubscribedStationId
            });
          });
        }).catch((err) => {
          console.error('[WebSocket Upgrade] Error during station auth:', err);
          socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
          socket.destroy();
        });
      } else {
        socket.destroy();
      }
    });

    console.log(`[BackendAPI] WebSocket endpoints ready: /ws/worker and /ws/station`);

    // Customer video retention belongs to the warehouse agent, never the cloud API.

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
