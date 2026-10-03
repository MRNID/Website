import { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import { DatabaseRepository } from '@packing-proof/database';
import { calculateFileSha256 } from '@packing-proof/shared-utils';
import { authenticateUser } from '../auth/auth.middleware.js';

export async function videoRoutes(app: FastifyInstance) {
  // 1. Search Videos
  app.get('/api/v1/videos', { preHandler: [authenticateUser] }, async (request, reply) => {
    const query = request.query as any;
    const filters = {
      trackingCode: query.trackingCode,
      orderCode: query.orderCode,
      warehouseId: query.warehouseId || (request.user?.role !== 'SUPER_ADMIN' ? request.user?.warehouseId || undefined : undefined),
      stationId: query.stationId,
      disputeStatus: query.disputeStatus,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20
    };

    const results = await DatabaseRepository.searchVideos(filters);
    return reply.status(200).send({
      success: true,
      data: results.items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: results.total
      }
    });
  });

  // 2. Stream Video (HTTP 206 Partial Content byte ranges)
  app.get('/api/v1/videos/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };

    const pool = await (await import('@packing-proof/database')).getDbPool();
    const result = await pool.request()
      .input('id', (await import('@packing-proof/database')).sql.VarChar(36), id)
      .query('SELECT * FROM videos WHERE id = @id');

    const video = result.recordset[0];
    if (!video) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } });
    }

    const videoPath = (video.sync_status === 'SYNCED' && video.nas_path && fs.existsSync(video.nas_path))
      ? video.nas_path
      : video.local_path;

    if (!fs.existsSync(videoPath)) {
      return reply.status(503).send({
        success: false,
        error: { code: 'VIDEO_FILE_UNAVAILABLE', message: 'Video physical file is currently inaccessible' }
      });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = request.headers.range;

    reply.hijack();

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      reply.raw.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });
      file.pipe(reply.raw);
    } else {
      reply.raw.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(videoPath).pipe(reply.raw);
    }
  });

  // 3. Dispute Lock
  app.patch('/api/v1/videos/:id/dispute', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { isLocked, disputeStatus, lockReason } = request.body as any;
    const user = request.user!;

    const success = await DatabaseRepository.setDisputeLock(id, Boolean(isLocked), disputeStatus, user.sub, lockReason);
    if (!success) {
      return reply.status(409).send({
        success: false,
        error: { code: 'VIDEO_ALREADY_PURGED_OR_PURGE_IN_PROGRESS', message: 'Video has already been purged or is currently being purged' }
      });
    }

    return reply.status(200).send({
      success: true,
      data: { id, isLocked: Boolean(isLocked), disputeStatus }
    });
  });

  // 4. Verify Hash
  app.post('/api/v1/videos/:id/verify-hash', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const pool = await (await import('@packing-proof/database')).getDbPool();
    const result = await pool.request()
      .input('id', (await import('@packing-proof/database')).sql.VarChar(36), id)
      .query('SELECT * FROM videos WHERE id = @id');

    const video = result.recordset[0];
    if (!video) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } });
    }

    const targetPath = (video.sync_status === 'SYNCED' && video.nas_path && fs.existsSync(video.nas_path))
      ? video.nas_path
      : video.local_path;

    if (!fs.existsSync(targetPath)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Physical video file is missing on storage' }
      });
    }

    const calculatedHash = await calculateFileSha256(targetPath);
    const isMatch = calculatedHash.toLowerCase() === video.sha256.toLowerCase();

    return reply.status(200).send({
      success: true,
      data: {
        videoId: id,
        dbHash: video.sha256,
        calculatedHash,
        isMatch,
        verifiedAt: new Date().toISOString()
      }
    });
  });
}
