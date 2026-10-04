import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { authRoutes } from './routes/auth.routes.js';
import { packingRoutes } from './routes/packing.routes.js';
import { videoRoutes } from './routes/video.routes.js';
import { WorkerGateway } from './websocket/worker-gateway.js';
import { StationGateway } from './websocket/station-gateway.js';

export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    }
  });

  // 1. CORS
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // 2. Health check
  app.get('/health', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // 3. Register Routes
  await app.register(authRoutes);
  await app.register(packingRoutes);
  await app.register(videoRoutes);

  return app;
}

async function start() {
  const app = await createServer();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[BackendAPI] REST Server listening on http://${config.host}:${config.port}`);

    // Attach native WebSocket servers to the same HTTP server
    const wssWorker = new WebSocketServer({ noServer: true });
    const wssStation = new WebSocketServer({ noServer: true });

    app.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);

      if (url.pathname === '/ws/worker') {
        const stationId = url.searchParams.get('stationId') || '';
        const token = (request.headers['x-worker-token'] as string) || url.searchParams.get('token') || '';

        wssWorker.handleUpgrade(request, socket, head, (ws) => {
          WorkerGateway.handleConnection(ws, stationId, token);
        });
      } else if (url.pathname === '/ws/station') {
        wssStation.handleUpgrade(request, socket, head, (ws) => {
          StationGateway.registerClient(ws);
        });
      } else {
        socket.destroy();
      }
    });

    console.log(`[BackendAPI] WebSocket endpoints ready: /ws/worker and /ws/station`);

    // Schedule periodic storage retention cleanup daemon (every 12 hours)
    setInterval(async () => {
      try {
        const { DatabaseRepository } = await import('@packing-proof/database');
        const settings = await DatabaseRepository.getSystemSettings();
        const days = parseInt(settings.settings['retentionDays'] || '30', 10);
        const res = await DatabaseRepository.cleanupExpiredVideos(days);
        if (res.deletedVideosCount > 0) {
          console.log(`[RetentionDaemon] Auto-cleaned ${res.deletedVideosCount} expired videos, freed ${(res.freedBytes / (1024 * 1024)).toFixed(2)} MB`);
        }
      } catch (err) {
        console.error('[RetentionDaemon] Background cleanup error:', err);
      }
    }, 12 * 60 * 60 * 1000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
