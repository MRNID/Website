import { WebSocket } from 'ws';

export class StationGateway {
  private static clients: Set<WebSocket> = new Set();

  static registerClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  static broadcast(event: string, data: any): void {
    const payload = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  static broadcastSessionState(sessionId: string, stationId: string, status: string, trackingCode?: string, details?: any): void {
    this.broadcast('SESSION_STATE_CHANGED', {
      sessionId,
      stationId,
      status,
      trackingCode,
      ...details
    });
  }
}
