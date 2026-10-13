import { useEffect, useRef, useState, useCallback } from 'react';
import { STATION_SOCKET_URL } from '../services/endpoints';

export interface StationSocketEvents {
  onSessionStateChanged?: (data: { sessionId: string; state: string; timestamp: string }) => void;
  onWorkerStatusChanged?: (data: { status: string; storage?: any }) => void;
  onStorageAlert?: (data: any) => void;
  onErrorAlert?: (data: { code: string; message: string }) => void;
  onOrdersUpdated?: (data: any) => void;
}

export function useStationWebSocket(stationId: string | null, events: StationSocketEvents) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const connect = useCallback(() => {
    if (!stationId) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = localStorage.getItem('token') || '';
    if (!token) return;

    const wsUrl = `${STATION_SOCKET_URL}?stationId=${encodeURIComponent(stationId)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (evt) => {
      try {
        const message = JSON.parse(evt.data);
        switch (message.type) {
          case 'SESSION_STATE_CHANGED':
            eventsRef.current.onSessionStateChanged?.({
              ...message.data,
              state: message.data.status || message.data.state
            });
            break;
          case 'WORKER_STATUS_CHANGED':
            eventsRef.current.onWorkerStatusChanged?.(message.data);
            break;
          case 'STORAGE_ALERT':
            eventsRef.current.onStorageAlert?.(message.data);
            break;
          case 'ERROR_ALERT':
            eventsRef.current.onErrorAlert?.(message.data);
            break;
          case 'ORDERS_UPDATED':
            eventsRef.current.onOrdersUpdated?.(message.data);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      wsRef.current = null;
      // If server revoked session or forbidden (code 4001), do not reconnect
      if (event.code === 4001) {
        console.warn('[useStationWebSocket] Session revoked or station access denied.');
        return;
      }
      // Reconnect after 3 seconds
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [stationId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
