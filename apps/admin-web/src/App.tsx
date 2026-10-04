import { useState, useEffect } from 'react';
import { Navbar, AdminTab } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { VideoSearchPage } from './pages/VideoSearchPage';
import { StationsPage } from './pages/StationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { adminApi, AdminUser } from './services/api';

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);

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
        {currentTab === 'dashboard' && (
          <DashboardPage onNavigateToVideos={() => setCurrentTab('videos')} />
        )}
        {currentTab === 'orders' && <OrdersPage />}
        {currentTab === 'videos' && <VideoSearchPage />}
        {currentTab === 'stations' && <StationsPage />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
