import React, { useState, useEffect } from 'react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (isSubmitting) return;
    setAuthError('');
    if (config.turnstileSiteKey && !turnstileToken) {
      setAuthError('请先完成人机验证');
      return;
    }
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 bg-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-3xl font-black tracking-tight text-black">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-gray-500">Access your mail routing dashboard</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-gray-100 py-8 px-6 sm:px-10 rounded">
          <form className="space-y-5" onSubmit={handleLogin}>
            {authError && (
              <div className="border border-red-200 bg-red-50 text-red-700 px-3 py-2 rounded text-xs font-mono">
                <span>✗ {authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="border border-green-200 bg-green-50 text-green-700 px-3 py-2 rounded text-xs font-mono">
                <span>✓ {authSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">EMAIL</label>
              <input
                type="email"
                required
                disabled={isSubmitting}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-200 rounded font-mono focus:outline-none focus:border-black focus:ring-0 disabled:opacity-50 transition-colors"
                placeholder="name@domain.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">PASSWORD</label>
              <input
                type="password"
                required
                disabled={isSubmitting}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-200 rounded font-mono focus:outline-none focus:border-black focus:ring-0 disabled:opacity-50 transition-colors"
                placeholder="••••••"
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
              disabled={isSubmitting}
              className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded hover:bg-gray-800 active:bg-black cursor-pointer transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-1.5 tracking-tight"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs">
            {config.allowRegister ? (
              <button onClick={() => setView('register')} disabled={isSubmitting} className="text-gray-600 hover:text-black cursor-pointer disabled:opacity-50 transition-colors">注册账号</button>
            ) : (
              <span className="text-gray-400">自主注册已关闭</span>
            )}
            <button onClick={() => setView('forgot')} disabled={isSubmitting} className="text-gray-600 hover:text-black cursor-pointer disabled:opacity-50 transition-colors">忘记密码？</button>
          </div>
        </div>
      </div>
    </div>
  );
}
