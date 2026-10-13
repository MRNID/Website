import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { DatabaseRepository, CustomerStorageRepository } from '@packing-proof/database';
import { CustomerStorageService } from '../services/customer-storage.service.js';

declare module 'fastify' { interface FastifyRequest { workerStationId?: string } }

export async function authenticateWorker(request: FastifyRequest, reply: FastifyReply) {
  const stationId = request.headers['x-worker-station'];
  const token = request.headers['x-worker-token'];
  if (typeof stationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(stationId) || typeof token !== 'string' || token.length < 32 ||
      !await DatabaseRepository.verifyWorkerToken(stationId, createHash('sha256').update(token).digest('hex'))) {
    return reply.status(401).send({ success: false, error: { code: 'WORKER_UNAUTHORIZED', message: 'Thông tin xác thực máy kho không hợp lệ' } });
  }
  request.workerStationId = stationId;
}

export async function workerStorageRoutes(app: FastifyInstance) {
  const routes: Record<string, (request: FastifyRequest) => Promise<any>> = {
    '/videos/register': async request => ({ videoId: await CustomerStorageService.register(request.workerStationId!, request.body as any) }),
    '/videos/:sessionId/drive-upload': async request => CustomerStorageService.prepareDrive(request.workerStationId!, (request.params as any).sessionId),
    '/videos/:sessionId/drive-complete': async request => {
      await CustomerStorageService.completeDrive(request.workerStationId!, (request.params as any).sessionId);
      return { synced: true };
    },
    '/videos/:sessionId/drive-failed': async request => {
      const video = await CustomerStorageService.workerVideo(request.workerStationId!, (request.params as any).sessionId);
      const message = String((request.body as any)?.message || 'Đồng bộ lỗi').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
      await CustomerStorageRepository.setDriveState(video.id, request.workerStationId!, 'FAILED', message);
      return { retryAllowed: true };
    }
  };
  for (const [route, handler] of Object.entries(routes)) {
    app.post('/api/v1/worker' + route, { preHandler: [authenticateWorker] }, async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      try { return { success: true, data: await handler(request) }; }
      catch (err: any) { return reply.status(err.statusCode || 503).send({ success: false, error: { code: 'CUSTOMER_STORAGE_ERROR', message: err.message } }); }
    });
  }
}
