import React, { useState, useEffect } from 'react';
import { HardDrive, Video, Server, CheckCircle2, Save, Plus, Camera, Database, ShieldCheck } from 'lucide-react';
import { adminApi } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Storage Configs
  const [storageConfigs, setStorageConfigs] = useState<any[]>([]);

  // Settings Map
  const [settings, setSettings] = useState<Record<string, string>>({
    video_resolution: '1080p',
    video_fps: '30',
    max_recording_minutes: '15',
    duplicate_barcode_policy: 'WARN_AND_ALLOW_OVERRIDE',
    auto_nas_sync: 'true'
  });

  // Stations List
  const [stations, setStations] = useState<any[]>([]);
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [newStation, setNewStation] = useState({
    code: '',
    name: '',
    computerName: '',
    ipAddress: '',
    cameraName: '',
    cameraType: 'RTSP',
    rtspUrl: ''
  });

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [resSettings, resStations] = await Promise.all([
        adminApi.getSettings(),
        adminApi.getStations()
      ]);
      setStorageConfigs(resSettings.storageConfigs || []);
      setSettings(prev => ({ ...prev, ...(resSettings.settings || {}) }));
      setStations(resStations || []);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

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
      await adminApi.createStation(newStation);
      setIsAddStationOpen(false);
      setNewStation({
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

  const updateStorageField = (id: string, field: string, value: any) => {
    setStorageConfigs(prev => prev.map(sc => sc.id === id ? { ...sc, [field]: value } : sc));
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
            Thiết lập ổ cứng lưu trữ, quy định quay video, trạm đóng hàng và thông số mạng LAN
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
        </div>

        {/* Section 2: Video Recording Rules */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center space-x-3 border-b border-slate-700/80 pb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <Video className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                2. QUY CHUẨN QUAY VIDEO & QUY TẮC ĐÓNG GÓI
              </h3>
              <p className="text-xs text-slate-400">
                Độ phân giải, thời gian giới hạn một phiên quay và chính sách kiểm soát mã trùng
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5 text-xs">
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
                Thời gian quay tối đa / 1 đơn (Phút)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.max_recording_minutes}
                onChange={e => setSettings({ ...settings, max_recording_minutes: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-semibold focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Ngắt tự động nếu nhân viên quên dừng</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Chính sách khi quét trùng mã
              </label>
              <select
                value={settings.duplicate_barcode_policy}
                onChange={e => setSettings({ ...settings, duplicate_barcode_policy: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold focus:outline-none"
              >
                <option value="WARN_AND_ALLOW_OVERRIDE">Cảnh báo & Cho phép quay đè</option>
                <option value="BLOCK_STRICT">Chặn tuyệt đối (Không cho quay)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Stations and Cameras Management */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <Server className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  3. QUẢN LÝ TRẠM ĐÓNG HÀNG & CAMERA RTSP ({stations.length} TRẠM)
                </h3>
                <p className="text-xs text-slate-400">
                  Thêm bàn máy đóng hàng mới và cấu hình camera giám sát cho từng vị trí
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddStationOpen(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>THÊM TRẠM MỚI</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {stations.map(st => (
              <div key={st.id} className="bg-slate-900/80 border border-slate-700/70 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{st.code} - {st.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-emerald-400 border border-slate-700">
                    {st.status}
                  </span>
                </div>
                <div className="text-slate-400">
                  Máy tính: <strong className="text-slate-200 font-mono">{st.computerName || 'PACK-PC01'}</strong> ({st.ipAddress || '192.168.1.51'})
                </div>
                <div className="text-slate-400 flex items-center space-x-1">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>Camera: <strong className="text-slate-200">{st.camera?.name || 'CAM_' + st.code}</strong> ({st.camera?.type || 'RTSP'})</span>
                </div>
              </div>
            ))}
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
    </div>
  );
};
