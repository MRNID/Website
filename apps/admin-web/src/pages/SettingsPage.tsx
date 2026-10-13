import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Video,
  CheckCircle2,
  Save,
  Plus,
  Camera,
  Database,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Edit3,
  HelpCircle,
  Activity,
  Trash2,
  Sliders,
  Building2,
  Warehouse,
  Filter,
  Search
} from 'lucide-react';
import { adminApi, AdminUser } from '../services/api';
import { CameraCalibrationModal } from '../components/CameraCalibrationModal';

interface SettingsPageProps {
  user?: AdminUser;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Storage Overview & Retention Cleanup
  const [storageOverview, setStorageOverview] = useState<any | null>(null);

  // Storage Configs
  const [storageConfigs, setStorageConfigs] = useState<any[]>([]);

  // Settings Map
  const [settings, setSettings] = useState<Record<string, string>>({
    video_resolution: '1080p',
    video_fps: '30',
    max_recording_minutes: '15',
    duplicate_barcode_policy: 'WARN_AND_ALLOW_OVERRIDE',
    auto_nas_sync: 'true',
    camera_rtsp_transport: 'tcp',
    camera_osd_watermark: 'true'
  });

  // Multi-tenant & Warehouse filter states
  const [tenants, setTenants] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('ALL');
  const [selectedWhId, setSelectedWhId] = useState<string>('ALL');
  const [stationSearch, setStationSearch] = useState<string>('');

  // Stations List
  const [stations, setStations] = useState<any[]>([]);
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState({
    warehouseId: '',
    code: '',
    name: '',
    computerName: '',
    ipAddress: '',
    cameraName: '',
    cameraType: 'RTSP',
    rtspUrl: ''
  });

  // Editing Station/Camera state
  const [editingStation, setEditingStation] = useState<any | null>(null);
  const [calibratingStation, setCalibratingStation] = useState<any | null>(null);

  // Camera connection test results: map of stationId/cameraId -> { testing, reachable, latencyMs, message }
  const [camTestStatus, setCamTestStatus] = useState<Record<string, { testing?: boolean; reachable?: boolean; latencyMs?: number; message?: string }>>({});
  const [modalTestStatus, setModalTestStatus] = useState<{ testing?: boolean; reachable?: boolean; latencyMs?: number; message?: string } | null>(null);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [resSettings, resStations, resOverview, resWh] = await Promise.all([
        adminApi.getSettings(),
        adminApi.getStations({
          businessId: selectedBizId !== 'ALL' ? selectedBizId : undefined,
          warehouseId: selectedWhId !== 'ALL' ? selectedWhId : undefined
        }),
        adminApi.getStorageOverview(30).catch(() => null),
        adminApi.getWarehouses(selectedBizId !== 'ALL' ? selectedBizId : undefined).catch(() => [])
      ]);
      setStorageConfigs(resSettings.storageConfigs || []);
      setSettings(prev => ({ ...prev, ...(resSettings.settings || {}) }));
      setStations(resStations || []);
      setWarehouses(resWh || []);
      if (resOverview) setStorageOverview(resOverview);

      if (user?.role === 'SUPER_ADMIN') {
        const resTenants = await adminApi.getTenants().catch(() => []);
        setTenants(resTenants || []);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    loadSettingsData();
  }, [selectedBizId, selectedWhId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await adminApi.updateSettings({
        storageConfigs,
        settings
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Lỗi lưu cấu hình: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStation.code || !newStation.name) {
      alert('Vui lòng nhập Mã trạm và Tên trạm');
      return;
    }
    try {
      await adminApi.createStation({
        ...newStation,
        warehouseId: newStation.warehouseId || (warehouses[0]?.id || undefined)
      });
      setIsAddStationOpen(false);
      setNewStation({
        warehouseId: '',
        code: '',
        name: '',
        computerName: '',
        ipAddress: '',
        cameraName: '',
        cameraType: 'RTSP',
        rtspUrl: ''
      });
      loadSettingsData();
    } catch (err: any) {
      alert(`Lỗi thêm trạm: ${err.message}`);
    }
  };

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;
    try {
      await adminApi.updateStation(editingStation.id, {
        warehouseId: editingStation.warehouseId,
        name: editingStation.name,
        code: editingStation.code,
        computerName: editingStation.computerName,
        ipAddress: editingStation.ipAddress,
        cameraName: editingStation.camera?.name,
        cameraType: editingStation.camera?.type || 'RTSP',
        rtspUrl: editingStation.camera?.rtspUrl
      });
      setEditingStation(null);
      setModalTestStatus(null);
      loadSettingsData();
    } catch (err: any) {
      alert(`Lỗi cập nhật trạm: ${err.message}`);
    }
  };

