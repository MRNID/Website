import * as fs from 'node:fs';
import * as path from 'node:path';
import { LocalVideo, RELAY_CHUNK_BYTES, videoMimeType } from '@packing-proof/shared-types';
import { calculateFileSha256 } from '@packing-proof/shared-utils';

export interface VideoJob {
  video: LocalVideo;
  registered: boolean;
  synced: boolean;
  attempts: number;
  nextAttempt: number;
  uploadUrl?: string;
  lastError?: string;
}

export function atomicJson(file: string, value: unknown): void {
  const temporary = file + '.tmp';
  const fd = fs.openSync(temporary, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

export class LocalVideoStore {
  readonly archiveDir: string;
  readonly jobsDir: string;

  constructor(archiveDir: string, journalDir: string) {
    this.archiveDir = path.resolve(archiveDir);
    this.jobsDir = path.join(journalDir, 'video-jobs');
    fs.mkdirSync(this.archiveDir, { recursive: true });
    fs.mkdirSync(this.jobsDir, { recursive: true });
    fs.mkdirSync(path.join(this.archiveDir, '.incoming'), { recursive: true });
  }

  private id(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid session ID');
    return id;
  }

  private jobPath(id: string): string { return path.join(this.jobsDir, this.id(id) + '.json'); }

  get(id: string): VideoJob | null {
    const file = this.jobPath(id);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }

  save(job: VideoJob): void { atomicJson(this.jobPath(job.video.sessionId), job); }

  enqueue(video: LocalVideo): VideoJob {
    this.safeFile(video.localPath);
    const previous = this.get(video.sessionId);
    if (previous) {
      if (previous.video.sha256 !== video.sha256 || previous.video.fileSize !== video.fileSize) throw new Error('Session already contains another video');
      return previous;
    }
    const job: VideoJob = { video, registered: false, synced: false, attempts: 0, nextAttempt: 0 };
    this.save(job);
    return job;
  }

  due(now = Date.now()): VideoJob[] {
    return fs.readdirSync(this.jobsDir).filter(name => /^[0-9a-f-]{36}\.json$/i.test(name))
      .flatMap(name => {
        try {
          const job = JSON.parse(fs.readFileSync(path.join(this.jobsDir, name), 'utf8')) as VideoJob;
          if (!job.video?.sessionId || !Number.isFinite(job.nextAttempt)) throw new Error('Invalid journal');
          return [job];
        } catch {
          console.error('Cannot read video journal; retained for recovery:', name);
          return [];
        }
      })
      .filter(job => !job.synced && job.nextAttempt <= now)
      .sort((a, b) => a.nextAttempt - b.nextAttempt);
  }

  /** Resolve on the customer machine only; reject symlinks/junctions escaping the archive. */
  safeFile(file: string): string {
    const resolved = fs.realpathSync(file);
    const relative = path.relative(fs.realpathSync(this.archiveDir), resolved);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) {
      throw new Error('File outside customer archive');
    }
    return resolved;
  }

  file(sessionId: string): { job: VideoJob; file: string } {
    const job = this.get(sessionId);
    if (!job) throw new Error('Video chưa có tại máy kho');
    return { job, file: this.safeFile(job.video.localPath) };
  }

  async handleRpc(operation: string, input: any): Promise<any> {
    if (operation === 'FILE_STAT' || operation === 'FILE_READ' || operation === 'FILE_HASH') {
      const { file, job } = this.file(input.sessionId);
      if (operation === 'FILE_STAT') return { size: fs.statSync(file).size, mimeType: videoMimeType(job.video.filename) };
      if (operation === 'FILE_HASH') return { sha256: await calculateFileSha256(file) };
      if (!Number.isSafeInteger(input.offset) || input.offset < 0 || !Number.isSafeInteger(input.length) || input.length < 1 || input.length > RELAY_CHUNK_BYTES) throw new Error('Invalid read range');
      const buffer = Buffer.alloc(input.length);
      const fd = fs.openSync(file, 'r');
      try {
        const bytes = fs.readSync(fd, buffer, 0, buffer.length, input.offset);
        return { data: buffer.subarray(0, bytes).toString('base64') };
      } finally { fs.closeSync(fd); }
    }
    if (operation === 'UPLOAD_BEGIN') return this.beginUpload(input);
    if (operation === 'UPLOAD_CHUNK') return this.uploadChunk(input);
    if (operation === 'UPLOAD_COMMIT') return this.commitUpload(input.sessionId);
    throw new Error('Unsupported worker operation');
  }

  private uploadInfoPath(id: string): string { return path.join(this.jobsDir, 'upload-' + this.id(id) + '.json'); }

  private beginUpload(input: LocalVideo): any {
    this.id(input.sessionId);
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > 100 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/i.test(input.sha256) || !/^[A-Za-z0-9_-]+\.(mp4|webm|mkv|mov)$/.test(input.filename)) throw new Error('Invalid mobile video');
    const existing = this.get(input.sessionId);
    if (existing) {
      if (existing.video.sha256 !== input.sha256 || existing.video.mobile?.userId !== input.mobile?.userId) throw new Error('Upload ID conflict');
      return { offset: existing.video.fileSize, complete: true, video: existing.video };
    }
    const infoPath = this.uploadInfoPath(input.sessionId);
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      if (info.video.sha256 !== input.sha256 || info.video.mobile?.userId !== input.mobile?.userId || info.video.fileSize !== input.fileSize) throw new Error('Upload ID conflict');
      if (fs.existsSync(info.video.localPath)) return { offset: input.fileSize };
      return { offset: fs.statSync(info.temporary).size };
    }
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, path.sep);
    const directory = path.join(this.archiveDir, date);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = path.join(this.archiveDir, '.incoming', input.sessionId + '.partial');
    const video = { ...input, localPath: path.join(directory, input.filename) };
    // Recover orphaned empty/partial files only for this exact upload ID.
    if (!fs.existsSync(temporary)) fs.closeSync(fs.openSync(temporary, 'wx', 0o600));
    this.safeFile(temporary);
    atomicJson(infoPath, { video, temporary });
    return { offset: fs.statSync(temporary).size };
  }

  private uploadChunk(input: any): any {
    const info = JSON.parse(fs.readFileSync(this.uploadInfoPath(input.sessionId), 'utf8'));
    const file = this.safeFile(info.temporary);
    const data = Buffer.from(input.data || '', 'base64');
    if (data.length < 1 || data.length > RELAY_CHUNK_BYTES || input.offset !== fs.statSync(file).size || input.offset + data.length > info.video.fileSize) throw new Error('Invalid upload offset or size');
    fs.appendFileSync(file, data);
    return { offset: input.offset + data.length };
  }

  private async commitUpload(sessionId: string): Promise<any> {
    const previous = this.get(sessionId);
    if (previous) {
      const file = this.safeFile(previous.video.localPath);
      if (fs.statSync(file).size !== previous.video.fileSize || await calculateFileSha256(file) !== previous.video.sha256) throw new Error('Bản tại kho không còn khớp video gốc');
      return previous.video;
    }
    const infoPath = this.uploadInfoPath(sessionId);
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    const file = this.safeFile(fs.existsSync(info.video.localPath) ? info.video.localPath : info.temporary);
    if (fs.statSync(file).size !== info.video.fileSize || await calculateFileSha256(file) !== info.video.sha256) throw new Error('Video checksum mismatch; giữ bản gốc trên điện thoại');
    const fd = fs.openSync(file, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (file !== info.video.localPath) fs.renameSync(file, info.video.localPath);
    this.enqueue(info.video);
    fs.unlinkSync(infoPath);
    return info.video;
  }

  recoverSidecars(stationCode: string): void {
    const visit = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || entry.name === '.incoming') continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.name.endsWith('.proof.json')) {
          try {
          const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
          const localPath = file.slice(0, -'.proof.json'.length);
          if (proof.stationCode === stationCode && !this.get(proof.sessionId) && fs.existsSync(localPath)) {
            this.enqueue({ ...proof, localPath, filename: path.basename(localPath) });
          }
          } catch {
            console.error('Cannot recover video sidecar; retained for recovery:', file);
          }
        }
      }
    };
    visit(this.archiveDir);
  }
}
