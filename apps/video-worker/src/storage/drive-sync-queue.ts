import * as fs from 'node:fs';
import { calculateFileSha256 } from '@packing-proof/shared-utils';
import { LocalVideoStore, VideoJob } from './local-video-store.js';

export class DriveSyncQueue {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopping = false;

  constructor(private store: LocalVideoStore, private apiBase: string, private stationId: string, private token: string) {}

  start(): void {
    this.stopping = false;
    this.timer = setInterval(() => { void this.tick(); }, 5000);
    void this.tick();
  }
  stop(): void { this.stopping = true; clearInterval(this.timer); }

  private async api(route: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.apiBase}/api/v1/worker${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-station': this.stationId, 'x-worker-token': this.token },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error?.message || `Server status ${res.status}`);
    return result.data;
  }

  async tick(): Promise<void> {
    if (this.busy || this.stopping) return;
    this.busy = true;
    try {
      for (const job of this.store.due()) {
        if (this.stopping) break;
        try {
          const { file } = this.store.file(job.video.sessionId);
          if (fs.statSync(file).size !== job.video.fileSize || await calculateFileSha256(file) !== job.video.sha256) throw new Error('Video tại kho không khớp mã băm gốc');
          if (!job.registered) {
            await this.api('/videos/register', job.video);
            job.registered = true;
            this.store.save(job);
          }
          if (!job.uploadUrl) {
            const ticket = await this.api(`/videos/${job.video.sessionId}/drive-upload`, {});
            if (ticket.synced) {
              job.synced = true;
              job.lastError = undefined;
              this.store.save(job);
              continue;
            }
            job.uploadUrl = ticket.uploadUrl;
            this.store.save(job);
          }
          await this.upload(job, file);
          await this.api(`/videos/${job.video.sessionId}/drive-complete`, {});
          job.synced = true;
          job.uploadUrl = undefined;
          job.lastError = undefined;
          this.store.save(job);
        } catch (err: any) {
          job.attempts++;
          // Never persist signed upload URLs, OAuth tokens, or request headers in errors.
          job.lastError = String(err.message || 'Đồng bộ thất bại').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
          job.nextAttempt = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(job.attempts - 1, 6));
          this.store.save(job);
          if (job.registered) {
            try { await this.api(`/videos/${job.video.sessionId}/drive-failed`, { message: job.lastError }); } catch {}
          }
          console.warn(`[DriveQueue] ${job.video.sessionId}: ${job.lastError}; sẽ thử lại.`);
        }
      }
    } catch (err: any) {
      console.error('[DriveQueue] Không thể đọc hàng đợi:', err.message);
    } finally { this.busy = false; }
  }

  private async upload(job: VideoJob, file: string): Promise<void> {
    const url = new URL(job.uploadUrl!);
    if (url.protocol !== 'https:' || url.hostname !== 'www.googleapis.com' || !url.pathname.startsWith('/upload/drive/')) throw new Error('Invalid Drive upload destination');
    const send = async (range: string, body?: Buffer) => {
      const res = await fetch(url, {
        method: 'PUT', redirect: 'manual', headers: { 'Content-Length': String(body?.length || 0), 'Content-Range': range },
        body: body ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(120000)
      });
      if (res.status >= 400 && res.status < 500) {
        job.uploadUrl = undefined;
        this.store.save(job);
      }
      if (res.status !== 308 && !res.ok) throw new Error(`Drive upload status ${res.status}`);
      return res;
    };
    const size = job.video.fileSize;
    let res = await send(`bytes */${size}`);
    if (res.ok) return;
    const offsetFrom = (response: Response) => {
      const range = response.headers.get('range');
      const match = range?.match(/^bytes=0-(\d+)$/);
      if (range && !match) throw new Error('Invalid Drive resume range');
      const offset = match ? Number(match[1]) + 1 : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > size) throw new Error('Invalid Drive resume offset');
      return offset;
    };
    let offset = offsetFrom(res);
    const fd = fs.openSync(file, 'r');
    try {
      while (offset < size && !this.stopping) {
        const chunk = Buffer.alloc(Math.min(4 * 1024 * 1024, size - offset));
        const count = fs.readSync(fd, chunk, 0, chunk.length, offset);
        if (count !== chunk.length) throw new Error('Video thay đổi trong khi tải lên');
        res = await send(`bytes ${offset}-${offset + count - 1}/${size}`, chunk);
        if (res.ok) return;
        const next = offsetFrom(res);
        if (next <= offset) throw new Error('Drive chưa nhận thêm dữ liệu');
        offset = next;
      }
      throw new Error(this.stopping ? 'Worker đang dừng; sẽ tiếp tục lần sau' : 'Drive chưa xác nhận hoàn tất');
    } finally { fs.closeSync(fd); }
  }
}