  const testCamera = async (key: string, rtspUrl: string, ipAddress?: string) => {
    setCamTestStatus(prev => ({ ...prev, [key]: { testing: true } }));
    try {
      const res = await adminApi.testCameraConnection({ rtspUrl, ipAddress });
      setCamTestStatus(prev => ({
        ...prev,
        [key]: {
          testing: false,
          reachable: res.reachable,
          latencyMs: res.latencyMs,
          message: res.message
        }
      }));
    } catch (err: any) {
      setCamTestStatus(prev => ({
        ...prev,
        [key]: {
          testing: false,
          reachable: false,
          message: err.message
        }
      }));
    }
  };

  const testModalCamera = async () => {
    if (!editingStation) return;
    setModalTestStatus({ testing: true });
    try {
      const res = await adminApi.testCameraConnection({
        rtspUrl: editingStation.camera?.rtspUrl,
        ipAddress: editingStation.ipAddress
      });
      setModalTestStatus({
        testing: false,
        reachable: res.reachable,
        latencyMs: res.latencyMs,
        message: res.message
      });
    } catch (err: any) {
      setModalTestStatus({
        testing: false,
        reachable: false,
        message: err.message
      });
    }
  };

  const updateStorageField = (id: string, field: string, value: any) => {
    setStorageConfigs(prev => prev.map(sc => sc.id === id ? { ...sc, [field]: value } : sc));
  };

