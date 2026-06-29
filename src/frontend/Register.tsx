import React, { useState } from 'react';
import TurnstileWidget from './TurnstileWidget';
import { PublicConfig } from './types';

interface RegisterProps {
  config: PublicConfig;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendVerificationCode = async () => {
    if (!email) {
      setAuthError('请先输入电子邮箱');
      return;
    }
    if (sendCodeLoading || isSubmitting) return;
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
    if (isSubmitting) return;
    setAuthError('');
    setAuthSuccess('');
    if (config.turnstileSiteKey && !turnstileToken) {
      setAuthError('请先完成人机验证');
      return;
    }
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 bg-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-3xl font-black tracking-tight text-black">
          Create account
        </h1>
        <p className="mt-2 text-sm text-gray-500">Register a new mailbox dashboard account</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-gray-100 py-8 px-6 sm:px-10 rounded">
          <form className="space-y-5" onSubmit={handleRegister}>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">NAME</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-200 rounded focus:outline-none focus:border-black focus:ring-0 disabled:opacity-50 transition-colors"
                placeholder="如 Admin"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">EMAIL</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-sm px-3.5 py-2 border border-gray-200 rounded font-mono focus:outline-none focus:border-black focus:ring-0 disabled:opacity-50 transition-colors"
                  placeholder="name@domain.com"
                />
                <button
                  type="button"
                  disabled={sendCodeLoading || isSubmitting}
                  onClick={sendVerificationCode}
                  className="px-3 text-xs bg-gray-50 text-black border border-gray-200 font-semibold rounded hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  {sendCodeLoading ? '...' : '发送验证码'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">VERIFICATION CODE</label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full text-sm px-3.5 py-2 border border-gray-200 rounded focus:outline-none focus:border-black focus:ring-0 text-center font-mono tracking-widest disabled:opacity-50 transition-colors"
                placeholder="------"
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
              <TurnstileWidget siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-black text-white text-sm font-semibold rounded hover:bg-gray-800 active:bg-black cursor-pointer transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-1.5 tracking-tight"
            >
              {isSubmitting ? 'Submitting...' : 'Register →'}
            </button>
          </form>

          <div className="mt-6 flex justify-center text-xs">
            <button onClick={() => setView('login')} disabled={isSubmitting} className="text-gray-600 hover:text-black cursor-pointer disabled:opacity-50 transition-colors">← 返回登录</button>
          </div>
        </div>
      </div>
    </div>
  );
}
