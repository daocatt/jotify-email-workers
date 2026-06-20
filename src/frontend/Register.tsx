import React, { useState, useEffect } from 'react';
import { Globe, ShieldAlert, CheckCircle, Send } from 'lucide-react';

interface RegisterProps {
  config: any;
  setView: (view: 'login' | 'register' | 'forgot' | 'dashboard') => void;
}

export default function Register({ config, setView }: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
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

  const sendVerificationCode = async () => {
    if (!email) {
      setAuthError('请先输入电子邮箱');
      return;
    }
    setAuthError('');
    setAuthSuccess('');
    setSendCodeLoading(true);
    try {
      const res = await fetch('/api/public/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        setAuthSuccess('验证码已发送至您的邮箱，请注意查收');
      } else {
        setAuthError(data.error || '验证码发送失败');
      }
    } catch {
      setAuthError('网络错误，请稍后重试');
    } finally {
      setSendCodeLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (config.turnstileSiteKey && !turnstileToken) {
      setAuthError('请先完成人机验证');
      return;
    }
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, code, turnstileToken }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        setAuthSuccess(data.message);
        setTimeout(() => setView('login'), 3000);
      } else {
        setAuthError(data.error || '注册失败');
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
          注册新账号
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleRegister}>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">昵称 / 姓名</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="如 Admin"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">电子邮箱</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="name@domain.com"
                />
                <button
                  type="button"
                  disabled={sendCodeLoading}
                  onClick={sendVerificationCode}
                  className="px-3 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold rounded-lg hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  发送验证码
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">邮箱验证码</label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center font-mono tracking-widest"
                placeholder="输入 6 位验证码"
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
              注册并提交审核
            </button>
          </form>

          <div className="mt-6 flex justify-center text-xs text-indigo-600">
            <button onClick={() => setView('login')} className="hover:underline cursor-pointer">返回登录</button>
          </div>
        </div>
      </div>
    </div>
  );
}