  const applyRtspPreset = (presetType: string) => {
    if (!editingStation) return;
    let url = '';
    const ip = editingStation.ipAddress || '192.168.1.101';
    switch (presetType) {
      case 'hikvision':
        url = `rtsp://admin:Admin12345@${ip}:554/Streaming/Channels/101`;
        break;
      case 'dahua':
        url = `rtsp://admin:Admin12345@${ip}:554/cam/realmonitor?channel=1&subtype=0`;
        break;
      case 'ezviz':
        url = `rtsp://admin:VERIFICATION_CODE@${ip}:554/h264/ch1/main`;
        break;
      case 'uniview':
        url = `rtsp://admin:Admin12345@${ip}:554/unicast/c1/s0/live`;
        break;
      case 'webcam':
        url = 'video="Logitech Webcam C920"';
        break;
      case 'mock':
        url = 'rtsp://mock-camera/live';
        break;
    }
    setEditingStation({
      ...editingStation,
      camera: {
        ...(editingStation.camera || {}),
        type: presetType === 'webcam' ? 'USB' : 'RTSP',
        rtspUrl: url
      }
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm">
        Đang tải thông số cấu hình hệ thống...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">
            CẤU HÌNH TOÀN BỘ HỆ THỐNG
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Thiết lập ổ cứng lưu trữ, camera RTSP kho, quy định quay video và quản lý bàn đóng gói
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 bg-emerald-950 border border-emerald-500 rounded-xl text-emerald-200 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Đã lưu cấu hình thành công!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Storage & Retention */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                1. CẤU HÌNH LƯU TRỮ & VÒNG ĐỜI DỌN DẸP Ổ ĐĨA
              </h3>
              <p className="text-xs text-slate-400">
                Thư mục lưu video cục bộ (Local SSD) và đường dẫn máy chủ lưu trữ NAS / Server
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {storageConfigs.map(sc => {
              const label = sc.storage_type === 'LOCAL_TEMP'
                ? 'Thư mục đệm tạm (Local Temp SSD)'
                : sc.storage_type === 'LOCAL_ARCHIVE'
                ? 'Thư mục lưu trữ chính (Local Archive SSD)'
                : 'Thư mục chia sẻ NAS / Server (LAN UNC)';
              return (
                <div key={sc.id} className="bg-slate-900/80 rounded-2xl p-4 border border-slate-700/60 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block mb-1">{label}</span>
                    <input
                      type="text"
                      value={sc.path}
                      onChange={e => updateStorageField(sc.id, 'path', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Lưu cục bộ (ngày):</span>
                      <input
                        type="number"
                        min="1"
                        value={sc.local_retention_days}
                        onChange={e => updateStorageField(sc.id, 'local_retention_days', parseInt(e.target.value, 10))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Lưu NAS (ngày):</span>
                      <input
                        type="number"
                        min="1"
                        value={sc.retention_days}
                        onChange={e => updateStorageField(sc.id, 'retention_days', parseInt(e.target.value, 10))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Storage Retention & Cleanup Banner */}
          <div className="bg-slate-950/70 border border-slate-700/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>BẢN GỐC TẠI MÁY KHO • SAO LƯU GOOGLE DRIVE</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    CHƯA BẬT TỰ XÓA
                  </span>
                </h4>
                <div className="text-xs text-slate-400 mt-1 flex items-center space-x-4 font-mono">
                  <span>Tổng video: <strong className="text-white">{storageOverview?.totalVideos || 0}</strong> ({((storageOverview?.totalBytes || 0) / (1024 * 1024)).toFixed(1)} MB)</span>
                  <span>Được bảo vệ (Tranh chấp): <strong className="text-blue-400">{storageOverview?.lockedVideosCount || 0}</strong></span>
                  <span>Video trên 30 ngày: <strong className="text-amber-400">{storageOverview?.expiredVideosCount || 0}</strong> ({((storageOverview?.expiredBytes || 0) / (1024 * 1024)).toFixed(1)} MB)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              title="Chưa có chính sách xóa video tại kho và Google Drive"
              disabled
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>GIỮ NGUYÊN VIDEO</span>
            </button>
          </div>
        </div>

        {/* Section 2: Video Recording Rules */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <Video className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                2. QUY CHUẨN QUAY VIDEO & THÔNG SỐ CAMERA
              </h3>
              <p className="text-xs text-slate-400">
                Độ phân giải, tốc độ khung hình, giao thức truyền RTSP và Watermark đóng dấu
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Độ phân giải video (Resolution)
              </label>
              <select
                value={settings.video_resolution}
                onChange={e => setSettings({ ...settings, video_resolution: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
              >
                <option value="1080p">Full HD (1920x1080) - Khuyên dùng</option>
                <option value="720p">HD (1280x720) - Tiết kiệm ổ cứng</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Tốc độ khung hình (FPS)
              </label>
              <select
                value={settings.video_fps}
                onChange={e => setSettings({ ...settings, video_fps: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
              >
                <option value="30">30 FPS (Mượt mà, chuẩn bằng chứng sàn)</option>
                <option value="25">25 FPS (Chuẩn PAL kho hàng)</option>
                <option value="15">15 FPS (Tối giản dung lượng)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Giao thức RTSP Transport
              </label>
              <select
                value={settings.camera_rtsp_transport || 'tcp'}
                onChange={e => setSettings({ ...settings, camera_rtsp_transport: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
              >
                <option value="tcp">TCP (Khuyên dùng - Không rớt khung hình)</option>
                <option value="udp">UDP (Độ trễ thấp - Dễ méo hình khi mạng bận)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Thời gian quay tối đa / đơn (Phút)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.max_recording_minutes}
                onChange={e => setSettings({ ...settings, max_recording_minutes: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Đóng dấu OSD (Watermark)
              </label>
              <select
                value={settings.camera_osd_watermark || 'true'}
                onChange={e => setSettings({ ...settings, camera_osd_watermark: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
              >
                <option value="true">BẬT (In Mã Vận Đơn & Thời gian ms)</option>
                <option value="false">TẮT (Chỉ quay hình mộc)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Stations and Cameras Detailed Management */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>3. QUẢN LÝ BÀN ĐÓNG HÀNG & CẤU HÌNH CAMERA RTSP</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-700/50 text-purple-300 text-xs font-mono">
                    {stations.length} Camera / Trạm
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Mỗi trạm đóng gói được gắn 1 camera riêng biệt. Quản lý phân quyền theo từng Doanh nghiệp & Kho hàng
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddStationOpen(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-lg shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>THÊM TRẠM & CAMERA MỚI</span>
            </button>
          </div>

          {/* Scoping Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-700/70 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
                <Filter className="w-4 h-4 text-purple-400" />
                <span>Lọc theo:</span>
              </div>

              {/* Company / Tenant Filter (SUPER_ADMIN) */}
              {user?.role === 'SUPER_ADMIN' && (
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <select
                    value={selectedBizId}
                    onChange={e => {
                      setSelectedBizId(e.target.value);
                      setSelectedWhId('ALL');
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:outline-none focus:border-purple-500"
                  >
                    <option value="ALL">🏢 Tất cả Doanh nghiệp / Shop</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warehouse Filter */}
              <div className="flex items-center space-x-1.5">
                <Warehouse className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={selectedWhId}
                  onChange={e => setSelectedWhId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">📦 Tất cả Kho hàng</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm mã trạm, tên, IP..."
                value={stationSearch}
                onChange={e => setStationSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Camera Grid Cards */}
          <div className="grid grid-cols-2 gap-4">
            {stations
              .filter(st => {
                if (stationSearch) {
                  const q = stationSearch.toLowerCase();
                  return (
                    st.name?.toLowerCase().includes(q) ||
                    st.code?.toLowerCase().includes(q) ||
                    st.computerName?.toLowerCase().includes(q) ||
                    st.ipAddress?.toLowerCase().includes(q) ||
                    st.businessName?.toLowerCase().includes(q) ||
                    st.warehouseName?.toLowerCase().includes(q) ||
                    st.camera?.rtspUrl?.toLowerCase().includes(q)
                  );
                }
                return true;
              })
              .map(st => {
                const test = camTestStatus[st.id] || {};
                const rtspDisplay = st.camera?.rtspUrl || 'rtsp://mock-camera/live';
                const camType = st.camera?.type || 'RTSP';

                return (
                  <div key={st.id} className="bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-5 text-xs flex flex-col justify-between shadow-xl transition space-y-4">
                    {/* Card Header: Station Identity & Status */}
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-start space-x-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-950/90 border border-blue-500/50 text-blue-300 font-mono font-bold text-xs shrink-0 tracking-wider shadow-inner">
                          {st.code}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-base block leading-snug truncate" title={st.name}>
                            {st.name}
                          </span>

                          {/* Scope tags: Company & Warehouse & PC */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {st.businessName && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-800/60 text-purple-300 text-[10px] font-medium">
                                <Building2 className="w-3 h-3 mr-1 text-purple-400" />
                                {st.businessName}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-medium">
                              <Warehouse className="w-3 h-3 mr-1 text-amber-400" />
                              {st.warehouseName || 'Kho trung tâm'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                              PC: <strong className="text-slate-300">{st.computerName || 'PACK-PC'}</strong> ({st.ipAddress || '192.168.1.50'})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center space-x-1.5 ${
                          st.status === 'ONLINE' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${st.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span>{st.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Body: Camera Details */}
                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Camera className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="font-bold text-slate-200 text-xs">{st.camera?.name || 'CAM_' + st.code}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 text-[10px] font-mono border border-slate-700">
                          {camType}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">URL Luồng RTSP Stream:</span>
                        <div className="font-mono text-[11px] text-emerald-400 break-all bg-black/60 px-3 py-2 rounded-lg border border-slate-800/90 select-all">
                          {rtspDisplay}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Connection Status & Dedicated Action Buttons */}
                    <div className="border-t border-slate-800/90 pt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={test.testing}
                          onClick={() => testCamera(st.id, rtspDisplay, st.ipAddress)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl text-xs flex items-center space-x-1.5 border border-slate-700 shadow-sm transition cursor-pointer"
                        >
                          {test.testing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>{test.testing ? 'Đang ping...' : 'Test Ping RTSP'}</span>
                        </button>

                        {test.reachable !== undefined && !test.testing && (
                          <div className={`text-[11px] flex items-center space-x-1 font-bold ${
                            test.reachable ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {test.reachable ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                            <span className="truncate max-w-[140px]" title={test.message}>{test.reachable ? 'Kết nối OK' : 'Không kết nối'}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setCalibratingStation(st)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-900/30 transition cursor-pointer"
                          title="Cân chỉnh mắt camera: Zoom thu phóng & xoay lên/xuống/trái/phải"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Chỉnh Mắt Cam & Zoom</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStation(JSON.parse(JSON.stringify(st)))}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Sửa Camera</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Quick Camera Setup Best Practices Banner */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-300">
            <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white block">Cẩm nang góc quay & cài đặt Camera đóng gói chuẩn:</span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                • <strong>Vị trí đặt Camera:</strong> Treo cách mặt bàn đóng hàng từ <strong>1.2m - 1.6m</strong>, góc nghiêng <strong>65° - 75°</strong> nhìn thẳng vào vị trí dán nhãn vận đơn.<br />
                • <strong>Cài đặt Camera IP:</strong> Cố định IP trên Switch/Router (Static IP), dùng chuẩn mã hóa H.264 Baseline/Main Profile (để FFmpeg đóng gói fMP4 không bị delay), framerate 25-30fps.<br />
                • <strong>Tài khoản Camera:</strong> Nên tạo tài khoản con (ví dụ: <code className="text-emerald-400">packer / Pack@123</code>) trên Camera chỉ có quyền xem luồng RTSP (Live View) để đảm bảo an ninh mạng LAN.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Database & System Status */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                4. CƠ SỞ DỮ LIỆU & THÔNG TIN HỆ THỐNG
              </h3>
              <p className="text-xs text-slate-400">
                Thông số kết nối Microsoft SQL Server cục bộ và phiên bản hệ thống
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">SQL Server Host:</span>
              <span className="font-mono font-bold text-white text-sm">.\SQLEXPRESS</span>
            </div>
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Database Name:</span>
              <span className="font-mono font-bold text-white text-sm">packing_proof_db</span>
            </div>
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Phiên bản:</span>
                <span className="font-bold text-emerald-400 text-sm">v1.0.0 Enterprise LAN</span>
              </div>
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black text-sm rounded-2xl flex items-center space-x-2 shadow-xl shadow-emerald-900/30 transition cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'ĐANG LƯU...' : 'LƯU TOÀN BỘ CẤU HÌNH HỆ THỐNG'}</span>
          </button>
        </div>
      </form>

      {/* Modal Edit Station & Camera */}
      {editingStation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-purple-400" />
                <span>CHỈNH SỬA BÀN ĐÓNG GÓI & CAMERA {editingStation.code}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingStation(null);
                  setModalTestStatus(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mã trạm:</label>
                  <input
                    type="text"
                    required
                    value={editingStation.code}
                    onChange={e => setEditingStation({ ...editingStation, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tên trạm:</label>
                  <input
                    type="text"
                    required
                    value={editingStation.name}
                    onChange={e => setEditingStation({ ...editingStation, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tên máy tính (Computer Name):</label>
                  <input
                    type="text"
                    value={editingStation.computerName || ''}
                    onChange={e => setEditingStation({ ...editingStation, computerName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Địa chỉ IP:</label>
                  <input
                    type="text"
                    value={editingStation.ipAddress || ''}
                    onChange={e => setEditingStation({ ...editingStation, ipAddress: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kho hàng trực thuộc:</label>
                <select
                  value={editingStation.warehouseId || ''}
                  onChange={e => setEditingStation({ ...editingStation, warehouseId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
                >
                  <option value="">-- Chọn Kho hàng --</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code}) {wh.businessName ? `— ${wh.businessName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Section inside Modal */}
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tên Camera:</label>
                    <input
                      type="text"
                      value={editingStation.camera?.name || ''}
                      onChange={e => setEditingStation({
                        ...editingStation,
                        camera: { ...(editingStation.camera || {}), name: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Loại Camera:</label>
                    <select
                      value={editingStation.camera?.type || 'RTSP'}
                      onChange={e => setEditingStation({
                        ...editingStation,
                        camera: { ...(editingStation.camera || {}), type: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-semibold focus:outline-none"
                    >
                      <option value="RTSP">Camera IP RTSP (Kho khuyến nghị)</option>
                      <option value="USB">USB Webcam / DirectShow</option>
                      <option value="WEBRTC">WebRTC Trình duyệt</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">URL Luồng RTSP Stream:</label>
                    <span className="text-[10px] text-slate-400">Chọn mẫu nhanh:</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => applyRtspPreset('hikvision')}
                      className="px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-300 text-[10px] font-bold border border-blue-700"
                    >
                      Hikvision / HiLook
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRtspPreset('dahua')}
                      className="px-2 py-0.5 rounded bg-orange-900/60 hover:bg-orange-800 text-orange-300 text-[10px] font-bold border border-orange-700"
                    >
                      Dahua / Imou
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRtspPreset('ezviz')}
                      className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-300 text-[10px] font-bold border border-purple-700"
                    >
                      Ezviz
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRtspPreset('uniview')}
                      className="px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 text-[10px] font-bold border border-emerald-700"
                    >
                      Uniview
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRtspPreset('webcam')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-600"
                    >
                      Webcam USB
                    </button>
                  </div>

                  <input
                    type="text"
                    value={editingStation.camera?.rtspUrl || ''}
                    onChange={e => setEditingStation({
                      ...editingStation,
                      camera: { ...(editingStation.camera || {}), rtspUrl: e.target.value }
                    })}
                    placeholder="rtsp://admin:pass@192.168.1.101:554/Streaming/Channels/101"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Modal Test Connection Button & Result */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    {modalTestStatus?.testing ? (
                      <span className="text-[11px] text-amber-400 flex items-center space-x-1 font-medium animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Đang kiểm tra kết nối port 554...</span>
                      </span>
                    ) : modalTestStatus?.reachable !== undefined ? (
                      <span className={`text-[11px] font-bold flex items-center space-x-1 ${
                        modalTestStatus.reachable ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {modalTestStatus.reachable ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        <span>{modalTestStatus.message}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Bấm nút để kiểm tra thử kết nối</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={modalTestStatus?.testing}
                    onClick={testModalCamera}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold rounded-lg border border-slate-700 flex items-center space-x-1"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Thử kết nối Camera</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStation(null);
                    setModalTestStatus(null);
                  }}
                  className="py-2.5 bg-slate-700 text-slate-200 font-bold rounded-xl"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Station */}
      {isAddStationOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>THÊM BÀN ĐÓNG HÀNG & CAMERA MỚI</span>
            </h3>

            <form onSubmit={handleAddStation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Mã trạm (VD: PACK02):</label>
                  <input
                    type="text"
                    required
                    value={newStation.code}
                    onChange={e => setNewStation({ ...newStation, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Tên trạm hiển thị:</label>
                  <input
                    type="text"
                    required
                    value={newStation.name}
                    onChange={e => setNewStation({ ...newStation, name: e.target.value })}
                    placeholder="Bàn đóng hàng số 2"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Tên máy tính (Computer Name):</label>
                  <input
                    type="text"
                    value={newStation.computerName}
                    onChange={e => setNewStation({ ...newStation, computerName: e.target.value })}
                    placeholder="PACK-PC-02"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Địa chỉ IP:</label>
                  <input
                    type="text"
                    value={newStation.ipAddress}
                    onChange={e => setNewStation({ ...newStation, ipAddress: e.target.value })}
                    placeholder="192.168.1.52"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Kho hàng trực thuộc:</label>
                <select
                  value={newStation.warehouseId}
                  onChange={e => setNewStation({ ...newStation, warehouseId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
                >
                  <option value="">-- Mặc định kho hiện tại --</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code}) {wh.businessName ? `— ${wh.businessName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">URL Camera RTSP (hoặc để trống nếu dùng Webcam):</label>
                <input
                  type="text"
                  value={newStation.rtspUrl}
                  onChange={e => setNewStation({ ...newStation, rtspUrl: e.target.value })}
                  placeholder="rtsp://admin:pass@192.168.1.102:554/Streaming/Channels/101"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddStationOpen(false)}
                  className="py-2.5 bg-slate-700 text-slate-200 font-bold rounded-xl"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  TẠO TRẠM MỚI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Calibration & Zoom Modal */}
      <CameraCalibrationModal
        isOpen={!!calibratingStation}
        station={calibratingStation}
        onClose={() => setCalibratingStation(null)}
      />
    </div>
  );
};
