export function getStorageDatePath(date: Date = new Date()): { year: string; month: string; day: string; relativeFolder: string } {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return {
    year,
    month,
    day,
    relativeFolder: `${year}/${month}/${day}`
  };
}

export function formatTimestampCompact(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}_${h}${min}${s}`;
}

export function buildCollisionProofFilename(trackingCode: string, stationCode: string, sessionId: string, date: Date = new Date()): string {
  const sanitizedTracking = trackingCode.replace(/[^A-Za-z0-9\-_]/g, '_');
  const sanitizedStation = stationCode.replace(/[^A-Za-z0-9\-_]/g, '_');
  const timestamp = formatTimestampCompact(date);
  const sessionShortId = sessionId.replace(/-/g, '').slice(0, 8);
  return `${sanitizedTracking}_${sanitizedStation}_${timestamp}_${sessionShortId}.mp4`;
}
