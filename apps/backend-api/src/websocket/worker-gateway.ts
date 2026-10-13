import { WebSocket } from 'ws';
import * as crypto from 'node:crypto';
import { DatabaseRepository } from '@packing-proof/database';
import { StationGateway } from './station-gateway.js';
import { CustomerStorageService } from '../services/customer-storage.service.js';
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
  tokenHash: string;
  status: 'ONLINE' | 'SUSPECTED_OFFLINE';
}

export class WorkerGateway {
  private static workersByStation = new Map<string, ConnectedWorker>();
  private static pending = new Map<string, { worker: ConnectedWorker; resolve: (data: any) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }>();

  static async requestStorage(stationId: string, operation: string, payload: unknown, timeoutMs = 30000): Promise<any> {
    const worker = this.workersByStation.get(stationId);
    if (!worker || !this.isWorkerConnected(stationId)) throw new Error('Máy kho đang ngoại tuyến. Hãy bật máy và kiểm tra kết nối.');
    if (this.pending.size >= 128 || [...this.pending.values()].filter(p => p.worker === worker).length >= 16) throw new Error('Máy kho đang bận, vui lòng thử lại.');
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Máy kho không phản hồi kịp thời')); }, timeoutMs);
      this.pending.set(requestId, { worker, resolve, reject, timer });
      worker.ws.send(JSON.stringify({ type: 'STORAGE_REQUEST', requestId, operation, payload }), err => {
        if (err) { clearTimeout(timer); this.pending.delete(requestId); reject(err); }
      });
    });
  }

  static async handleConnection(ws: WebSocket, stationId: string, token: string): Promise<void> {
    if (!/^[a-f0-9-]{36}$/i.test(stationId) || token.length < 32) { ws.close(4001, 'Worker credentials required'); return; }
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
      tokenHash,
      status: 'ONLINE'
    };

    this.workersByStation.get(stationId)?.ws.close(4002, 'Replaced by new worker connection');
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

    ws.on('error', () => ws.close());
    ws.on('close', () => {
      console.log(`[WorkerGateway] Station Worker Disconnected: ${stationId}`);
      if (this.workersByStation.get(stationId) === workerInfo) this.workersByStation.delete(stationId);
      for (const [id, pending] of this.pending) {
        if (pending.worker !== workerInfo) continue;
        clearTimeout(pending.timer);
        pending.reject(new Error('Máy kho đã ngắt kết nối'));
        this.pending.delete(id);
      }
    });
  }

  private static async handleWorkerMessage(worker: ConnectedWorker, msg: any): Promise<void> {
    if (this.workersByStation.get(worker.stationId) !== worker || msg.workerEpoch !== worker.workerEpoch) return;
    if (msg.type === 'STORAGE_RESPONSE') {
      const pending = this.pending.get(msg.requestId);
      if (!pending || pending.worker !== worker) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.requestId);
      if (msg.success) pending.resolve(msg.data);
      else pending.reject(new Error(String(msg.error || 'Lỗi đọc dữ liệu máy kho').slice(0, 300)));
      return;
    }
    if (msg.sessionId) {
      const session = await DatabaseRepository.findSessionById(msg.sessionId);
      if (!session || (session.stationId || session.station_id) !== worker.stationId) return;
    }
    switch (msg.type) {
      case 'WORKER_HEARTBEAT':
        if (!await DatabaseRepository.verifyWorkerToken(worker.stationId, worker.tokenHash)) { worker.ws.close(4001, 'Worker credential revoked'); return; }
        worker.lastHeartbeat = new Date();
        await DatabaseRepository.updateWorkerHeartbeat(worker.stationId, worker.workerEpoch, msg.telemetry);
        worker.ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() }));
        break;

      case 'RECORDING_MILESTONE':
        if (msg.event === 'FIRST_KEYFRAME') {
          const currentSession = await DatabaseRepository.findSessionById(msg.sessionId);
          if (currentSession && (currentSession.status === 'CANCELLING' || currentSession.status === 'CANCELLED' || currentSession.status === 'COMPLETED' || currentSession.status === 'FAILED')) {
            console.log(`[WorkerGateway] Ignoring FIRST_KEYFRAME for session ${msg.sessionId} because status is ${currentSession.status}`);
            break;
          }
          console.log(`[WorkerGateway] Session ${msg.sessionId} entered RECORDING (PID: ${msg.pid})`);
          await DatabaseRepository.updateSessionStatus(msg.sessionId, 'RECORDING');
          StationGateway.broadcastSessionState(msg.sessionId, worker.stationId, 'RECORDING');
        }
        break;

      case 'FINALIZE_SUCCESS': {
        await CustomerStorageService.register(worker.stationId, { ...msg.video, sessionId: msg.sessionId });
        worker.ws.send(JSON.stringify({ type: 'EVENT_ACK', eventId: msg.eventId }));
        break;
      }

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
        // NAS acknowledgements must never mark a Google Drive copy verified.
        worker.ws.send(JSON.stringify({ type: 'EVENT_ACK', eventId: msg.eventId }));
        break;
    }
  }

  static isWorkerConnected(stationId: string): boolean {
    const worker = this.workersByStation.get(stationId);
    return !!worker && worker.ws.readyState === WebSocket.OPEN && Date.now() - worker.lastHeartbeat.getTime() < 45000;
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
