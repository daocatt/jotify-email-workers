import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'dashboard'>('login');
  const [config, setConfig] = useState<any>({ allowRegister: true, requireApproval: true, maxDomainsPerUser: 1 });

  // Check login session on load
  useEffect(() => {
    fetchSession();
    fetchConfig();
  }, []);

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
        setView('dashboard');
      } else {
        setUser(null);
        setSession(null);
        setView('login');
      }
    } catch {
      setView('login');
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
      setView('login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="animate-spin text-indigo-600 h-10 w-10" />
      </div>
    );
  }

  if (view === 'login') {
    return <Login config={config} setView={setView} onLoginSuccess={fetchSession} />;
  }

  if (view === 'register') {
    return <Register config={config} setView={setView} />;
  }

  if (view === 'forgot') {
    return <ForgotPassword config={config} setView={setView} />;
  }

  if (view === 'dashboard') {
    return <Dashboard user={user} config={config} onLogout={handleLogout} />;
  }

  return null;
}
