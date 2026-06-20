import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, LogOut, Plus, Trash2, Key, Users, CheckCircle,
  XCircle, Mail, Globe, Server, Link, AlertCircle, RefreshCw, Send,
  Menu, X
} from 'lucide-react';

interface DashboardProps {
  user: any;
  config: any;
  onLogout: () => void;
}

export default function Dashboard({ user, config, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'domains' | 'destinations' | 'forwardRules' | 'webhooks' | 'webhookRules' | 'admin' | 'superadmin' | 'help'>('domains');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Data states
  const [domains, setDomains] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [forwardRules, setForwardRules] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookRules, setWebhookRules] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Input states for creation
  const [newDomain, setNewDomain] = useState('');
  const [newDestination, setNewDestination] = useState('');

  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleSubdomain, setNewRuleSubdomain] = useState('');
  const [newRuleDomainId, setNewRuleDomainId] = useState('');
  const [newRuleDestId, setNewRuleDestId] = useState('');

  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookAuthType, setNewWebhookAuthType] = useState('none');
  const [newWebhookAuthToken, setNewWebhookAuthToken] = useState('');

  const [newWebhookRulePattern, setNewWebhookRulePattern] = useState('');
  const [newWebhookRuleSubdomain, setNewWebhookRuleSubdomain] = useState('');
  const [newWebhookRuleDomainId, setNewWebhookRuleDomainId] = useState('');
  const [newWebhookRuleWebhookId, setNewWebhookRuleWebhookId] = useState('');

  // Admin/Superadmin input states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      if (activeTab === 'domains') {
        const res = await fetch('/api/domains');
        if (res.ok) setDomains(((await res.json()) as any).domains || []);
      } else if (activeTab === 'destinations') {
        const res = await fetch('/api/destinations');
        if (res.ok) setDestinations(((await res.json()) as any).destinations || []);
      } else if (activeTab === 'forwardRules') {
        const dRes = await fetch('/api/domains');
        const dsRes = await fetch('/api/destinations');
        const rRes = await fetch('/api/forward-rules');
        if (dRes.ok && dsRes.ok && rRes.ok) {
          setDomains(((await dRes.json()) as any).domains || []);
          setDestinations(((await dsRes.json()) as any).destinations || []);
          setForwardRules(((await rRes.json()) as any).rules || []);
        }
      } else if (activeTab === 'webhooks') {
        const res = await fetch('/api/webhooks');
        if (res.ok) setWebhooks(((await res.json()) as any).webhooks || []);
      } else if (activeTab === 'webhookRules') {
        const dRes = await fetch('/api/domains');
        const wRes = await fetch('/api/webhooks');
        const rRes = await fetch('/api/webhook-rules');
        if (dRes.ok && wRes.ok && rRes.ok) {
          setDomains(((await dRes.json()) as any).domains || []);
          setWebhooks(((await wRes.json()) as any).webhooks || []);
          setWebhookRules(((await rRes.json()) as any).rules || []);
        }
      } else if (activeTab === 'admin' || activeTab === 'superadmin') {
        const res = await fetch('/api/admin/users');
        if (res.ok) setUsersList(((await res.json()) as any).users || []);
      }
    } catch (err) {
      console.error('Error fetching tab data:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        alert('密码修改成功！');
        setShowPasswordModal(false);
        setNewPassword('');
      } else {
        const data = await res.json() as any;
        alert(`修改失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      if (res.ok) {
        setNewDomain('');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteDomain = async (id: number) => {
    if (!confirm('确定删除此接收域名吗？这会连带删除与它相关的规则。')) return;
    try {
      const res = await fetch(`/api/domains/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const addDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestination.trim()) return;
    try {
      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newDestination }),
      });
      if (res.ok) {
        setNewDestination('');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteDestination = async (id: number) => {
    if (!confirm('确定删除此转发目标邮箱吗？这会连带删除与它相关的规则。')) return;
    try {
      const res = await fetch(`/api/destinations/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const addForwardRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern || !newRuleDomainId || !newRuleDestId) return;
    try {
      const res = await fetch('/api/forward-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernamePattern: newRulePattern,
          subdomain: newRuleSubdomain || null,
          domainId: parseInt(newRuleDomainId),
          destinationId: parseInt(newRuleDestId),
        }),
      });
      if (res.ok) {
        setNewRulePattern('');
        setNewRuleSubdomain('');
        setNewRuleDomainId('');
        setNewRuleDestId('');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteForwardRule = async (id: number) => {
    if (!confirm('确定删除此转发规则吗？')) return;
    try {
      const res = await fetch(`/api/forward-rules/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const addWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName || !newWebhookUrl) return;
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWebhookName,
          url: newWebhookUrl,
          authType: newWebhookAuthType,
          authToken: newWebhookAuthToken || null,
        }),
      });
      if (res.ok) {
        setNewWebhookName('');
        setNewWebhookUrl('');
        setNewWebhookAuthType('none');
        setNewWebhookAuthToken('');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm('确定删除此 Webhook 吗？这会连带删除相关的转发规则。')) return;
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const addWebhookRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookRulePattern || !newWebhookRuleDomainId || !newWebhookRuleWebhookId) return;
    try {
      const res = await fetch('/api/webhook-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernamePattern: newWebhookRulePattern,
          subdomain: newWebhookRuleSubdomain || null,
          domainId: parseInt(newWebhookRuleDomainId),
          webhookId: parseInt(newWebhookRuleWebhookId),
        }),
      });
      if (res.ok) {
        setNewWebhookRulePattern('');
        setNewWebhookRuleSubdomain('');
        setNewWebhookRuleDomainId('');
        setNewWebhookRuleWebhookId('');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteWebhookRule = async (id: number) => {
    if (!confirm('确定删除此 API 转发规则吗？')) return;
    try {
      const res = await fetch(`/api/webhook-rules/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const approveUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, { method: 'POST' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const rejectUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/reject`, { method: 'POST' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword || !newAdminName) return;
    try {
      const res = await fetch('/api/admin/add-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          name: newAdminName,
        }),
      });
      if (res.ok) {
        setNewAdminEmail('');
        setNewAdminPassword('');
        setNewAdminName('');
        alert('管理员添加成功！');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`添加失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('确定彻底删除该用户吗？所有关联的数据将被清空！')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch {
      alert('网络错误');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors md:hidden cursor-pointer mr-1"
              title="导航菜单"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Globe className="h-6 w-6 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-900 font-serif">Jotify Email Router</h1>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="hidden sm:inline font-medium">{user?.name} ({user?.email})</span>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
              title="修改密码"
            >
              <Key className="h-4 w-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">

        {/* Left navigation sidebar */}
        <aside className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex w-full md:w-56 shrink-0 flex-col gap-4`}>
          {/* Group 0: Basic Config */}
          <div className="flex flex-col gap-1">
            <div className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">基础配置</div>
            <button
              onClick={() => { setActiveTab('domains'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'domains' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Globe className="h-4 w-4" />
              收信域名管理
            </button>
          </div>

          {/* Group 1: Mail Forwarding */}
          <div className="flex flex-col gap-1 border-l-2 border-indigo-100 pl-2">
            <div className="px-2 text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">邮件转发设置</div>
            <button
              onClick={() => { setActiveTab('destinations'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'destinations' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Mail className="h-4 w-4" />
              转发目标邮箱
            </button>

            <button
              onClick={() => { setActiveTab('forwardRules'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'forwardRules' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Link className="h-4 w-4" />
              邮箱转发规则
            </button>
          </div>

          {/* Group 2: Webhooks / API */}
          <div className="flex flex-col gap-1 border-l-2 border-emerald-100 pl-2">
            <div className="px-2 text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">API 集成设置</div>
            <button
              onClick={() => { setActiveTab('webhooks'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'webhooks' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Server className="h-4 w-4" />
              Webhook 接口
            </button>

            <button
              onClick={() => { setActiveTab('webhookRules'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'webhookRules' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Link className="h-4 w-4" />
              API 集成规则
            </button>
          </div>

          {/* Group 2.5: Help Docs */}
          <div className="flex flex-col gap-1 border-l-2 border-gray-100 pl-2">
            <div className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">说明文档</div>
            <button
              onClick={() => { setActiveTab('help'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'help' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <AlertCircle className="h-4 w-4" />
              使用帮助 & 文档
            </button>
          </div>

          {/* Group 3: Admin Actions */}
          {(isAdmin || isSuperadmin) && (
            <div className="flex flex-col gap-1 border-t border-gray-150 pt-3 mt-1">
              <div className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">系统管理</div>
              {isAdmin && (
                <button
                  onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                    }`}
                >
                  <Users className="h-4 w-4" />
                  审核注册用户
                </button>
              )}

              {isSuperadmin && (
                <button
                  onClick={() => { setActiveTab('superadmin'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'superadmin' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                    }`}
                >
                  <Users className="h-4 w-4" />
                  管理管理员
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Right Tab Content area */}
        <main className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl p-6 shadow-xs">

          {/* Help tab */}
          {activeTab === 'help' && (
            <div className="space-y-6 text-xs text-gray-700 leading-relaxed">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">系统使用帮助</h3>
              </div>
              <div className="bg-gray-50 border border-gray-150 rounded-xl p-5 space-y-3">
                <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Mail className="h-4.5 w-4.5 text-indigo-600" />
                  附件与格式化处理
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-gray-600 pl-1">
                  <li><strong>邮箱转发方式：</strong> 采用 Cloudflare 内置的 <code>message.forward()</code> 函数进行转发。此过程<strong>完全保留</strong>原始邮件中的所有格式、HTML、图片以及<strong>附件</strong>，且不消耗任何 Workers CPU 时间。</li>
                  <li><strong>API Webhook 集成与 R2 附件存储：</strong> 为避免 Worker 运行内存过载或 JSON 体积过大，如果配置了 Cloudflare R2 存储桶（绑定为 <code>ATTACHMENT_BUCKET</code>）以及自定义域链接（<code>R2_PUBLIC_URL</code>），系统会自动把邮件附件上传至 R2，并在 Webhook 请求体中以链接数组形式附带。若未配置 R2，附件将被丢弃。</li>
                </ul>
              </div>

              {/* Card 3: Webhook Parameters */}
              <div className="bg-gray-50 border border-gray-150 rounded-xl p-5 space-y-3">
                <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Server className="h-4.5 w-4.5 text-indigo-600" />
                  Webhook 接口投递参数与数据格式
                </div>
                <p className="text-gray-600">当收信规则匹配到 API Webhook 转发时，本系统会向您配置 of Webhook URL 发送 <strong>POST</strong> 请求，内容为 <code>application/json</code> 格式。投递字段列表如下：</p>
                
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-2">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-100 font-semibold text-gray-800">
                      <tr>
                        <th className="px-4 py-2">参数名称</th>
                        <th className="px-4 py-2">类型</th>
                        <th className="px-4 py-2">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white font-mono text-[11px] text-gray-600">
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">to</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">收件人电子邮箱地址（例如：<code>u.test@yourdomain.com</code>）</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">from</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">发件人电子邮箱地址</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">subject</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">邮件主题。如果邮件没有主题，则为空字符串。</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">text</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">邮件纯文本内容。若只包含 HTML，系统会自动过滤剥离 HTML 标签后返回纯文本主体。</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">rawSize</td>
                        <td className="px-4 py-2 text-gray-500">number</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">原始邮件大小（单位：字节 Byte）</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-indigo-600 font-semibold">attachments</td>
                        <td className="px-4 py-2 text-gray-500">array</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          附件对象数组（若配置了 R2）。每个附件结构：<code>{"{ filename: string, mimeType: string, size: number, url: string }"}</code>。
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Domains tab */}
          {activeTab === 'domains' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">收信域名 (Inbound Domains)</h3>
                <p className="text-xs text-gray-500 mt-1">配置支持接收邮件的域名，每个用户允许添加的最多个数受系统管理员限制。</p>
              </div>

              <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-4 text-xs flex gap-2 select-none leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>配置提醒</strong>：在添加这些域名之前，您必须在 Cloudflare 的 <strong>Email Routing</strong> 设置中开启 <strong>Catch-all address</strong> 规则，并将接收方设为我们部署的这个 <strong>jotify-email-workers</strong>。
                </div>
              </div>

              <form onSubmit={addDomain} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. zwq.me"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  添加域名
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">域名</th>
                      <th className="px-4 py-3 text-left">创建时间</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {domains.length > 0 ? (
                      domains.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono font-semibold">{d.domain}</td>
                          <td className="px-4 py-3">{new Date(d.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteDomain(d.id)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">暂无域名数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Destinations tab */}
          {activeTab === 'destinations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">目标邮箱 (Destination Emails)</h3>
                <p className="text-xs text-gray-500 mt-1">配置您可以将邮件转发去的一个或多个外部私人接收邮箱账号。</p>
              </div>

              <form onSubmit={addDestination} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={newDestination}
                  onChange={e => setNewDestination(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. my-private-email@gmail.com"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  添加目标
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">目标邮箱地址</th>
                      <th className="px-4 py-3 text-left">创建时间</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {destinations.length > 0 ? (
                      destinations.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono font-semibold">{d.email}</td>
                          <td className="px-4 py-3">{new Date(d.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteDestination(d.id)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">暂无目标邮箱数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Forwarding Rules tab */}
          {activeTab === 'forwardRules' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">邮箱转发规则 (Email Forwarding Rules)</h3>
                <p className="text-xs text-gray-500 mt-1">设置具体邮箱地址或正则规则，匹配成功的收信将转发至您绑定的目标邮箱。</p>
              </div>

              <form onSubmit={addForwardRule} className="bg-gray-50/50 border border-gray-150 rounded-xl p-4 space-y-4 text-xs text-gray-700">
                <div className="font-semibold text-gray-800">新增转发规则</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">用户名匹配正则 (Username Regex)</label>
                    <input
                      type="text"
                      required
                      value={newRulePattern}
                      onChange={e => setNewRulePattern(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. u.* (u开头任意字符) 或 info"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">子域名 (Subdomain - 可选)</label>
                    <input
                      type="text"
                      value={newRuleSubdomain}
                      onChange={e => setNewRuleSubdomain(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. mail"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">匹配收信域名 (Domain)</label>
                    <select
                      required
                      value={newRuleDomainId}
                      onChange={e => setNewRuleDomainId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    >
                      <option value="">-- 选择域名 --</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.domain}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">转发到目标邮箱 (Destination)</label>
                    <select
                      required
                      value={newRuleDestId}
                      onChange={e => setNewRuleDestId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    >
                      <option value="">-- 选择转发目标 --</option>
                      {destinations.map(dest => (
                        <option key={dest.id} value={dest.id}>{dest.email}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  添加规则
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">用户名正则</th>
                      <th className="px-4 py-3 text-left">域名</th>
                      <th className="px-4 py-3 text-left">转发至目标</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {forwardRules.length > 0 ? (
                      forwardRules.map(r => {
                        const d = domains.find(x => x.id === r.domainId);
                        const dest = destinations.find(x => x.id === r.destinationId);
                        const displayDomain = r.subdomain ? `${r.subdomain}.${d?.domain || ''}` : (d?.domain || '');
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-mono font-semibold text-indigo-700">^{r.usernamePattern}$</td>
                            <td className="px-4 py-3 font-mono text-gray-500">@{displayDomain}</td>
                            <td className="px-4 py-3 font-mono font-medium">{dest?.email}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deleteForwardRule(r.id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">暂无转发规则数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Webhooks tab */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">API Webhook 接口</h3>
                <p className="text-xs text-gray-500 mt-1">配置您可以将邮件转发去的一个或多个外部 Webhook 接口。</p>
              </div>

              <form onSubmit={addWebhook} className="bg-gray-50/50 border border-gray-150 rounded-xl p-4 space-y-4 text-xs text-gray-700">
                <div className="font-semibold text-gray-800">新增 Webhook 接口</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">接口名称 (Name)</label>
                    <input
                      type="text"
                      required
                      value={newWebhookName}
                      onChange={e => setNewWebhookName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. 我的飞书机器人"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">接口地址 (Webhook URL)</label>
                    <input
                      type="url"
                      required
                      value={newWebhookUrl}
                      onChange={e => setNewWebhookUrl(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">鉴权方式 (Auth Type)</label>
                    <select
                      value={newWebhookAuthType}
                      onChange={e => setNewWebhookAuthType(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="none">无 (None)</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="header">自定义 Header 格式 (Key:Value)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">密钥 Token / Header 内容</label>
                    <input
                      type="text"
                      value={newWebhookAuthToken}
                      onChange={e => setNewWebhookAuthToken(e.target.value)}
                      disabled={newWebhookAuthType === 'none'}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      placeholder={newWebhookAuthType === 'header' ? 'X-Secret: my_secret_value' : 'Enter secret token'}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  添加 Webhook
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">接口名称</th>
                      <th className="px-4 py-3 text-left">接口 URL</th>
                      <th className="px-4 py-3 text-left">鉴权</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {webhooks.length > 0 ? (
                      webhooks.map(w => (
                        <tr key={w.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-gray-800">{w.name}</td>
                          <td className="px-4 py-3 font-mono text-gray-500 truncate max-w-xs" title={w.url}>{w.url}</td>
                          <td className="px-4 py-3 font-mono">{w.authType}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteWebhook(w.id)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">暂无 Webhook 接口配置</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Webhook Rules tab */}
          {activeTab === 'webhookRules' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">API 集成规则 (API Webhook Rules)</h3>
                <p className="text-xs text-gray-500 mt-1">设置接收邮箱规则匹配，当匹配成功的收信将触发 API Webhook 发送给对应接口地址。</p>
              </div>

              <form onSubmit={addWebhookRule} className="bg-gray-50/50 border border-gray-150 rounded-xl p-4 space-y-4 text-xs text-gray-700">
                <div className="font-semibold text-gray-800">新增 API 转发规则</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">用户名匹配正则 (Username Regex)</label>
                    <input
                      type="text"
                      required
                      value={newWebhookRulePattern}
                      onChange={e => setNewWebhookRulePattern(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. jot_* (jot_开头的任意字符)"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">子域名 (Subdomain - 可选)</label>
                    <input
                      type="text"
                      value={newWebhookRuleSubdomain}
                      onChange={e => setNewWebhookRuleSubdomain(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. mail"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">匹配收信域名 (Domain)</label>
                    <select
                      required
                      value={newWebhookRuleDomainId}
                      onChange={e => setNewWebhookRuleDomainId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    >
                      <option value="">-- 选择域名 --</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.domain}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">转发触发 Webhook (Webhook)</label>
                    <select
                      required
                      value={newWebhookRuleWebhookId}
                      onChange={e => setNewWebhookRuleWebhookId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    >
                      <option value="">-- 选择 Webhook 接口 --</option>
                      {webhooks.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  添加 API 规则
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">用户名正则</th>
                      <th className="px-4 py-3 text-left">域名</th>
                      <th className="px-4 py-3 text-left">触发 Webhook 接口</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {webhookRules.length > 0 ? (
                      webhookRules.map(r => {
                        const d = domains.find(x => x.id === r.domainId);
                        const w = webhooks.find(x => x.id === r.webhookId);
                        const displayDomain = r.subdomain ? `${r.subdomain}.${d?.domain || ''}` : (d?.domain || '');
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-mono font-semibold text-indigo-700">^{r.usernamePattern}$</td>
                            <td className="px-4 py-3 font-mono text-gray-500">@{displayDomain}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{w?.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deleteWebhookRule(r.id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">暂无 API 转发规则数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin tab (Registration review) */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">审核用户注册 (User Verification Panel)</h3>
                <p className="text-xs text-gray-500 mt-1">审核新用户的注册申请，拒绝或通过激活账号。</p>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">用户名</th>
                      <th className="px-4 py-3 text-left">电子邮箱</th>
                      <th className="px-4 py-3 text-left">状态</th>
                      <th className="px-4 py-3 text-left">注册时间</th>
                      <th className="px-4 py-3 text-right">审核操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {usersList.length > 0 ? (
                      usersList.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold">{u.name}</td>
                          <td className="px-4 py-3 font-mono">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${u.status === 'approved'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : u.status === 'rejected'
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                              }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">{new Date(u.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            {u.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => approveUser(u.id)}
                                  className="px-2.5 py-1 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 font-semibold rounded-md cursor-pointer transition-colors"
                                >
                                  通过
                                </button>
                                <button
                                  onClick={() => rejectUser(u.id)}
                                  className="px-2.5 py-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 font-semibold rounded-md cursor-pointer transition-colors"
                                >
                                  拒绝
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">暂无注册用户待审核</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Superadmin tab (Admin management) */}
          {activeTab === 'superadmin' && isSuperadmin && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">管理员及用户管理 (Super Admin Controls)</h3>
                <p className="text-xs text-gray-500 mt-1">添加系统管理员或注销用户账号。</p>
              </div>

              <form onSubmit={addAdmin} className="bg-gray-50/50 border border-gray-150 rounded-xl p-4 space-y-4 text-xs text-gray-700">
                <div className="font-semibold text-gray-800">新增管理员账号 (Create Admin)</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">姓名</label>
                    <input
                      type="text"
                      required
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. Sub Admin"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">邮箱</label>
                    <input
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="name@domain.com"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">密码</label>
                    <input
                      type="password"
                      required
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      placeholder="******"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  创建管理员
                </button>
              </form>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">用户名</th>
                      <th className="px-4 py-3 text-left">电子邮箱</th>
                      <th className="px-4 py-3 text-left">身份角色</th>
                      <th className="px-4 py-3 text-left">状态</th>
                      <th className="px-4 py-3 text-right">彻底删除</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {usersList.length > 0 ? (
                      usersList.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold">{u.name}</td>
                          <td className="px-4 py-3 font-mono">{u.email}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{u.role}</td>
                          <td className="px-4 py-3 font-mono">{u.status}</td>
                          <td className="px-4 py-3 text-right">
                            {u.role !== 'superadmin' && (
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">暂无管理员与普通用户列表</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-55 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 shadow-xl rounded-xl p-6 max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-gray-900 font-serif flex items-center gap-1.5">
              <Key className="h-4 w-4 text-indigo-600" />
              修改账户密码
            </h4>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">新密码</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="最少 6 位"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="px-3.5 py-1.5 border border-gray-300 hover:bg-gray-50 font-semibold rounded-lg cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  确认修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400 select-none">
        Jotify Project &copy; {new Date().getFullYear()} - Minimalist Email Routing & Ingestion Center.
      </footer>
    </div>
  );
}
