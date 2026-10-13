export interface LocalVideo {
  sessionId: string;
  filename: string;
  localPath: string;
  duration: number;
  fileSize: number;
  sha256: string;
  thumbnailPath?: string;
  mobile?: { userId: string; trackingCode: string; orderCode: string; platform: string };
}

export const RELAY_CHUNK_BYTES = 256 * 1024;

export function videoMimeType(filename: string): string {
  return filename.endsWith('.webm') ? 'video/webm' : filename.endsWith('.mkv') ? 'video/x-matroska' : filename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}
