import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import Dashboard from './Dashboard';
import Docs from './Docs';
import { PublicConfig, DbUser } from './types';

export type AppView = 'login' | 'register' | 'forgot' | 'dashboard' | 'forceChangePassword' | 'docs';

export default function App() {
  const [user, setUser] = useState<DbUser | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/docs')) {
      return 'docs';
    }
    return 'login';
  });
  const [config, setConfig] = useState<PublicConfig>({ allowRegister: true, requireApproval: true, maxDomainsPerUser: 1, turnstileSiteKey: null });

  // Handle URL path changes & history popstate
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/docs')) {
        setView('docs');
      } else {
        if (user) {
          setView(mustChangePassword ? 'forceChangePassword' : 'dashboard');
        } else {
          setView('login');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, mustChangePassword]);

  // Check login session on load
  useEffect(() => {
    fetchSession();
    fetchConfig();
  }, []);

  const changeView = (newView: AppView) => {
    setView(newView);
    if (newView === 'docs') {
      if (window.location.pathname !== '/docs') {
        window.history.pushState({}, '', '/docs');
      }
    } else {
      if (window.location.pathname === '/docs') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/public/config');
      if (res.ok) {
        const data = await res.json() as any;
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch public config:', err);
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/user/me');
      if (res.ok) {
        const data = await res.json() as any;
        setUser(data.user);
        setSession(data.session);
        setMustChangePassword(!!data.mustChangePassword);
        // Only override view if not already directly visiting /docs
        if (!window.location.pathname.startsWith('/docs')) {
          setView(data.mustChangePassword ? 'forceChangePassword' : 'dashboard');
        }
      } else {
        setUser(null);
        setSession(null);
        if (!window.location.pathname.startsWith('/docs')) {
          setView('login');
        }
      }
    } catch {
      if (!window.location.pathname.startsWith('/docs')) {
        setView('login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    } finally {
      setUser(null);
      setSession(null);
      changeView('login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-3 font-mono text-sm text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (view === 'docs') {
    return (
      <Docs
        user={user}
        onBack={() => {
          if (user) {
            changeView(mustChangePassword ? 'forceChangePassword' : 'dashboard');
          } else {
            changeView('login');
          }
        }}
      />
    );
  }

  if (view === 'login') {
    return <Login config={config} setView={changeView} onLoginSuccess={fetchSession} />;
  }

  if (view === 'register') {
    return <Register config={config} setView={changeView} />;
  }

  if (view === 'forgot') {
    return <ForgotPassword config={config} setView={changeView} />;
  }

  if (view === 'forceChangePassword' && user) {
    return <Dashboard user={user} config={config} onLogout={handleLogout} onOpenDocs={() => changeView('docs')} forceChangePassword={mustChangePassword} onPasswordChanged={() => { setMustChangePassword(false); changeView('dashboard'); }} />;
  }

  if (view === 'dashboard') {
    return <Dashboard user={user!} config={config} onLogout={handleLogout} onOpenDocs={() => changeView('docs')} />;
  }

  return null;
}

