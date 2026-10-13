import { useState, useEffect } from 'react';
import { Navbar, AdminTab } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { VideoSearchPage } from './pages/VideoSearchPage';
import { StationsPage } from './pages/StationsPage';
import { TenantsPage } from './pages/TenantsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { adminApi, AdminUser } from './services/api';

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [currentTab, setCurrentTab] = useState<AdminTab>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (['dashboard', 'orders', 'videos', 'stations', 'settings', 'tenants', 'users'].includes(hash)) {
      return hash as AdminTab;
    }
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tabParam = params?.get('tab');
    if (tabParam && ['dashboard', 'orders', 'videos', 'stations', 'settings', 'tenants', 'users'].includes(tabParam)) {
      return tabParam as AdminTab;
    }
    return 'dashboard';
  });
  const [loading, setLoading] = useState(true);
  const [driveCallbackStatus, setDriveCallbackStatus] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('google_status');
    return status === 'success' || status === 'error' ? status : null;
  });

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'orders', 'videos', 'stations', 'settings', 'tenants', 'users'].includes(hash)) {
        setCurrentTab(hash as AdminTab);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const loggedUser = await adminApi.getMe();
        setUser({
          id: loggedUser.id,
          username: loggedUser.username,
          fullName: loggedUser.fullName,
          role: loggedUser.role,
          warehouseId: loggedUser.warehouseId,
          businessId: loggedUser.businessId,
          businessName: loggedUser.businessName,
          accessToken: adminApi.getToken() || ''
        });
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Guard: Non-super-admins cannot access SaaS Tenants management
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN' && currentTab === 'tenants') {
      setCurrentTab('orders');
    }
  }, [user, currentTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Đang tải hệ thống quản trị...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(t) => setCurrentTab(t)}
        user={user}
        onLogout={() => {
          adminApi.setToken(null);
          setUser(null);
        }}
      />

      <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
        {driveCallbackStatus && (
          <div role="status" className="mb-4 rounded-xl border border-slate-600 bg-slate-800 p-4 text-sm text-slate-100 flex justify-between gap-4">
            <span>{driveCallbackStatus === 'success'
              ? 'Đã liên kết Google Drive. Bạn có thể tải tệp kiểm tra để xác nhận kết nối.'
              : 'Liên kết Google Drive thất bại. Kiểm tra cấu hình và quyền truy cập rồi thử lại.'}</span>
            <button onClick={() => {
              setDriveCallbackStatus(null);
              const url = new URL(window.location.href);
              ['google_status', 'msg', 'email'].forEach(key => url.searchParams.delete(key));
              window.history.replaceState(null, '', url);
            }}>Đóng</button>
          </div>
        )}
        {currentTab === 'dashboard' && (
          <DashboardPage onNavigateToVideos={() => setCurrentTab('videos')} />
        )}
        {currentTab === 'orders' && <OrdersPage />}
        {currentTab === 'videos' && <VideoSearchPage />}
        {currentTab === 'stations' && <StationsPage user={user} />}
        {currentTab === 'tenants' && user.role === 'SUPER_ADMIN' && <TenantsPage user={user} />}
        {currentTab === 'users' && <UsersPage />}
        {currentTab === 'settings' && <SettingsPage user={user} />}
      </main>
    </div>
  );
}
