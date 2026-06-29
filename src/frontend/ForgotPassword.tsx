import React, { useState } from 'react';
import TurnstileWidget from './TurnstileWidget';
import { PublicConfig } from './types';

interface ForgotPasswordProps {
  config: PublicConfig;
  setView: (view: 'login' | 'register' | 'forgot' | 'dashboard') => void;
}

export default function ForgotPassword({ config, setView }: ForgotPasswordProps) {
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
        body: JSON.stringify({ email, type: 'reset' }),
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

  const handleForgotPassword = async (e: React.FormEvent) => {
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
      const res = await fetch('/api/public/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code, turnstileToken }),
      });
      const data = await res.json() as any;
      if (res.ok) {
        setAuthSuccess('密码重置成功，请使用新密码登录');
        setTimeout(() => setView('login'), 3000);
      } else {
        setAuthError(data.error || '密码重置失败');
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
        <div className="inline-flex items-center space-x-2 border border-gray-100 bg-gray-50/50 px-3 py-1.5 rounded-full text-xs font-mono text-gray-600 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Operational</span>
          <span className="text-gray-300">|</span>
          <span className="text-black font-medium">Jotify</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-black">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-gray-500">Recover access to your account</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-gray-100 py-8 px-6 sm:px-10 rounded">
          <form className="space-y-5" onSubmit={handleForgotPassword}>
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 font-mono">NEW PASSWORD</label>
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
              {isSubmitting ? 'Resetting...' : 'Reset password →'}
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
