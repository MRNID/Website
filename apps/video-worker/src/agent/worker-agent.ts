import { WebSocket } from 'ws';
import { workerConfig } from '../config.js';
import { LocalJournal } from '../journal/command-journal.js';
import { FFmpegManager } from '../ffmpeg/ffmpeg-manager.js';
import { NasSyncService } from '../storage/nas-sync.js';
import {
  WorkerCommandMessage,
  WorkerStartCommandPayload
} from '@packing-proof/shared-types';

export class WorkerAgent {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentEpoch: string = '';
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    this.connect();
  }

  private connect(): void {
    if (!this.isRunning) return;

    const url = `${workerConfig.backendWsUrl}?stationId=${workerConfig.stationId}&token=${workerConfig.workerToken}`;
    console.log(`[WorkerAgent] Connecting to Backend WSS: ${workerConfig.backendWsUrl}`);

    this.ws = new WebSocket(url);

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
        setTimeout(() => this.connect(), 5000);
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
            freeDiskBytes: 100 * 1024 * 1024 * 1024,
            activePid: FFmpegManager.getActiveSession()?.process?.pid || null,
            ffmpegHealth: FFmpegManager.isRecording() ? 'RECORDING' : 'IDLE',
            nasReachable: true
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
            const finalized = await FFmpegManager.stopRecording();
            const event = LocalJournal.appendEvent('FINALIZE_SUCCESS', finalized);

            this.sendWsMessage({
              type: 'FINALIZE_SUCCESS',
              eventId: event.eventId,
              sequenceNumber: event.sequenceNumber,
              sessionId: cmdMsg.sessionId,
              workerEpoch: this.currentEpoch,
              video: finalized
            });

            // Trigger background NAS sync
            this.syncToNasInBackground(finalized);
          } catch (err: any) {
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
          FFmpegManager.cancelRecording();
          this.sendWsMessage({
            type: 'CANCEL_ACK',
            sessionId: cmdMsg.sessionId,
            workerEpoch: this.currentEpoch
          });
          break;
        }
      }
    }
  }

  private async syncToNasInBackground(finalized: { localPath: string; filename: string; sha256: string }): Promise<void> {
    try {
      const syncResult = await NasSyncService.syncFileToNas({
        localPath: finalized.localPath,
        filename: finalized.filename,
        expectedSha256: finalized.sha256
      });

      const event = LocalJournal.appendEvent('SYNC_STATUS_CHANGED', syncResult);
      this.sendWsMessage({
        type: 'SYNC_STATUS_CHANGED',
        eventId: event.eventId,
        sequenceNumber: event.sequenceNumber,
        videoId: finalized.filename, // mapped by filename or session
        syncStatus: syncResult.success ? 'SYNCED' : 'FAILED',
        nasPath: syncResult.nasPath,
        remoteSha256Verified: syncResult.success,
        error: syncResult.error
      });
    } catch (err: any) {
      console.error('[WorkerAgent] Background NAS sync error:', err);
    }
  }

  private sendWsMessage(msg: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  stop(): void {
    this.isRunning = false;
    this.stopHeartbeat();
    this.ws?.close();
  }
}
