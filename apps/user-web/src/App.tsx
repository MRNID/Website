import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StatusBanner, SessionState } from './components/StatusBanner';
import { CameraViewport } from './components/CameraViewport';
import { ActionControls } from './components/ActionControls';
import { PackingHistory } from './components/PackingHistory';
import { OrderPackingSlip } from './components/OrderPackingSlip';
import { DuplicateWarningModal } from './components/DuplicateWarningModal';
import { ForceUnlockModal } from './components/ForceUnlockModal';
import { LoginModal } from './components/LoginModal';
import { api, UserSession, StationInfo } from './services/api';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { useStationWebSocket } from './hooks/useStationWebSocket';
import { sounds } from './utils/audio';

export default function App() {
  // Session & User
  const [user, setUser] = useState<UserSession | null>(null);
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [currentStation, setCurrentStation] = useState<StationInfo | null>(null);

  // Packing Session State
  const [sessionState, setSessionState] = useState<SessionState>('IDLE');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string>('');
  const [trackingInput, setTrackingInput] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [completedHash, setCompletedHash] = useState<string | null>(null);
  const [completedDuration, setCompletedDuration] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Order & Checklist State
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(null);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [orderPlatform, setOrderPlatform] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isSeedingOrders, setIsSeedingOrders] = useState<boolean>(false);

  // Modals & Popups
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ trackingCode: string; previousPackedAt?: string } | null>(null);
  const [isForceUnlockOpen, setIsForceUnlockOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Diagnostics & History
  const [workerOnline, setWorkerOnline] = useState<boolean>(true);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const timerRef = useRef<any>(null);

  // Load pending orders queue
  const loadOrdersQueue = useCallback(async () => {
    try {
      const orders = await api.getOrders();
      // Filter out completed ones or show pending
      const pending = orders.filter((o: any) => o.packingStatus !== 'COMPLETED');
      setPendingOrders(pending);
    } catch (err) {
      console.error('Failed to load pending orders:', err);
    }
  }, []);

  // 1. Initial Authentication & Station bootstrap
  const initApp = useCallback(async () => {
    try {
      const loggedUser = await api.getCurrentUser();
      setUser({
        id: loggedUser.id,
        username: loggedUser.username,
        fullName: loggedUser.fullName,
        role: loggedUser.role,
        warehouseId: loggedUser.warehouseId,
        accessToken: api.getToken() || ''
      });
    } catch {
      setIsLoginOpen(true);
      return;
    }

    try {
      const stationList = await api.getStations();
      setStations(stationList);
      if (stationList.length > 0 && !currentStation) {
        setCurrentStation(stationList[0]);
      }
    } catch (err) {
      console.error('Failed to load stations:', err);
    }

    loadOrdersQueue();
  }, [currentStation, loadOrdersQueue]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Load recent history whenever station changes
  const loadRecentHistory = useCallback(async () => {
    if (!currentStation) return;
    setHistoryLoading(true);
    try {
      const list = await api.getRecentSessions(currentStation.id, 15);
      setRecentSessions(list);
    } catch (err) {
      console.error('Failed to fetch recent sessions:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentStation]);

  useEffect(() => {
    loadRecentHistory();
  }, [loadRecentHistory]);

  // 2. Timer management
  useEffect(() => {
    if (sessionState === 'RECORDING') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionState]);

  // 3. WebSocket Integration
  const { isConnected: wsConnected } = useStationWebSocket(currentStation?.id || null, {
    onSessionStateChanged: (data) => {
      console.log('[WS] State change event:', data);
      const newState = data.state as SessionState;
      setSessionState(newState);

      if (newState === 'RECORDING') {
        sounds.playRecordingStarted();
      } else if (newState === 'COMPLETED') {
        sounds.playPackingCompleted();
        loadRecentHistory().then(async () => {
          if (sessionId) {
            try {
              const sess = await api.getRecentSessions(currentStation?.id || '', 1);
              if (sess.length > 0 && sess[0].video) {
                setCompletedHash(sess[0].video.sha256);
                setCompletedDuration(sess[0].video.duration);
              }
            } catch {
              // Ignore
            }
          }
        });
        loadOrdersQueue();
      } else if (newState === 'FAILED' || newState === 'INDETERMINATE_TIMEOUT') {
        sounds.playErrorBuzz();
        setErrorMessage(`Phiên quay kết thúc với trạng thái: ${newState}`);
        loadOrdersQueue();
      }
    },
    onWorkerStatusChanged: (data) => {
      setWorkerOnline(data.status === 'ONLINE');
    },
    onErrorAlert: (data) => {
      sounds.playErrorBuzz();
      setErrorMessage(data.message);
    }
  });

  // 4. Start Packing flow
  const executeStartPacking = async (codeToPack: string) => {
    if (!currentStation) return;
    const cleanCode = codeToPack.trim().toUpperCase();
    if (!cleanCode) return;

    setIsActionLoading(true);
    setErrorMessage(null);

    try {
      // Barcode validation & duplicate check
      const validation = await api.validateBarcode(cleanCode, currentStation.id);
      if (validation.isDuplicate) {
        sounds.playErrorBuzz();
        setDuplicateInfo({
          trackingCode: cleanCode,
          previousPackedAt: validation.previousPackedAt
        });
        setIsDuplicateModalOpen(true);
        setIsActionLoading(false);
        return;
      }

      // Populate order details & checklist
      setCurrentCustomer(validation.customer || null);
      setOrderCode(validation.orderCode || cleanCode);
      setOrderPlatform(validation.platform || 'SPX');
      setCheckedItems({});

      // Initiate session
      sounds.playScanSuccess();
      setTrackingCode(cleanCode);
      setTrackingInput(cleanCode);
      setSessionState('WAITING');
      setElapsedSeconds(0);

      const res = await api.startPacking({
        stationId: currentStation.id,
        trackingCode: cleanCode,
        platform: validation.platform
      });

      setSessionId(res.sessionId);
    } catch (err: any) {
      sounds.playErrorBuzz();
      setErrorMessage(err.message || 'Không thể bắt đầu phiên quay');
      setSessionState('FAILED');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 5. Stop Packing flow
  const handleStopPacking = async () => {
    if (!sessionId) return;
    setIsActionLoading(true);
    try {
      setSessionState('PROCESSING');
      await api.stopPacking(sessionId);
    } catch (err: any) {
      sounds.playErrorBuzz();
      setErrorMessage(err.message || 'Lỗi kết thúc phiên');
      setSessionState('FAILED');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 6. Cancel Packing flow
  const handleCancelPacking = async () => {
    if (!sessionId) {
      setSessionState('IDLE');
      setTrackingCode('');
      setTrackingInput('');
      setCurrentCustomer(null);
      return;
    }

    setIsActionLoading(true);
    try {
      await api.cancelPacking(sessionId, 'Operator cancelled via web');
      setSessionState('IDLE');
      setTrackingCode('');
      setTrackingInput('');
      setCurrentCustomer(null);
      setElapsedSeconds(0);
      loadRecentHistory();
      loadOrdersQueue();
    } catch (err: any) {
      sounds.playErrorBuzz();
      setErrorMessage(err.message || 'Lỗi hủy phiên');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Seed sample orders helper
  const handleSeedOrders = async () => {
    setIsSeedingOrders(true);
    try {
      await api.seedOrders();
      await loadOrdersQueue();
    } catch (err: any) {
      alert('Lỗi nạp đơn: ' + err.message);
    } finally {
      setIsSeedingOrders(false);
    }
  };

  // 7. Barcode Scanner Listener
  useBarcodeScanner({
    onScan: (scannedCode) => {
      console.log('[Scanner HID] Scanned barcode:', scannedCode);
      // If currently recording, do not accidentally overwrite without confirmation
      if (sessionState === 'RECORDING') {
        sounds.playErrorBuzz();
        alert(`Bạn đang quay kiện hàng ${trackingCode}! Hãy hoàn tất hoặc hủy trước khi quét mã mới.`);
        return;
      }
      executeStartPacking(scannedCode);
    },
    enabled: !isLoginOpen && !isDuplicateModalOpen && !isForceUnlockOpen
  });

  // 8. Global Keyboard Hotkeys [F2, F4, Space, Esc, F8]
  useEffect(() => {
    const handleKeyShortcuts = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside text input and key is Space
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'F2') {
        e.preventDefault();
        const inputElem = document.getElementById('barcode-input-field');
        if (inputElem) inputElem.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (sessionState === 'RECORDING') {
          handleStopPacking();
        }
      } else if (e.key === 'Escape') {
        if (sessionState === 'RECORDING' || sessionState === 'WAITING') {
          e.preventDefault();
          handleCancelPacking();
        }
      } else if (e.key === ' ' && !isInput) {
        e.preventDefault();
        if (sessionState === 'RECORDING') {
          handleStopPacking();
        } else if (sessionState === 'IDLE' && trackingInput.trim()) {
          executeStartPacking(trackingInput);
        }
      }
    };

    window.addEventListener('keydown', handleKeyShortcuts);
    return () => window.removeEventListener('keydown', handleKeyShortcuts);
  }, [sessionState, trackingInput, sessionId]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header
        user={user}
        stations={stations}
        currentStation={currentStation}
        onSelectStation={(st) => setCurrentStation(st)}
        workerOnline={workerOnline}
        wsConnected={wsConnected}
        onLogout={() => {
          api.setToken(null);
          setUser(null);
          setIsLoginOpen(true);
        }}
      />

      {/* Main Packing Station Workbench */}
      <main className="flex-1 p-5 flex flex-col space-y-4 overflow-hidden">
        {/* Giant Status Banner */}
        <StatusBanner
          state={sessionState}
          trackingCode={trackingCode}
          elapsedSeconds={elapsedSeconds}
          errorMessage={errorMessage}
          completedHash={completedHash}
          completedDuration={completedDuration}
        />

        {/* Center Grid: Viewport + Controls + History */}
        <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
          {/* Left Column: Camera Viewport + Order Checklist / Pending Queue (7 cols) */}
          <div className="col-span-7 flex flex-col space-y-3.5 h-full overflow-y-auto pr-1">
            <div className="h-[310px] shrink-0">
              <CameraViewport
                stationId={currentStation?.id}
                stationCode={currentStation?.code || 'PACK01'}
                cameraName={currentStation?.camera?.name || 'CAM_PACK01'}
                state={sessionState}
                trackingCode={trackingCode}
                elapsedSeconds={elapsedSeconds}
              />
            </div>

            <OrderPackingSlip
              trackingCode={trackingCode}
              orderCode={orderCode}
              platform={orderPlatform}
              customer={currentCustomer}
              checkedItems={checkedItems}
              onToggleItem={(idx) => setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              pendingOrders={pendingOrders}
              onSelectPendingOrder={(ord) => {
                setTrackingInput(ord.trackingCode);
                executeStartPacking(ord.trackingCode);
              }}
              onSeedOrders={handleSeedOrders}
              isSeeding={isSeedingOrders}
              isRecording={sessionState === 'RECORDING' || sessionState === 'PROCESSING'}
            />
          </div>

          {/* Right Column: Ergonomic Controls + Packed History (5 cols) */}
          <div className="col-span-5 flex flex-col space-y-4 h-full">
            <ActionControls
              state={sessionState}
              trackingInput={trackingInput}
              onChangeTrackingInput={(val) => setTrackingInput(val)}
              onSubmitTrackingInput={() => executeStartPacking(trackingInput)}
              onStartPacking={() => executeStartPacking(trackingInput)}
              onStopPacking={handleStopPacking}
              onCancelPacking={handleCancelPacking}
              onRetry={() => {
                setSessionState('IDLE');
                setErrorMessage(null);
                setCurrentCustomer(null);
              }}
              onOpenForceUnlock={() => setIsForceUnlockOpen(true)}
              isActionLoading={isActionLoading}
            />

            <div className="flex-1 min-h-0">
              <PackingHistory
                sessions={recentSessions}
                isLoading={historyLoading}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onSuccess={(u) => {
          setUser(u);
          setIsLoginOpen(false);
          initApp();
        }}
      />

      <DuplicateWarningModal
        isOpen={isDuplicateModalOpen}
        trackingCode={duplicateInfo?.trackingCode || ''}
        previousPackedAt={duplicateInfo?.previousPackedAt}
        onCancel={() => {
          setIsDuplicateModalOpen(false);
          setDuplicateInfo(null);
        }}
        onProceed={async () => {
          if (!duplicateInfo || !currentStation) return;
          setIsDuplicateModalOpen(false);
          setTrackingCode(duplicateInfo.trackingCode);
          setSessionState('WAITING');
          setElapsedSeconds(0);
          try {
            const res = await api.startPacking({
              stationId: currentStation.id,
              trackingCode: duplicateInfo.trackingCode,
              platform: 'SPX'
            });
            setSessionId(res.sessionId);
          } catch (err: any) {
            setErrorMessage(err.message || 'Lỗi quay đè');
            setSessionState('FAILED');
          }
        }}
      />

      <ForceUnlockModal
        isOpen={isForceUnlockOpen}
        stationCode={currentStation?.code || 'PACK01'}
        onConfirmUnlock={async (reason) => {
          if (!currentStation) return;
          await api.forceUnlock(currentStation.id, reason);
          setSessionState('IDLE');
          setTrackingCode('');
          setTrackingInput('');
          setErrorMessage(null);
          setCurrentCustomer(null);
          loadRecentHistory();
          loadOrdersQueue();
          setIsForceUnlockOpen(false);
        }}
        onClose={() => setIsForceUnlockOpen(false)}
      />
    </div>
  );
}
