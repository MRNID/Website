import { DatabaseRepository, CustomerStorageRepository } from '@packing-proof/database';
import { LocalVideo, videoMimeType } from '@packing-proof/shared-types';
import { GoogleDriveService } from './google-drive.service.js';
import { StationGateway } from '../websocket/station-gateway.js';

export function storageError(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

export function validateLocalVideo(video: LocalVideo): void {
  if (!video || !/^[a-f0-9-]{36}$/i.test(video.sessionId) || !/^[a-f0-9]{64}$/i.test(video.sha256) ||
      typeof video.filename !== 'string' || !/^[A-Za-z0-9_-]+\.(mp4|webm|mkv|mov)$/.test(video.filename) || video.filename.length > 255 ||
      typeof video.localPath !== 'string' || !video.localPath || video.localPath.length > 4000 ||
      !Number.isSafeInteger(video.fileSize) || video.fileSize < 1 || video.fileSize > 100 * 1024 ** 3 ||
      !Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 86400) throw storageError('Thông tin video không hợp lệ');
}

export class CustomerStorageService {
  static async register(stationId: string, video: LocalVideo): Promise<string> {
    validateLocalVideo(video);
    const station = await DatabaseRepository.findStationById(stationId);
    if (!station?.businessId) throw storageError('Không tìm thấy trạm của doanh nghiệp', 404);
    let videoId: string;
    if (video.mobile) {
      const user = await DatabaseRepository.findUserById(video.mobile.userId);
      if (!user || !user.isActive || (user.role !== 'SUPER_ADMIN' && user.businessId !== station.businessId) ||
          (['PACKING_USER', 'WAREHOUSE_MANAGER'].includes(user.role) && user.warehouseId !== station.warehouseId) ||
          !['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'PACKING_USER'].includes(user.role)) throw storageError('Người tải video không có quyền tại trạm', 403);
      const result = await DatabaseRepository.createMobilePackingSessionTx({ ...video, ...video.mobile, stationId, warehouseId: station.warehouseId });
      videoId = result.videoId;
    } else {
      const session = await DatabaseRepository.findSessionById(video.sessionId);
      if (!session || (session.station_id || session.stationId) !== stationId) throw storageError('Phiên quay không thuộc trạm', 403);
      videoId = await DatabaseRepository.recordFinalizedVideo(video);
    }
    StationGateway.broadcastSessionState(video.sessionId, stationId, 'COMPLETED', video.mobile?.trackingCode, {
      videoId, businessId: station.businessId, warehouseId: station.warehouseId, video
    });
    return videoId;
  }

  static async workerVideo(stationId: string, sessionId: string): Promise<any> {
    const video = await CustomerStorageRepository.findVideo(sessionId, true);
    if (!video || video.station_id !== stationId || video.storage_owner !== 'WORKER') throw storageError('Video không thuộc máy kho này', 404);
    return video;
  }

  static async driveAccess(video: any): Promise<{ accessToken: string; folderId: string }> {
    const connection = await DatabaseRepository.getBusinessGoogleDrive(video.business_id);
    if (!connection.connected || !connection.refreshToken) throw storageError('Doanh nghiệp chưa liên kết Google Drive. Video vẫn giữ tại kho.', 409);
    return { accessToken: await GoogleDriveService.refreshAccessToken(connection.refreshToken), folderId: connection.folderId || 'root' };
  }

  static verifyDriveCopy(video: any, remote: any): void {
    if (!remote || remote.trashed || remote.id !== video.drive_file_id || remote.appProperties?.packingVideoId !== video.id ||
        Number(remote.size) !== Number(video.file_size) || typeof remote.sha256Checksum !== 'string' ||
        remote.sha256Checksum.toLowerCase() !== video.sha256.toLowerCase()) {
      throw storageError('Drive chưa có bản sao khớp dung lượng và SHA-256. Bản gốc vẫn giữ tại kho.', 409);
    }
  }

  static async prepareDrive(stationId: string, sessionId: string): Promise<any> {
    const video = await this.workerVideo(stationId, sessionId);
    const { accessToken, folderId } = await this.driveAccess(video);
    if (!video.drive_file_id) video.drive_file_id = await CustomerStorageRepository.reserveDriveId(video.id, stationId, await GoogleDriveService.generateFileId(accessToken));
    const remote = await GoogleDriveService.getFileMetadata(accessToken, video.drive_file_id);
    if (remote) {
      this.verifyDriveCopy(video, remote);
      await this.markSynced(video);
      return { synced: true, fileId: video.drive_file_id };
    }
    const uploadUrl = await GoogleDriveService.createResumableUpload({
      accessToken, folderId, fileId: video.drive_file_id, filename: video.filename,
      fileSize: Number(video.file_size), mimeType: videoMimeType(video.filename), videoId: video.id
    });
    await CustomerStorageRepository.setDriveState(video.id, stationId, 'SYNCING');
    return { synced: false, uploadUrl };
  }

  static async completeDrive(stationId: string, sessionId: string): Promise<void> {
    const video = await this.workerVideo(stationId, sessionId);
    if (!video.drive_file_id) throw storageError('Chưa tạo phiên tải lên Drive', 409);
    const { accessToken } = await this.driveAccess(video);
    this.verifyDriveCopy(video, await GoogleDriveService.getFileMetadata(accessToken, video.drive_file_id));
    await this.markSynced(video);
  }

  private static async markSynced(video: any): Promise<void> {
    await CustomerStorageRepository.setDriveState(video.id, video.station_id, 'SYNCED');
    StationGateway.broadcast('SYNC_STATUS_CHANGED', { videoId: video.id, stationId: video.station_id, syncStatus: 'SYNCED' }, {
      businessId: video.business_id, warehouseId: video.warehouse_id, stationId: video.station_id
    });
  }
}
