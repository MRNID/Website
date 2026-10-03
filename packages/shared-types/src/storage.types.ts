export type StorageType = 'LOCAL_TEMP' | 'LOCAL_ARCHIVE' | 'NAS_SHARE';

export interface StorageConfigDto {
  id: string;
  warehouseId: string;
  storageType: StorageType;
  path: string;
  username?: string | null;
  retentionDays: number;
  localRetentionDays: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
