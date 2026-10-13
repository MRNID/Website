import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { DatabaseRepository, CustomerStorageRepository } from '@packing-proof/database';
import { videoMimeType } from '@packing-proof/shared-types';
import { authenticateUser } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { requireRoles } from '../auth/authorization.guard.js';
import { WorkerGateway } from '../websocket/worker-gateway.js';
import { CustomerStorageService, storageError } from '../services/customer-storage.service.js';
import { GoogleDriveService } from '../services/google-drive.service.js';
import { canReadVideo, parseVideoRange, warehouseVideoStream } from '../services/video-playback.service.js';

async function accessibleVideo(request: FastifyRequest): Promise<any> {
  const video = await CustomerStorageRepository.findVideo((request.params as any).id);
  if (!video || !canReadVideo(request.user!, video)) throw storageError('Không tìm thấy video hoặc bạn không có quyền xem', 404);
  return video;
}

function failure(reply: FastifyReply, error: any) {
  return reply.status(error.statusCode || 503).send({ success: false, error: { code: 'VIDEO_UNAVAILABLE', message: error.message } });
}

async function authenticatePlayback(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.authorization) return authenticateUser(request, reply);
  try {
    const { sub } = AuthService.verifyPlaybackTicket((request.query as any).ticket || '', (request.params as any).id);
    const user = await DatabaseRepository.findUserById(sub);
    if (!user?.isActive) throw new Error('Account inactive');
    request.user = { sub: user.id, username: user.username, role: user.role, businessId: user.businessId, warehouseId: user.warehouseId || null };
  } catch {
    return reply.status(401).send({ success: false, error: { code: 'PLAYBACK_AUTH_REQUIRED', message: 'Vui lòng đăng nhập và mở lại video.' } });
  }
}

