export interface StationReference {
  id?: string;
  code: string;
  name?: string;
}

/**
 * Pure transition logic determining the active station code.
 * Guaranteed:
 * - Never returns hardcoded 'PACK01' as fallback
 * - Keeps user selection if valid in the updated station list
 * - Defaults to first allowed station when stations load asynchronously (e.g. PACK02, MOBILE01, etc.)
 * - Locks station changes during active recording or uploading
 */
export function computeNextStationCode(
  currentActive: string,
  stationCodeProp: string | undefined,
  stationsProp: StationReference[] | undefined,
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
