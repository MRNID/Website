export type SyncStatus = 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type DisputeStatus = 'NORMAL' | 'DISPUTE' | 'RESOLVED';
export type PurgeStatus = 'ACTIVE' | 'PENDING_PURGE' | 'PURGED';

export interface VideoDto {
  id: string;
  packingSessionId: string;
  filename: string;
  localPath: string;
  nasPath?: string | null;
  duration: number;
  fileSize: number;
  sha256: string;
  thumbnailPath?: string | null;
  syncStatus: SyncStatus;
  syncAttempts: number;
  syncError?: string | null;
  isPartial: boolean;
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  disputeStatus: DisputeStatus;
  purgeStatus: PurgeStatus;
  purgedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeUpdateRequest {
  isLocked: boolean;
  disputeStatus: DisputeStatus;
  lockReason?: string;
}

export interface VideoSearchParams {
  businessId?: string;
  trackingCode?: string;
  orderCode?: string;
  startDate?: string;
  endDate?: string;
  warehouseId?: string;
  stationId?: string;
  userId?: string;
  disputeStatus?: DisputeStatus;
  page?: number;
  limit?: number;
}
