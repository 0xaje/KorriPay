import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  Shield, 
  Wallet, 
  Settings, 
  Terminal, 
  HelpCircle, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  Building, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Activity
} from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Developers from './pages/Developers';
import Pay from './pages/Pay';
import SettlementSandbox from './pages/SettlementSandbox';
import NetworkOperations from './pages/NetworkOperations';
import SettlementEngine from './pages/SettlementEngine';
import ProofVerification from './pages/ProofVerification';
import ApiPlayground from './pages/ApiPlayground';
import Organization from './pages/Organization';

// Context for App State
export const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

function MainLayout({ children }) {
  const { user, logout, theme, toggleTheme } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { name: 'Organization Settings', path: '/organization', icon: Building },
    { name: 'Settlement Sandbox', path: '/sandbox', icon: FileText },
    { name: 'Settlement Engine', path: '/engine', icon: Layers },
    { name: 'Network Operations', path: '/operations', icon: Activity },
    { name: 'API Playground', path: '/playground', icon: Terminal },
    { name: 'Proof Verification', path: '/verify', icon: CheckCircle2 },
    { name: 'Admin Console', path: '/admin', icon: Shield, role: 'ADMIN' },
  ];

  const activeItem = navItems.find(item => location.pathname.startsWith(item.path)) || navItems[0];

  return (
    <div className="flex h-screen bg-background dark:bg-zinc-950 text-on-surface dark:text-zinc-100 transition-colors">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 sidebar-glass dark:bg-zinc-900/40 border-r border-outline-variant/30 dark:border-zinc-800/50 p-md justify-between">
        <div className="space-y-lg">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-secondary text-display-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            <span className="font-bold text-headline-md tracking-tight text-primary dark:text-white">KorriPay</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              if (item.role && user?.role !== item.role) return null;
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-sm px-4 py-3 rounded-xl font-label-md transition-all ${
                    isActive 
                      ? 'bg-primary text-white shadow-md dark:bg-zinc-800' 
                      : 'hover:bg-surface-container dark:hover:bg-zinc-800/40 text-on-surface-variant dark:text-zinc-400'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-sm">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-sm w-full px-4 py-3 rounded-xl hover:bg-surface-container dark:hover:bg-zinc-800/40 text-on-surface-variant dark:text-zinc-400 text-left transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <div className="flex items-center justify-between p-sm border-t border-outline-variant/20 dark:border-zinc-800/50">
            <div className="truncate pr-xs">
              <p className="font-bold text-xs truncate">{user?.name || 'Jane Doe'}</p>
              <p className="text-[10px] text-outline truncate">{user?.email || 'jane.doe@korri.pay'}</p>
            </div>
            <button 
              onClick={logout}
              className="p-xs hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - Mobile */}
        <header className="lg:hidden flex items-center justify-between p-sm bg-white dark:bg-zinc-900 border-b border-outline-variant/30 dark:border-zinc-800/50">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-secondary text-headline-lg">shield</span>
            <span className="font-bold text-headline-sm text-primary dark:text-white">KorriPay</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-xs hover:bg-surface-container dark:hover:bg-zinc-800/40 rounded-lg"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Sidebar - Mobile Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-64 bg-white dark:bg-zinc-900 p-md flex flex-col justify-between h-full shadow-xl animate-slide-up">
              <div className="space-y-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-secondary text-headline-lg">shield</span>
                    <span className="font-bold text-headline-sm text-primary dark:text-white">KorriPay</span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    if (item.role && user?.role !== item.role) return null;
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-sm px-4 py-3 rounded-xl font-label-md transition-all ${
                          isActive 
                            ? 'bg-primary text-white dark:bg-zinc-800' 
                            : 'hover:bg-surface-container dark:hover:bg-zinc-800/40 text-on-surface-variant'
                        }`}
                      >
                        <Icon size={18} />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="space-y-sm">
                <button 
                  onClick={() => {
                    toggleTheme();
                    setSidebarOpen(false);
                  }}
                  className="flex items-center gap-sm w-full px-4 py-3 rounded-xl hover:bg-surface-container dark:hover:bg-zinc-800/40 text-on-surface-variant text-left transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  </span>
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <div className="flex items-center justify-between p-sm border-t border-outline-variant/20">
                  <div className="truncate pr-xs">
                    <p className="font-bold text-xs truncate">{user?.name}</p>
                    <p className="text-[10px] text-outline truncate">{user?.email}</p>
                  </div>
                  <button onClick={logout} className="p-xs hover:bg-red-500/10 hover:text-red-500 rounded-lg">
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Render Panel */}
        <main className="flex-1 overflow-y-auto p-md lg:p-lg space-y-md">
          {children}
        </main>
      </div>
    </div>
  );
}

function AuthenticatedRoute({ children }) {
  const { user, loading } = useApp();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return user ? <MainLayout>{children}</MainLayout> : <Navigate to="/" />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    // Sync dark mode configuration
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Verify session on startup
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/wallet/summary').catch(() => null);
        if (res && res.ok) {
          // Resolve current user profile details
          const profileRes = await fetch('/api/compliance/passport');
          const profileData = await profileRes.json();
          if (profileData && profileData.success) {
            setUser({
              id: profileData.profile.userId,
              name: profileData.profile.user.name,
              email: profileData.profile.user.email,
              role: profileData.profile.user.role,
              walletAddress: profileData.profile.user.walletAddress
            });
          }
        }
      } catch (err) {
        console.warn('Session verification failed:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const logout = async () => {
    // Clear cookies by calling backend or local deletion
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
    window.location.href = "/";
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppContext.Provider value={{ user, setUser, loading, logout, theme, toggleTheme }}>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/dashboard" element={<AuthenticatedRoute><Dashboard /></AuthenticatedRoute>} />
          <Route path="/admin" element={<AuthenticatedRoute><Admin /></AuthenticatedRoute>} />
          <Route path="/developers" element={<AuthenticatedRoute><Developers /></AuthenticatedRoute>} />
          <Route path="/sandbox" element={<AuthenticatedRoute><SettlementSandbox /></AuthenticatedRoute>} />
          <Route path="/engine" element={<AuthenticatedRoute><SettlementEngine /></AuthenticatedRoute>} />
          <Route path="/operations" element={<AuthenticatedRoute><NetworkOperations /></AuthenticatedRoute>} />
          <Route path="/playground" element={<AuthenticatedRoute><ApiPlayground /></AuthenticatedRoute>} />
          <Route path="/organization" element={<AuthenticatedRoute><Organization /></AuthenticatedRoute>} />
          <Route path="/verify" element={user ? <MainLayout><ProofVerification /></MainLayout> : <div className="min-h-screen bg-background dark:bg-zinc-950 p-md lg:p-lg"><ProofVerification /></div>} />
          <Route path="/pay/:id" element={<Pay />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
}