export async function videoRoutes(app: FastifyInstance) {
  app.get('/api/v1/videos/:id', { preHandler: [authenticateUser] }, async (request, reply) => {
    try { return { success: true, data: await accessibleVideo(request) }; }
    catch (err) { return failure(reply, err); }
  });
  app.get('/api/v1/videos', { preHandler: [authenticateUser] }, async (request, reply) => {
    const query = request.query as any;
    const user = request.user!;
    const warehouseScoped = ['PACKING_USER', 'WAREHOUSE_MANAGER'].includes(user.role);
    if (warehouseScoped && !user.warehouseId) return reply.status(403).send({ success: false, error: { message: 'Tài khoản chưa được phân bổ kho' } });
    const filters = {
      businessId: user.role === 'SUPER_ADMIN' ? undefined : user.businessId,
      trackingCode: query.trackingCode, orderCode: query.orderCode,
      warehouseId: warehouseScoped ? user.warehouseId! : query.warehouseId,
      stationId: query.stationId, disputeStatus: query.disputeStatus,
      page: Math.max(1, Number(query.page) || 1), limit: Math.min(100, Math.max(1, Number(query.limit) || 20))
    };
    const results = await DatabaseRepository.searchVideos(filters);
    return { success: true, data: results.items, pagination: { page: filters.page, limit: filters.limit, total: results.total } };
  });

  app.post('/api/v1/videos/:id/playback', { preHandler: [authenticateUser] }, async (request, reply) => {
    try {
      const video = await accessibleVideo(request);
      const availableAtWarehouse = video.storage_owner === 'WORKER' && WorkerGateway.isWorkerConnected(video.station_id);
      if (!availableAtWarehouse && !(video.drive_file_id && video.sync_status === 'SYNCED')) throw storageError('Máy kho đang ngoại tuyến và chưa có bản sao Drive đã xác nhận.', 503);
      const ticket = AuthService.createPlaybackTicket(request.user!.sub, video.id);
      reply.header('Cache-Control', 'no-store');
      return { success: true, data: { ticket, expiresIn: 900, source: availableAtWarehouse ? 'WAREHOUSE' : 'GOOGLE_DRIVE' } };
    } catch (err) { return failure(reply, err); }
  });

  app.get('/api/v1/videos/:id/stream', { preHandler: [authenticatePlayback] }, async (request, reply) => {
    try {
      const video = await accessibleVideo(request);
      const size = Number(video.file_size);
      let range;
      try { range = parseVideoRange(request.headers.range, size); }
      catch (err) { reply.header('Content-Range', `bytes */${size}`); throw err; }
      let stream: Readable | undefined;
      if (video.storage_owner === 'WORKER' && WorkerGateway.isWorkerConnected(video.station_id)) {
        try {
          const stat = await WorkerGateway.requestStorage(video.station_id, 'FILE_STAT', { sessionId: video.packing_session_id });
          if (stat.size !== size) throw storageError('Dung lượng bản tại kho đã thay đổi', 409);
          stream = warehouseVideoStream(video.station_id, video.packing_session_id, range.start, range.end);
        } catch (err) {
          if (!video.drive_file_id || video.sync_status !== 'SYNCED') throw err;
        }
      }
      if (!stream) {
        if (!video.drive_file_id || video.sync_status !== 'SYNCED') throw storageError('Video chưa có trên Drive; hãy bật máy kho để xem.', 503);
        const { accessToken } = await CustomerStorageService.driveAccess(video);
        CustomerStorageService.verifyDriveCopy(video, await GoogleDriveService.getFileMetadata(accessToken, video.drive_file_id));
        const remote = await GoogleDriveService.downloadRange(accessToken, video.drive_file_id, range.start, range.end);
        if (!remote.body || Number(remote.headers.get('content-length')) !== range.end - range.start + 1) {
          await remote.body?.cancel();
          throw storageError('Drive trả về dung lượng không khớp', 503);
        }
        stream = Readable.fromWeb(remote.body as any);
      }
      reply.header('Cache-Control', 'private, no-store').header('Referrer-Policy', 'no-referrer')
        .header('Accept-Ranges', 'bytes').header('Content-Length', range.end - range.start + 1)
        .type(videoMimeType(video.filename));
      if (range.partial) reply.code(206).header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      return reply.send(stream);
    } catch (err) { return failure(reply, err); }
  });

  app.patch('/api/v1/videos/:id/dispute', { preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'CUSTOMER_SERVICE')] }, async (request, reply) => {
    try {
      const video = await accessibleVideo(request);
      const { isLocked, disputeStatus, lockReason } = request.body as any;
      if (!['NONE', 'UNDER_REVIEW', 'SUBMITTED_TO_CARRIER', 'WON', 'LOST', 'NORMAL', 'DISPUTE', 'RESOLVED'].includes(disputeStatus)) throw storageError('Trạng thái khiếu nại không hợp lệ');
      const success = await DatabaseRepository.setDisputeLock(video.id, Boolean(isLocked), disputeStatus, request.user!.sub, lockReason);
      if (!success) throw storageError('Video đang được xử lý hoặc đã xóa', 409);
      return { success: true, data: { id: video.id, isLocked: Boolean(isLocked), disputeStatus } };
    } catch (err) { return failure(reply, err); }
  });

  app.post('/api/v1/videos/:id/verify-hash', { preHandler: [authenticateUser] }, async (request, reply) => {
    try {
      const video = await accessibleVideo(request);
      let calculatedHash: string;
      let source: string;
      if (video.storage_owner === 'WORKER' && WorkerGateway.isWorkerConnected(video.station_id)) {
        const result = await WorkerGateway.requestStorage(video.station_id, 'FILE_HASH', { sessionId: video.packing_session_id }, 120000);
        calculatedHash = result.sha256;
        source = 'WAREHOUSE';
      } else {
        if (!video.drive_file_id || video.sync_status !== 'SYNCED') throw storageError('Hãy bật máy kho để xác minh bản gốc.', 503);
        const { accessToken } = await CustomerStorageService.driveAccess(video);
        const remote = await GoogleDriveService.getFileMetadata(accessToken, video.drive_file_id);
        if (!remote || remote.trashed || !remote.sha256Checksum) throw storageError('Chưa đọc được mã băm từ Drive', 503);
        calculatedHash = remote.sha256Checksum;
        source = 'GOOGLE_DRIVE';
      }
      return { success: true, data: { videoId: video.id, dbHash: video.sha256, calculatedHash, isMatch: calculatedHash.toLowerCase() === video.sha256.toLowerCase(), source, verifiedAt: new Date().toISOString() } };
    } catch (err) { return failure(reply, err); }
  });
}
