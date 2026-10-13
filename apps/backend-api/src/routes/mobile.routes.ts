import { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { CustomerStorageRepository } from '@packing-proof/database';
import { validateAndCleanBarcode } from '@packing-proof/shared-utils';
import { LocalVideo, RELAY_CHUNK_BYTES } from '@packing-proof/shared-types';
import { authenticateUser } from '../auth/auth.middleware.js';
import { requireRoles, resolveAndVerifyStationByCode } from '../auth/authorization.guard.js';
import { WorkerGateway } from '../websocket/worker-gateway.js';
import { CustomerStorageService, storageError } from '../services/customer-storage.service.js';

export async function mobileRoutes(app: FastifyInstance) {
  // Bound transient RAM. The cloud never writes the phone video to its filesystem.
  let activeUploads = 0;
  app.post('/api/v1/mobile/upload', {
    preHandler: [authenticateUser, requireRoles('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER')]
  }, async (request, reply) => {
    if (activeUploads >= 2) return reply.status(429).send({ success: false, error: { code: 'UPLOAD_BUSY', message: 'Đang có lượt tải khác, hãy giữ video và thử lại.' } });
    activeUploads++;
    let disconnected = false;
    const onClose = () => { if (!reply.raw.writableEnded) disconnected = true; };
    reply.raw.on('close', onClose);
    try {
      const fields: Record<string, string> = {};
      let bytes: Buffer | undefined;
      let filename = '';
      for await (const part of request.parts({ limits: { files: 1, fields: 8, fileSize: 100 * 1024 * 1024 } })) {
        if (part.type === 'file') { filename = part.filename; bytes = await part.toBuffer(); }
        else fields[part.fieldname] = String(part.value);
      }
      if (!bytes?.length) throw storageError('Không nhận được dữ liệu video');
      const stationCode = (fields.stationCode || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,30}$/.test(stationCode)) throw storageError('Mã trạm không hợp lệ');
      const access = await resolveAndVerifyStationByCode(request.user!, stationCode);
      if (!access.allowed) throw storageError(access.reason || 'Không có quyền tại trạm', access.statusCode || 403);
      const station = access.station!;
      const barcode = validateAndCleanBarcode(fields.trackingCode || '');
      if (!barcode.isValid) throw storageError('Mã vận đơn không hợp lệ');
      const ext = /\.(mp4|webm|mkv|mov)$/i.exec(filename)?.[0].toLowerCase();
      if (!ext) throw storageError('Chỉ hỗ trợ video mp4, webm, mkv hoặc mov');
      const sessionId = fields.uploadId || randomUUID();
      if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw storageError('Upload ID không hợp lệ');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const existing = await CustomerStorageRepository.findVideo(sessionId, true);
      if (existing) {
        if (existing.station_id !== station.id || existing.user_id !== request.user!.sub || existing.sha256 !== sha256) throw storageError('Upload ID đã được sử dụng', 409);
        if (WorkerGateway.isWorkerConnected(station.id)) {
          const checked = await WorkerGateway.requestStorage(station.id, 'FILE_HASH', { sessionId }, 120000);
          if (checked.sha256 !== sha256) throw storageError('Bản tại kho không khớp. Giữ video trên điện thoại.', 409);
        } else if (existing.sync_status === 'SYNCED' && existing.drive_file_id) {
          await CustomerStorageService.completeDrive(station.id, sessionId);
        } else throw storageError('Chưa xác nhận được bản tại kho. Giữ video và thử lại khi máy kho kết nối.', 503);
        return { success: true, sessionId, videoId: existing.id, sha256, fileSize: bytes.length, purgeAllowed: true, storageOwner: 'WAREHOUSE' };
      }
      if (!WorkerGateway.isWorkerConnected(station.id)) throw storageError('Máy kho đang ngoại tuyến. Giữ video trên điện thoại và thử lại khi máy kho kết nối.', 503);
      const video: LocalVideo = {
        sessionId, filename: `${barcode.cleanedCode}_${stationCode}_${sessionId}${ext}`,
        localPath: 'assigned-by-warehouse-worker', sha256, fileSize: bytes.length,
        duration: Math.max(1, Math.min(86400, Number(fields.duration) || 1)),
        mobile: { userId: request.user!.sub, trackingCode: barcode.cleanedCode, orderCode: fields.orderCode || barcode.cleanedCode, platform: barcode.platform }
      };
      const begun = await WorkerGateway.requestStorage(station.id, 'UPLOAD_BEGIN', video);
      let offset = begun.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > bytes.length) throw storageError('Máy kho trả về vị trí tải không hợp lệ', 503);
      while (offset < bytes.length) {
        if (disconnected) throw storageError('Điện thoại đã ngắt kết nối', 499);
        const chunk = bytes.subarray(offset, offset + RELAY_CHUNK_BYTES);
        const response = await WorkerGateway.requestStorage(station.id, 'UPLOAD_CHUNK', { sessionId, offset, data: chunk.toString('base64') });
        if (response.offset !== offset + chunk.length) throw storageError('Máy kho chưa xác nhận đủ dữ liệu', 503);
        offset = response.offset;
      }
      const saved: LocalVideo = await WorkerGateway.requestStorage(station.id, 'UPLOAD_COMMIT', { sessionId }, 120000);
      if (saved.sessionId !== sessionId || saved.sha256 !== sha256 || saved.fileSize !== bytes.length || saved.mobile?.userId !== request.user!.sub) throw storageError('Xác nhận từ máy kho không khớp video', 409);
      const videoId = await CustomerStorageService.register(station.id, saved);
      return { success: true, sessionId, videoId, sha256, fileSize: bytes.length, duration: video.duration, purgeAllowed: true, storageOwner: 'WAREHOUSE', message: 'Video đã lưu và kiểm tra tại máy kho. Bản sao Drive đang chờ đồng bộ.' };
    } catch (err: any) {
      return reply.status(err.statusCode || 503).send({ success: false, purgeAllowed: false, error: { code: 'WAREHOUSE_UPLOAD_FAILED', message: err.message || 'Chưa lưu được video tại kho. Hãy giữ bản trên điện thoại.' } });
    } finally {
      reply.raw.off('close', onClose);
      activeUploads--;
    }
  });
}
