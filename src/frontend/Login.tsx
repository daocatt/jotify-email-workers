import React, { useState, useEffect } from 'react';
import { Globe, ShieldAlert, CheckCircle } from 'lucide-react';

interface LoginProps {
  config: any;
  setView: (view: 'login' | 'register' | 'forgot' | 'dashboard') => void;
  onLoginSuccess: () => void;
}

export default function Login({ config, setView, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(!!(window as any).turnstile);

  useEffect(() => {
    if ((window as any).turnstile) {
      setTurnstileLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        setTurnstileLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (config.turnstileSiteKey && !turnstileToken) {
      setAuthError('请先完成人机验证');
      return;
    }
    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        onLoginSuccess();
      } else {
        setAuthError(data.message || '登录失败，请检查账号密码');
      }
    } catch {
      setAuthError('网络错误，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Globe className="mx-auto h-12 w-12 text-indigo-600" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
          登录 Jotify Email Worker
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleLogin}>
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{authSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">电子邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="name@domain.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="******"
              />
            </div>

            {config.turnstileSiteKey && (
              <div 
                key={`turnstile-${turnstileLoaded}`}
                ref={(el) => {
                  if (el && el.childNodes.length === 0 && (window as any).turnstile) {
                    try {
                      (window as any).turnstile.render(el, {
                        sitekey: config.turnstileSiteKey,
                        callback: (token: string) => {
                          setTurnstileToken(token);
                        },
                        'expired-callback': () => {
                          setTurnstileToken('');
                        }
                      });
                    } catch (err) {
                      // ignore
                    }
                  }
                }} 
                className="my-2 flex justify-center"
              ></div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors shadow-xs"
            >
              登录
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs text-indigo-600">
            {config.allowRegister ? (
              <button onClick={() => setView('register')} className="hover:underline cursor-pointer">注册账号</button>
            ) : (
              <span className="text-gray-400">自主注册已关闭</span>
            )}
            <button onClick={() => setView('forgot')} className="hover:underline cursor-pointer">忘记密码？</button>
          </div>
        </div>
      </div>
    </div>
  );
}
