import { WebSocket } from 'ws';
import { workerConfig } from '../config.js';
import { LocalJournal } from '../journal/command-journal.js';
import { FFmpegManager } from '../ffmpeg/ffmpeg-manager.js';
import * as fs from 'node:fs';
import { LocalVideoStore } from '../storage/local-video-store.js';
import { DriveSyncQueue } from '../storage/drive-sync-queue.js';
import {
  WorkerCommandMessage,
  WorkerStartCommandPayload
} from '@packing-proof/shared-types';

export class WorkerAgent {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentEpoch: string = '';
  private isRunning = false;
  private reconnectTimer?: NodeJS.Timeout;
  private store = new LocalVideoStore(workerConfig.archiveDir, workerConfig.journalDir);
  private driveQueue = new DriveSyncQueue(this.store, workerConfig.backendApiOrigin, workerConfig.stationId, workerConfig.workerToken);

  async start(): Promise<void> {
    if (!/^[a-f0-9-]{36}$/i.test(workerConfig.stationId)) throw new Error('Cần STATION_ID được cấp cho trạm.');
    if (workerConfig.workerToken.length < 32) throw new Error('Cần WORKER_TOKEN riêng được cấp cho trạm (tối thiểu 32 ký tự).');
    const endpoint = new URL(workerConfig.backendWsUrl);
    if (endpoint.protocol !== 'wss:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Kết nối máy chủ bên ngoài phải dùng WSS.');
    this.store.recoverSidecars(workerConfig.stationCode);
    this.driveQueue.start();
    this.isRunning = true;
    this.connect();
  }

  private connect(): void {
    if (!this.isRunning) return;

    const url = `${workerConfig.backendWsUrl}?stationId=${encodeURIComponent(workerConfig.stationId)}`;
    console.log(`[WorkerAgent] Connecting to Backend WSS: ${workerConfig.backendWsUrl}`);

    this.ws = new WebSocket(url, { headers: { 'x-worker-token': workerConfig.workerToken }, maxPayload: 2 * 1024 * 1024 });

    this.ws.on('open', () => {
      console.log('[WorkerAgent] Connected to Backend Gateway!');
      this.startHeartbeat();
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(msg);
      } catch (err) {
        console.error('[WorkerAgent] Error parsing server message:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`[WorkerAgent] Disconnected from server (Code: ${code}, Reason: ${reason}). Reconnecting in 5s...`);
      this.stopHeartbeat();
      if (this.isRunning) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[WorkerAgent] WebSocket connection error:', err.message);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'WORKER_HEARTBEAT',
          stationId: workerConfig.stationId,
          workerEpoch: this.currentEpoch,
          timestamp: new Date().toISOString(),
          telemetry: {
            freeDiskBytes: (() => { const disk = fs.statfsSync(workerConfig.archiveDir); return disk.bavail * disk.bsize; })(),
            activePid: FFmpegManager.getActiveSession()?.process?.pid || null,
            ffmpegHealth: FFmpegManager.isRecording() ? 'RECORDING' : 'IDLE',
            nasReachable: false,
            pendingDriveUploads: this.store.due(Number.MAX_SAFE_INTEGER).length
          }
        }));
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    if (msg.type === 'STORAGE_REQUEST') {
      try {
        const result = await this.store.handleRpc(msg.operation, msg.payload);
        this.sendWsMessage({ type: 'STORAGE_RESPONSE', requestId: msg.requestId, workerEpoch: this.currentEpoch, success: true, data: result });
      } catch (err: any) {
        this.sendWsMessage({ type: 'STORAGE_RESPONSE', requestId: msg.requestId, workerEpoch: this.currentEpoch, success: false, error: err.code === 'ENOENT' ? 'Video không còn tại máy kho' : err.message });
      }
      return;
    }
    if (msg.type === 'SERVER_HELLO_ACK') {
      this.currentEpoch = msg.workerEpoch;
      console.log(`[WorkerAgent] Handshake complete. Assigned epoch: ${this.currentEpoch}`);
      return;
    }

    if (msg.type === 'EVENT_ACK') {
      LocalJournal.markEventAcked(msg.eventId);
      return;
    }

    if (msg.type === 'COMMAND_DISPATCH') {
      const cmdMsg = msg as WorkerCommandMessage;

      // Journal command
      LocalJournal.appendCommand({
        commandId: cmdMsg.commandId,
        command: cmdMsg.command,
        sessionId: cmdMsg.sessionId,
        timestamp: new Date().toISOString(),
        status: 'RECEIVED'
      });

      switch (cmdMsg.command) {
        case 'START_RECORD': {
          const payload = cmdMsg.payload as WorkerStartCommandPayload;
          await FFmpegManager.startRecording({
            sessionId: payload.sessionId,
            trackingCode: payload.trackingCode,
            stationCode: payload.stationCode,
            camera: payload.camera,
            outputTempPattern: payload.outputTempPattern,
            onFirstKeyframe: (pid) => {
              this.sendWsMessage({
                type: 'RECORDING_MILESTONE',
                sessionId: payload.sessionId,
                workerEpoch: this.currentEpoch,
                event: 'FIRST_KEYFRAME',
                pid
              });
            }
          });
          break;
        }

        case 'STOP_RECORD': {
          try {
            const finalized = await FFmpegManager.stopRecording(cmdMsg.sessionId);
            this.store.enqueue({ ...finalized, sessionId: cmdMsg.sessionId });
            const event = LocalJournal.appendEvent('FINALIZE_SUCCESS', finalized);

            this.sendWsMessage({
              type: 'FINALIZE_SUCCESS',
              eventId: event.eventId,
              sequenceNumber: event.sequenceNumber,
              sessionId: cmdMsg.sessionId,
              workerEpoch: this.currentEpoch,
              video: finalized
            });

            // Durable queue uploads directly from this machine to the customer Drive.
            void this.driveQueue.tick();
          } catch (err: any) {
            console.warn(`[WorkerAgent] Stop recording rejected for session ${cmdMsg.sessionId}:`, err.message);
            const event = LocalJournal.appendEvent('FINALIZE_FAILED', { error: err.message });
            this.sendWsMessage({
              type: 'FINALIZE_FAILED',
              eventId: event.eventId,
              sequenceNumber: event.sequenceNumber,
              sessionId: cmdMsg.sessionId,
              workerEpoch: this.currentEpoch,
              error: err.message,
              hasPartial: false
            });
          }
          break;
        }

        case 'CANCEL_RECORD': {
          const cancelled = FFmpegManager.cancelRecording(cmdMsg.sessionId);
          if (cancelled) {
            this.sendWsMessage({
              type: 'CANCEL_ACK',
              sessionId: cmdMsg.sessionId,
              workerEpoch: this.currentEpoch
            });
          } else {
            console.warn(`[WorkerAgent] CANCEL_RECORD ignored: session ${cmdMsg.sessionId} is not active in FFmpegManager`);
          }
          break;
        }
      }
    }
  }

  private sendWsMessage(msg: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  stop(): void {
    this.isRunning = false;
    clearTimeout(this.reconnectTimer);
    this.driveQueue.stop();
    this.stopHeartbeat();
    this.ws?.close();
  }
}
