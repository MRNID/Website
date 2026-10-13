import { useState, useEffect, useCallback } from 'react';

export interface StationItem {
  id?: string;
  code: string;
  name?: string;
}

export interface UseMobileStationSyncProps {
  stationCode?: string;
  stations?: StationItem[];
  isRecording?: boolean;
  isUploading?: boolean;
}

export interface UseMobileStationSyncResult {
  activeStationCode: string;
  setActiveStationCode: (code: string) => boolean;
  isValidStation: boolean;
  statusMessage: string;
}

/**
 * Pure transition logic determining the active station code.
 * Guaranteed:
 * - Never returns hardcoded 'PACK01' as fallback
 * - Keeps user selection if valid in the updated station list
 * - Defaults to first allowed station when stations load asynchronously
 * - Locks station changes during active recording or uploading
 */
export function computeNextStationCode(
  currentActive: string,
  stationCodeProp: string | undefined,
  stationsProp: StationItem[] | undefined,
  isLocked: boolean
): string {
  // If in the middle of active recording or uploading, station is locked
  if (isLocked) {
    return currentActive;
  }

  const validStations = stationsProp || [];
  if (validStations.length > 0) {
    // 1. If currently selected station is still in the valid list, preserve user selection
    if (currentActive && validStations.some(s => s.code === currentActive)) {
      return currentActive;
    }
    // 2. Otherwise if stationCode prop was provided and exists in stations, use it
    if (stationCodeProp && validStations.some(s => s.code === stationCodeProp)) {
      return stationCodeProp;
    }
    // 3. Fallback to the first station in the allowed list
    return validStations[0].code;
  }

  // If stationCode prop was provided explicitly even without list
  if (stationCodeProp) {
    return stationCodeProp;
  }

  // No station determined yet (loading or empty list)
  return '';
}

export function useMobileStationSync({
  stationCode,
  stations = [],
  isRecording = false,
  isUploading = false
}: UseMobileStationSyncProps): UseMobileStationSyncResult {
  const isLocked = isRecording || isUploading;

  const [activeStationCode, setActiveStationCodeState] = useState<string>(() =>
    computeNextStationCode('', stationCode, stations, false)
  );

  // Synchronize whenever stations list or stationCode prop updates asynchronously
  useEffect(() => {
    setActiveStationCodeState((prev) =>
      computeNextStationCode(prev, stationCode, stations, isLocked)
    );
  }, [stationCode, stations, isLocked]);

  const setActiveStationCode = useCallback((newCode: string): boolean => {
    if (isLocked) {
      return false; // Forbid switching station mid-flight
    }
    if (stations.length > 0 && !stations.some(s => s.code === newCode)) {
      return false; // Must be in valid stations list
    }
    setActiveStationCodeState(newCode);
    return true;
  }, [stations, isLocked]);

  const isValidStation = Boolean(
    activeStationCode && (stations.length === 0 || stations.some(s => s.code === activeStationCode))
  );

  const statusMessage = !activeStationCode
    ? (stations.length === 0 ? 'Đang tải danh sách trạm...' : 'Chưa có trạm đóng gói được chọn')
    : `Trạm: ${activeStationCode}`;

  return {
    activeStationCode,
    setActiveStationCode,
    isValidStation,
    statusMessage
  };
}
