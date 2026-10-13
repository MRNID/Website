import { Readable } from 'node:stream';
import { RELAY_CHUNK_BYTES, JwtTokenPayload } from '@packing-proof/shared-types';
import { WorkerGateway } from '../websocket/worker-gateway.js';
import { storageError } from './customer-storage.service.js';

export function canReadVideo(user: JwtTokenPayload, video: any): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (!video.business_id || video.business_id !== user.businessId) return false;
  if (['PACKING_USER', 'WAREHOUSE_MANAGER'].includes(user.role)) return !!user.warehouseId && video.warehouse_id === user.warehouseId;
  return true;
}

export function parseVideoRange(header: string | undefined, size: number): { start: number; end: number; partial: boolean } {
  if (!Number.isSafeInteger(size) || size < 1) throw storageError('Video size invalid', 416);
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw storageError('Invalid byte range', 416);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || (!match[1] && Number(match[2]) <= 0)) throw storageError('Range not satisfiable', 416);
  return { start, end, partial: true };
}

export function warehouseVideoStream(stationId: string, sessionId: string, start: number, end: number): Readable {
  return Readable.from((async function* () {
    let offset = start;
    while (offset <= end) {
      const length = Math.min(RELAY_CHUNK_BYTES, end - offset + 1);
      const result = await WorkerGateway.requestStorage(stationId, 'FILE_READ', { sessionId, offset, length });
      const bytes = Buffer.from(result.data || '', 'base64');
      if (bytes.length !== length) throw new Error('Video tại kho đã thay đổi hoặc không đọc được');
      offset += bytes.length;
      yield bytes;
    }
  })(), { objectMode: false, highWaterMark: RELAY_CHUNK_BYTES });
}
