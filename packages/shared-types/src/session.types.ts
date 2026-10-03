export type SessionStatus =
  | 'WAITING'
  | 'RECORDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'INDETERMINATE_TIMEOUT';

export type CarrierPlatform =
  | 'SPX'
  | 'TIKTOK'
  | 'LAZADA'
  | 'GHN'
  | 'GHTK'
  | 'VIETTEL_POST'
  | 'JT'
  | 'OTHER';

export interface PackingSessionDto {
  id: string;
  warehouseId: string;
  orderId: string;
  stationId: string;
  cameraId: string;
  userId: string;
  status: SessionStatus;
  idempotencyKey?: string | null;
  workerEpoch?: string | null;
  version: number;
  startTime: string;
  endTime?: string | null;
  cancellationReason?: string | null;
  hasPartialVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StartPackingRequest {
  stationId: string;
  trackingCode: string;
  orderCode?: string;
  platform?: CarrierPlatform;
  forceOverridePrevious?: boolean;
}

export interface StopPackingRequest {
  sessionId: string;
}

export interface CancelPackingRequest {
  sessionId: string;
  reason?: string;
}

export interface ValidateBarcodeRequest {
  trackingCode: string;
  stationId: string;
}

export interface ValidateBarcodeResponse {
  isValid: boolean;
  platform: CarrierPlatform;
  cleanedCode: string;
  isDuplicate: boolean;
  previousPackedAt?: string | null;
}
