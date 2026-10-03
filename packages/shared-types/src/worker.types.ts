export type WorkerCommandType = 'START_RECORD' | 'STOP_RECORD' | 'CANCEL_RECORD';

export interface CameraStreamConfig {
  type: 'RTSP' | 'WEBCAM';
  url?: string;
  deviceName?: string;
}

export interface WorkerStartCommandPayload {
  sessionId: string;
  workerEpoch: string;
  trackingCode: string;
  stationCode: string;
  camera: CameraStreamConfig;
  outputTempPattern: string;
}

export interface WorkerStopCommandPayload {
  sessionId: string;
}

export interface WorkerCancelCommandPayload {
  sessionId: string;
  reason?: string;
}

export interface WorkerCommandMessage {
  type: 'COMMAND_DISPATCH';
  commandId: string;
  command: WorkerCommandType;
  workerEpoch: string;
  sessionId: string;
  payload: WorkerStartCommandPayload | WorkerStopCommandPayload | WorkerCancelCommandPayload;
}

export interface WorkerHelloMessage {
  type: 'WORKER_HELLO';
  stationId: string;
  workerEpoch: string;
  version: string;
  os: string;
  hostname: string;
}

export interface WorkerHeartbeatMessage {
  type: 'WORKER_HEARTBEAT';
  stationId: string;
  workerEpoch: string;
  timestamp: string;
  telemetry: {
    freeDiskBytes: number;
    activePid?: number | null;
    ffmpegHealth: 'IDLE' | 'RECORDING' | 'ERROR';
    nasReachable: boolean;
  };
}

export interface WorkerMilestoneMessage {
  type: 'RECORDING_MILESTONE';
  sessionId: string;
  workerEpoch: string;
  event: 'FIRST_KEYFRAME';
  pid: number;
}

export interface WorkerFinalizeSuccessMessage {
  type: 'FINALIZE_SUCCESS';
  eventId: string;
  sequenceNumber: number;
  sessionId: string;
  workerEpoch: string;
  video: {
    filename: string;
    localPath: string;
    duration: number;
    fileSize: number;
    sha256: string;
    thumbnailPath?: string;
  };
}

export interface WorkerFinalizeFailedMessage {
  type: 'FINALIZE_FAILED';
  eventId: string;
  sequenceNumber: number;
  sessionId: string;
  workerEpoch: string;
  error: string;
  hasPartial: boolean;
}

export interface WorkerCancelAckMessage {
  type: 'CANCEL_ACK';
  sessionId: string;
  workerEpoch: string;
  pidTerminated?: number;
}

export interface WorkerSyncStatusChangedMessage {
  type: 'SYNC_STATUS_CHANGED';
  eventId: string;
  sequenceNumber: number;
  videoId: string;
  syncStatus: 'SYNCED' | 'FAILED' | 'PENDING';
  remoteSha256Verified: boolean;
  error?: string;
}
