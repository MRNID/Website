import { WebSocket } from 'ws';
import * as crypto from 'node:crypto';
import { DatabaseRepository } from '@packing-proof/database';
import { StationGateway } from './station-gateway.js';
import {
  WorkerCommandMessage,
  WorkerStartCommandPayload,
  WorkerStopCommandPayload,
  WorkerCancelCommandPayload
} from '@packing-proof/shared-types';

interface ConnectedWorker {
  stationId: string;
  workerEpoch: string;
  ws: WebSocket;
  lastHeartbeat: Date;
  status: 'ONLINE' | 'SUSPECTED_OFFLINE';
}

export class WorkerGateway {
  private static workersByStation = new Map<string, ConnectedWorker>();

  static async handleConnection(ws: WebSocket, stationId: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isValid = await DatabaseRepository.verifyWorkerToken(stationId, tokenHash);

    if (!isValid) {
      ws.close(4001, 'Unauthorized worker token');
      return;
    }

    const workerEpoch = crypto.randomUUID();
    const workerInfo: ConnectedWorker = {
      stationId,
      workerEpoch,
      ws,
      lastHeartbeat: new Date(),
      status: 'ONLINE'
    };

    this.workersByStation.set(stationId, workerInfo);
    console.log(`[WorkerGateway] Station Worker Connected: ${stationId} (Epoch: ${workerEpoch})`);

    // Send Hello ACK with epoch
    ws.send(JSON.stringify({
      type: 'SERVER_HELLO_ACK',
      stationId,
      workerEpoch,
      timestamp: new Date().toISOString()
    }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await this.handleWorkerMessage(workerInfo, msg);
      } catch (err) {
        console.error('[WorkerGateway] Error handling worker message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[WorkerGateway] Station Worker Disconnected: ${stationId}`);
      this.workersByStation.delete(stationId);
    });
  }

  private static async handleWorkerMessage(worker: ConnectedWorker, msg: any): Promise<void> {
    switch (msg.type) {
      case 'WORKER_HEARTBEAT':
        worker.lastHeartbeat = new Date();
        await DatabaseRepository.updateWorkerHeartbeat(worker.stationId, worker.workerEpoch, msg.telemetry);
        worker.ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() }));
        break;

      case 'RECORDING_MILESTONE':
        if (msg.event === 'FIRST_KEYFRAME') {
          console.log(`[WorkerGateway] Session ${msg.sessionId} entered RECORDING (PID: ${msg.pid})`);
          await DatabaseRepository.updateSessionStatus(msg.sessionId, 'RECORDING');
          StationGateway.broadcastSessionState(msg.sessionId, worker.stationId, 'RECORDING');
        }
        break;

      case 'FINALIZE_SUCCESS':
        console.log(`[WorkerGateway] Session ${msg.sessionId} Finalized: ${msg.video.filename} (${msg.video.duration}s, SHA: ${msg.video.sha256})`);
        const videoId = await DatabaseRepository.recordFinalizedVideo({
          sessionId: msg.sessionId,
          filename: msg.video.filename,
          localPath: msg.video.localPath,
          duration: msg.video.duration,
          fileSize: msg.video.fileSize,
          sha256: msg.video.sha256,
          thumbnailPath: msg.video.thumbnailPath
        });

        // ACK event to worker so worker removes it from local outbound queue
        worker.ws.send(JSON.stringify({ type: 'EVENT_ACK', eventId: msg.eventId }));

        // Broadcast to User Web / Admin Web
        StationGateway.broadcastSessionState(msg.sessionId, worker.stationId, 'COMPLETED', undefined, {
          videoId,
          video: msg.video
        });
        break;

      case 'FINALIZE_FAILED':
        console.error(`[WorkerGateway] Session ${msg.sessionId} Finalize Failed:`, msg.error);
        await DatabaseRepository.updateSessionStatus(msg.sessionId, 'FAILED', msg.error);
        worker.ws.send(JSON.stringify({ type: 'EVENT_ACK', eventId: msg.eventId }));
        StationGateway.broadcastSessionState(msg.sessionId, worker.stationId, 'FAILED', undefined, { error: msg.error });
        break;

      case 'CANCEL_ACK':
        console.log(`[WorkerGateway] Session ${msg.sessionId} Cancelled (PID ${msg.pidTerminated} terminated)`);
        await DatabaseRepository.updateSessionStatus(msg.sessionId, 'CANCELLED', 'Operator cancelled');
        StationGateway.broadcastSessionState(msg.sessionId, worker.stationId, 'CANCELLED');
        break;

      case 'SYNC_STATUS_CHANGED':
        console.log(`[WorkerGateway] Video ${msg.videoId} NAS Sync Status: ${msg.syncStatus}`);
        await DatabaseRepository.updateVideoSyncStatus(msg.videoId, msg.syncStatus, msg.nasPath, msg.error);
        worker.ws.send(JSON.stringify({ type: 'EVENT_ACK', eventId: msg.eventId }));
        StationGateway.broadcast('SYNC_STATUS_CHANGED', { videoId: msg.videoId, syncStatus: msg.syncStatus });
        break;
    }
  }

  static isWorkerConnected(stationId: string): boolean {
    return this.workersByStation.has(stationId);
  }

  static getWorkerEpoch(stationId: string): string | null {
    return this.workersByStation.get(stationId)?.workerEpoch || null;
  }

  static dispatchStartRecord(stationId: string, payload: WorkerStartCommandPayload): boolean {
    const worker = this.workersByStation.get(stationId);
    if (!worker || worker.ws.readyState !== WebSocket.OPEN) return false;

    const msg: WorkerCommandMessage = {
      type: 'COMMAND_DISPATCH',
      commandId: crypto.randomUUID(),
      command: 'START_RECORD',
      workerEpoch: worker.workerEpoch,
      sessionId: payload.sessionId,
      payload
    };
    worker.ws.send(JSON.stringify(msg));
    return true;
  }

  static dispatchStopRecord(stationId: string, payload: WorkerStopCommandPayload): boolean {
    const worker = this.workersByStation.get(stationId);
    if (!worker || worker.ws.readyState !== WebSocket.OPEN) return false;

    const msg: WorkerCommandMessage = {
      type: 'COMMAND_DISPATCH',
      commandId: crypto.randomUUID(),
      command: 'STOP_RECORD',
      workerEpoch: worker.workerEpoch,
      sessionId: payload.sessionId,
      payload
    };
    worker.ws.send(JSON.stringify(msg));
    return true;
  }

  static dispatchCancelRecord(stationId: string, payload: WorkerCancelCommandPayload): boolean {
    const worker = this.workersByStation.get(stationId);
    if (!worker || worker.ws.readyState !== WebSocket.OPEN) return false;

    const msg: WorkerCommandMessage = {
      type: 'COMMAND_DISPATCH',
      commandId: crypto.randomUUID(),
      command: 'CANCEL_RECORD',
      workerEpoch: worker.workerEpoch,
      sessionId: payload.sessionId,
      payload
    };
    worker.ws.send(JSON.stringify(msg));
    return true;
  }
}
