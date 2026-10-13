/** Browser-safe ESM entry: HTTP LAN uses port 4000; HTTPS uses a same-origin proxy. */
export function resolveBackendEndpoints(pageUrl: string, configuredOrigin?: string): { apiBase: string; stationSocketUrl: string } {
  const page = new URL(pageUrl);
  const backend = new URL(configuredOrigin || page.origin, page.origin);
  if (!configuredOrigin && page.protocol === 'http:') backend.port = '4000';
  if (!['http:', 'https:'].includes(backend.protocol)) throw new Error('Backend must use HTTP or HTTPS');
  const socket = new URL('/ws/station', backend);
  socket.protocol = backend.protocol === 'https:' ? 'wss:' : 'ws:';
  return { apiBase: new URL('/api/v1', backend).toString(), stationSocketUrl: socket.toString() };
}
