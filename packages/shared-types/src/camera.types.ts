export type CameraType = 'RTSP' | 'WEBCAM';
export type CameraStatus = 'OFFLINE' | 'ONLINE' | 'RECORDING' | 'ERROR';

export interface CameraDto {
  id: string;
  stationId: string;
  name: string;
  type: CameraType;
  rtspUrl?: string | null;
  username?: string | null;
  status: CameraStatus;
  createdAt: string;
  updatedAt: string;
}

export type StationStatus = 'OFFLINE' | 'ONLINE' | 'BUSY' | 'SUSPECTED_OFFLINE' | 'MAINTENANCE';

export interface StationDto {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  computerName?: string | null;
  ipAddress?: string | null;
  status: StationStatus;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
