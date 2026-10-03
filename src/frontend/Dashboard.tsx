import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, LogOut, Plus, Trash2, Key, Users, CheckCircle,
  XCircle, Mail, Globe, Server, Link, AlertCircle, RefreshCw, Send,
  Menu, X, Edit, ChevronLeft, ChevronRight, Search, FileText, BookOpen,
  Filter, Check, ChevronDown
} from 'lucide-react';
import { DbUser, PublicConfig, Domain, Destination, ForwardRule, Webhook, WebhookRule, AdminUser, FailedWebhook } from './types';

interface DashboardProps {
  user: DbUser;
  config: PublicConfig;
  onLogout: () => void;
  onOpenDocs?: () => void;
  forceChangePassword?: boolean;
  onPasswordChanged?: () => void;
}

export default function Dashboard({ user, config, onLogout, onOpenDocs, forceChangePassword, onPasswordChanged }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'domains' | 'destinations' | 'forwardRules' | 'webhooks' | 'webhookRules' | 'failures' | 'admin' | 'superadmin' | 'help'>('domains');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(forceChangePassword || false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Data states
  const [domains, setDomains] = useState<Domain[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [forwardRules, setForwardRules] = useState<ForwardRule[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookRules, setWebhookRules] = useState<WebhookRule[]>([]);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [failures, setFailures] = useState<FailedWebhook[]>([]);
  const [failuresTotal, setFailuresTotal] = useState(0);

  // Input states for Domain / Destination adding (simple inputs)
  const [newDomain, setNewDomain] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [isAddingDestination, setIsAddingDestination] = useState(false);

  // Pagination states (20 per page)
  const ITEMS_PER_PAGE = 20;
  const [domainsPage, setDomainsPage] = useState(1);
  const [destinationsPage, setDestinationsPage] = useState(1);
  const [forwardRulesPage, setForwardRulesPage] = useState(1);
  const [webhooksPage, setWebhooksPage] = useState(1);
  const [webhookRulesPage, setWebhookRulesPage] = useState(1);
  const [usersListPage, setUsersListPage] = useState(1);
  const [failuresPage, setFailuresPage] = useState(1);
  const [failuresSearch, setFailuresSearch] = useState('');

  // Search state for Forwarding Rules
  const [forwardRulesSearch, setForwardRulesSearch] = useState('');
  const [selectedRuleDomainId, setSelectedRuleDomainId] = useState<number | 'all' | null>(null);
  const [domainFilterSearch, setDomainFilterSearch] = useState('');
  const [domainHeaderFilter, setDomainHeaderFilter] = useState('');
  const [domainFilterDropdownOpen, setDomainFilterDropdownOpen] = useState(false);
  const domainFilterDropdownRef = useRef<HTMLDivElement>(null);

  // Close domain filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (domainFilterDropdownRef.current && !domainFilterDropdownRef.current.contains(event.target as Node)) {
        setDomainFilterDropdownOpen(false);
      }
    };
    if (domainFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [domainFilterDropdownOpen]);

  const effectiveSelectedDomainId: number | 'all' =
    (selectedRuleDomainId === 'all')
      ? 'all'
      : (selectedRuleDomainId !== null && domains.some(d => d.id === selectedRuleDomainId))
        ? selectedRuleDomainId
        : (domains.length > 0 ? domains[0].id : 'all');

  // ── Modal & Form States for WEBHOOKS ──
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookAuthType, setWebhookAuthType] = useState('none');
  const [webhookAuthToken, setWebhookAuthToken] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);

  // ── Modal & Form States for FORWARD RULES ──
  const [forwardRuleModalOpen, setForwardRuleModalOpen] = useState(false);
  const [editingForwardRule, setEditingForwardRule] = useState<ForwardRule | null>(null);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleSubdomain, setRuleSubdomain] = useState('');
  const [ruleDomainId, setRuleDomainId] = useState('');
  const [ruleDestId, setRuleDestId] = useState('');
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [forwardRuleSaving, setForwardRuleSaving] = useState(false);
  const [togglingForwardRuleId, setTogglingForwardRuleId] = useState<number | null>(null);

  // ── Modal & Form States for WEBHOOK RULES ──
  const [webhookRuleModalOpen, setWebhookRuleModalOpen] = useState(false);
  const [editingWebhookRule, setEditingWebhookRule] = useState<WebhookRule | null>(null);
  const [webhookRulePattern, setWebhookRulePattern] = useState('');
  const [webhookRuleSubdomain, setWebhookRuleSubdomain] = useState('');
  const [webhookRuleDomainId, setWebhookRuleDomainId] = useState('');
  const [webhookRuleWebhookId, setWebhookRuleWebhookId] = useState('');
  const [webhookRuleEnabled, setWebhookRuleEnabled] = useState(true);
  const [webhookRuleSaving, setWebhookRuleSaving] = useState(false);
  const [togglingWebhookRuleId, setTogglingWebhookRuleId] = useState<number | null>(null);

  // Admin/Superadmin input states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  // Reset pagination on tab change
  useEffect(() => {
    setDomainsPage(1);
    setDestinationsPage(1);
    setForwardRulesPage(1);
    setWebhooksPage(1);
    setWebhookRulesPage(1);
    setUsersListPage(1);
    setUsersSearch('');
    setFailuresPage(1);
    setFailuresSearch('');
    setForwardRulesSearch('');
    setSelectedRuleDomainId(null);
    setDomainFilterSearch('');
    setDomainHeaderFilter('');
    setDomainFilterDropdownOpen(false);
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
        const query = `/api/admin/users?page=${usersListPage}${usersSearch ? `&search=${encodeURIComponent(usersSearch)}` : ''}`;
        const res = await fetch(query);
        if (res.ok) {
          const data = await res.json() as any;
          setUsersList(data.users || []);
          setUsersTotal(data.total || 0);
        }
      } else if (activeTab === 'failures') {
        const query = `/api/failed-webhooks?page=${failuresPage}${failuresSearch ? `&search=${encodeURIComponent(failuresSearch)}` : ''}`;
        const res = await fetch(query);
        if (res.ok) {
          const data = await res.json() as any;
          setFailures(data.failures || []);
          setFailuresTotal(data.total || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching tab data:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (res.ok) {
        alert('密码修改成功！');
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        if (onPasswordChanged) onPasswordChanged();
      } else {
        const data = await res.json() as any;
        alert(`修改失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim() || isAddingDomain) return;
    setIsAddingDomain(true);
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
    } finally {
      setIsAddingDomain(false);
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
    if (!newDestination.trim() || isAddingDestination) return;
    setIsAddingDestination(true);
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
    } finally {
      setIsAddingDestination(false);
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

  // ── WEBHOOKS Modal Actions ──
  const openWebhookModal = (webhook: any = null) => {
    setEditingWebhook(webhook);
    if (webhook) {
      setWebhookName(webhook.name);
      setWebhookUrl(webhook.url);
      setWebhookAuthType(webhook.authType || 'none');
      setWebhookAuthToken(webhook.authToken || '');
    } else {
      setWebhookName('');
      setWebhookUrl('');
      setWebhookAuthType('none');
      setWebhookAuthToken('');
    }
    setWebhookModalOpen(true);
  };

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookName || !webhookUrl || webhookSaving) return;
    setWebhookSaving(true);
    try {
      const method = editingWebhook ? 'PUT' : 'POST';
      const endpoint = editingWebhook ? `/api/webhooks/${editingWebhook.id}` : '/api/webhooks';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: webhookName,
          url: webhookUrl,
          authType: webhookAuthType,
          authToken: webhookAuthToken || null,
        }),
      });
      if (res.ok) {
        setWebhookModalOpen(false);
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`保存失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    } finally {
      setWebhookSaving(false);
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

  // ── FORWARDING RULES Modal Actions ──
  const openForwardRuleModal = (rule: any = null, targetDomainId?: number) => {
    setEditingForwardRule(rule);
    if (rule) {
      setRulePattern(rule.usernamePattern);
      setRuleSubdomain(rule.subdomain || '');
      setRuleDomainId(rule.domainId.toString());
      setRuleDestId(rule.destinationId.toString());
      setRuleEnabled(rule.enabled !== false);
    } else {
      setRulePattern('');
      setRuleSubdomain('');
      const defaultDomain = targetDomainId
        ? targetDomainId.toString()
        : (typeof effectiveSelectedDomainId === 'number'
            ? effectiveSelectedDomainId.toString()
            : (domains[0]?.id?.toString() || ''));
      setRuleDomainId(defaultDomain);
      setRuleDestId(destinations[0]?.id?.toString() || '');
      setRuleEnabled(true);
    }
    setForwardRuleModalOpen(true);
  };

  const toggleForwardRule = async (rule: ForwardRule) => {
    const nextState = !(rule.enabled !== false);
    setTogglingForwardRuleId(rule.id);
    setForwardRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: nextState } : r));
    try {
      const res = await fetch(`/api/forward-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (!res.ok) {
        setForwardRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !nextState } : r));
        const data = await res.json() as any;
        alert(`切换状态失败: ${data.error || '未知错误'}`);
      }
    } catch {
      setForwardRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !nextState } : r));
      alert('网络错误');
    } finally {
      setTogglingForwardRuleId(null);
    }
  };

  const saveForwardRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern || !ruleDomainId || !ruleDestId || forwardRuleSaving) return;
    setForwardRuleSaving(true);
    try {
      const method = editingForwardRule ? 'PUT' : 'POST';
      const endpoint = editingForwardRule ? `/api/forward-rules/${editingForwardRule.id}` : '/api/forward-rules';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernamePattern: rulePattern,
          subdomain: ruleSubdomain || null,
          domainId: parseInt(ruleDomainId),
          destinationId: parseInt(ruleDestId),
          enabled: ruleEnabled,
        }),
      });
      if (res.ok) {
        setForwardRuleModalOpen(false);
        fetchDashboardData();
        if (ruleDomainId && !editingForwardRule) {
          const createdDomainId = parseInt(ruleDomainId);
          if (!isNaN(createdDomainId)) {
            setSelectedRuleDomainId(createdDomainId);
          }
        }
      } else {
        const data = await res.json() as any;
        alert(`保存失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    } finally {
      setForwardRuleSaving(false);
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

  // ── WEBHOOK RULES Modal Actions ──
  const openWebhookRuleModal = (rule: any = null) => {
    setEditingWebhookRule(rule);
    if (rule) {
      setWebhookRulePattern(rule.usernamePattern);
      setWebhookRuleSubdomain(rule.subdomain || '');
      setWebhookRuleDomainId(rule.domainId.toString());
      setWebhookRuleWebhookId(rule.webhookId.toString());
      setWebhookRuleEnabled(rule.enabled !== false);
    } else {
      setWebhookRulePattern('');
      setWebhookRuleSubdomain('');
      setWebhookRuleDomainId(domains[0]?.id?.toString() || '');
      setWebhookRuleWebhookId(webhooks[0]?.id?.toString() || '');
      setWebhookRuleEnabled(true);
    }
    setWebhookRuleModalOpen(true);
  };

  const toggleWebhookRule = async (rule: WebhookRule) => {
    const nextState = !(rule.enabled !== false);
    setTogglingWebhookRuleId(rule.id);
    setWebhookRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: nextState } : r));
    try {
      const res = await fetch(`/api/webhook-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (!res.ok) {
        setWebhookRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !nextState } : r));
        const data = await res.json() as any;
        alert(`切换状态失败: ${data.error || '未知错误'}`);
      }
    } catch {
      setWebhookRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !nextState } : r));
      alert('网络错误');
    } finally {
      setTogglingWebhookRuleId(null);
    }
  };

  const saveWebhookRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookRulePattern || !webhookRuleDomainId || !webhookRuleWebhookId || webhookRuleSaving) return;
    setWebhookRuleSaving(true);
    try {
      const method = editingWebhookRule ? 'PUT' : 'POST';
      const endpoint = editingWebhookRule ? `/api/webhook-rules/${editingWebhookRule.id}` : '/api/webhook-rules';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernamePattern: webhookRulePattern,
          subdomain: webhookRuleSubdomain || null,
          domainId: parseInt(webhookRuleDomainId),
          webhookId: parseInt(webhookRuleWebhookId),
          enabled: webhookRuleEnabled,
        }),
      });
      if (res.ok) {
        setWebhookRuleModalOpen(false);
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`保存失败: ${data.error}`);
      }
    } catch {
      alert('网络错误');
    } finally {
      setWebhookRuleSaving(false);
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

  const retryFailure = async (id: number) => {
    if (!confirm('确定重新投递该失败记录吗？')) return;
    try {
      const res = await fetch(`/api/failed-webhooks/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        alert('已重新加入投递队列');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`重试失败: ${data.error || '未知错误'}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const deleteFailure = async (id: number) => {
    if (!confirm('确定删除该失败记录吗？')) return;
    try {
      const res = await fetch(`/api/failed-webhooks/${id}`, { method: 'DELETE' });
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
    if (!newAdminEmail || !newAdminPassword || !newAdminName || adminSaving) return;
    setAdminSaving(true);
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
    } finally {
      setAdminSaving(false);
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

  const resetUserPassword = async (id: string, email: string) => {
    const newPassword = prompt(`为 ${email} 设置新密码（至少8位，须包含大写、小写字母和数字）：`);
    if (!newPassword) return;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      alert('密码不符合要求（至少8位，且包含大小写字母和数字）');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        alert('密码已重置，该用户下次登录时需修改密码');
        fetchDashboardData();
      } else {
        const data = await res.json() as any;
        alert(`重置失败: ${data.error || '未知错误'}`);
      }
    } catch {
      alert('网络错误');
    }
  };

  const obscureToken = (authType: string, token: string | null) => {
    if (!token) return '无 (None)';
    if (authType === 'bearer') {
      const cleanToken = token.replace(/^bearer\s+/i, '');
      if (cleanToken.length <= 6) return 'Bearer ***';
      return `Bearer ${cleanToken.slice(0, 3)}***${cleanToken.slice(-3)}`;
    }
    if (authType === 'header') {
      const parts = token.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (value.length <= 6) return `${key}: ***`;
        return `${key}: ${value.slice(0, 3)}***${value.slice(-3)}`;
      }
      if (token.length <= 6) return '***';
      return `${token.slice(0, 3)}***${token.slice(-3)}`;
    }
    return '无 (None)';
  };

  // ── Pagination Helper Component ──
  const PaginationControls = ({
    currentPage,
    totalItems,
    onPageChange
  }: {
    currentPage: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  }) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-6 mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="relative inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            上一页
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            下一页
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-gray-500">
              显示第 <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 到第{' '}
              <span className="font-medium">
                {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}
              </span>{' '}
              条，共 <span className="font-medium">{totalItems}</span> 条数据
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md " aria-label="Pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 select-none">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const getPaginatedItems = (items: any[], currentPage: number) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-gray-500 hover:text-gray-600 rounded hover:bg-gray-50 transition-colors md:hidden cursor-pointer mr-1"
              title="导航菜单"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Globe className="h-5 w-5 text-black" />
            <h1 className="text-base font-bold text-black tracking-tight font-mono">Jotify Email Router</h1>
            <span className="hidden sm:inline-flex items-center space-x-1.5 ml-3 border border-gray-100 bg-gray-50/50 px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              <span>Operational</span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="hidden sm:inline font-mono text-xs text-gray-500">{user?.email}</span>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2 text-gray-500 hover:text-gray-600 rounded hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
              title="修改密码"
            >
              <Key className="h-4 w-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-600 rounded hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
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
              className={`w-full text-left px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'domains' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Globe className="h-4 w-4" />
              收信域名管理
            </button>
            <button
              onClick={() => { setActiveTab('destinations'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'destinations' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Mail className="h-4 w-4" />
              转发目标邮箱
            </button>
          </div>

          {/* Group 1: Mail Forwarding */}
          <div className="flex flex-col gap-1 border-l-2 border-gray-100 pl-2">
            <div className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">邮件转发设置</div>
            <button
              onClick={() => { setActiveTab('forwardRules'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'forwardRules' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
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
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'webhooks' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Server className="h-4 w-4" />
              Webhook 接口
            </button>

            <button
              onClick={() => { setActiveTab('webhookRules'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'webhookRules' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <Link className="h-4 w-4" />
              API 集成规则
            </button>

            <button
              onClick={() => { setActiveTab('failures'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'failures' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <XCircle className="h-4 w-4" />
              投递失败记录
            </button>
          </div>

          {/* Group 2.5: Help Docs */}
          <div className="flex flex-col gap-1 border-l-2 border-gray-100 pl-2">
            <div className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">说明文档</div>
            <button
              onClick={() => { setActiveTab('help'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'help' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                }`}
            >
              <AlertCircle className="h-4 w-4" />
              使用帮助
            </button>
            {onOpenDocs && (
              <button
                onClick={() => { onOpenDocs(); setMobileMenuOpen(false); }}
                className="w-full text-left px-3 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100"
              >
                <BookOpen className="h-4 w-4 text-blue-600" />
                Webhook 开发文档 ↗
              </button>
            )}
          </div>

          {/* Group 3: Admin Actions */}
          {(isAdmin || isSuperadmin) && (
            <div className="flex flex-col gap-1 border-t border-gray-150 pt-3 mt-1">
              <div className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">系统管理</div>
              {isAdmin && (
                <button
                  onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'admin' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
                    }`}
                >
                  <Users className="h-4 w-4" />
                  审核注册用户
                </button>
              )}

              {isSuperadmin && (
                <button
                  onClick={() => { setActiveTab('superadmin'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'superadmin' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white border border-transparent hover:border-gray-200'
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
        <main className="flex-1 min-w-0 bg-white border border-gray-100 rounded p-6 ">

          {/* Help tab */}
          {activeTab === 'help' && (
            <div className="space-y-6 text-xs text-gray-700 leading-relaxed">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-serif">系统使用帮助</h3>
              </div>
              <div className="bg-gray-50 border border-gray-150 rounded p-5 space-y-3">
                <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Mail className="h-4.5 w-4.5 text-gray-600" />
                  附件与格式化处理
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-gray-600 pl-1">
                  <li><strong>邮箱转发方式：</strong> 采用 Cloudflare 内置的 <code>message.forward()</code> 函数进行转发。此过程<strong>完全保留</strong>原始邮件中的所有格式、HTML、图片以及<strong>附件</strong>，且不消耗任何 Workers CPU 时间。</li>
                  <li><strong>API Webhook 集成与 R2 附件存储：</strong> 为避免 Worker 运行内存过载或 JSON 体积过大，如果配置了 Cloudflare R2 存储桶（绑定为 <code>ATTACHMENT_BUCKET</code>）以及自定义域链接（<code>R2_PUBLIC_URL</code>），系统会自动把邮件附件上传至 R2，并在 Webhook 请求体中以链接数组形式附带。若未配置 R2，附件将被丢弃。</li>
                </ul>
              </div>

              {/* Card: Regex username matching rules helper */}
              <div className="bg-gray-50 border border-gray-150 rounded p-5 space-y-3">
                <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Link className="h-4.5 w-4.5 text-gray-600" />
                  正则表达式用户名匹配规则
                </div>
                <p className="text-gray-600">
                  系统采用标准的<strong>正则表达式（Regular Expression）</strong>对邮箱的用户名（即 <code>@</code> 前面的部分）进行匹配。配置时请<strong>无需</strong>手动输入头尾的 <code>^</code> 和 <code>$</code> 符号（系统在校验匹配时已自动包含）。以下是一些常用的匹配配置方式与典型例子：
                </p>
                <div className="border border-gray-200 rounded overflow-hidden mt-2">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-100 font-semibold text-gray-800">
                      <tr>
                        <th className="px-4 py-2 w-1/4">配置匹配模式</th>
                        <th className="px-4 py-2 w-1/4">含义说明</th>
                        <th className="px-4 py-2 w-1/2">匹配示例与说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white font-mono text-[11px] text-gray-600">
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">jot_.*</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">以 <code>jot_</code> 开头的任意名字</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          ✅ 匹配：<code>jot_abc</code>、<code>jot_123</code>、<code>jot_</code><br/>
                          ❌ 拒绝：<code>jot123</code>（缺少下划线）、<code>user_jot_1</code>（未以其开头）
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">jot_..*</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">以 <code>jot_</code> 开头且后面<strong>至少有一个字符</strong></td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          ✅ 匹配：<code>jot_a</code>、<code>jot_123</code><br/>
                          ❌ 拒绝：<code>jot_</code>（下划线后没有字符）
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">u\..*</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">以 <code>u.</code> 开头的任意名字</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          <em>注：点号 <code>.</code> 在正则中需写为 <code>\.</code> 进行转义。</em><br/>
                          ✅ 匹配：<code>u.name</code>、<code>u.john</code>、<code>u.</code><br/>
                          ❌ 拒绝：<code>uname</code>（缺少点号）
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">test</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">精确匹配 <code>test</code></td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          ✅ 匹配：<code>test</code><br/>
                          ❌ 拒绝：<code>test123</code>、<code>mytest</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">.*</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">匹配任意名字（通配所有）</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          ✅ 匹配：任何邮箱用户名前缀
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 3: Webhook Parameters */}
              <div className="bg-gray-50 border border-gray-150 rounded p-5 space-y-3">
                <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Server className="h-4.5 w-4.5 text-gray-600" />
                  Webhook 接口投递参数与数据格式
                </div>
                <p className="text-gray-600">当收信规则匹配到 API Webhook 转发时，本系统会向您配置的 Webhook URL 发送 <strong>POST</strong> 请求，内容为 <code>application/json</code> 格式。投递字段列表如下：</p>
                
                <div className="border border-gray-200 rounded overflow-hidden mt-2">
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
                        <td className="px-4 py-2 text-gray-600 font-semibold">to</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">收件人电子邮箱地址（例如：<code>u.test@yourdomain.com</code>）</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">from</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">发件人电子邮箱地址</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">subject</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">邮件主题。如果邮件没有主题，则为空字符串。</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">text</td>
                        <td className="px-4 py-2 text-gray-500">string</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">邮件纯文本内容。若只包含 HTML，系统会自动过滤剥离 HTML 标签后返回纯文本主体。</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">html</td>
                        <td className="px-4 py-2 text-gray-500">string | null</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">邮件原始未经修改的 HTML 富文本内容（保留完整标签），若邮件无 HTML 则为 null。</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">rawSize</td>
                        <td className="px-4 py-2 text-gray-500">number</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">原始邮件大小（单位：字节 Byte）</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600 font-semibold">attachments</td>
                        <td className="px-4 py-2 text-gray-500">array</td>
                        <td className="px-4 py-2 text-gray-700 font-sans">
                          附件对象数组（若配置了 R2）。每个附件结构：<code>{"{ filename: string, mimeType: string, size: number, url: string }"}</code>。
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {onOpenDocs && (
                  <div className="pt-3">
                    <button
                      onClick={onOpenDocs}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                      查看完整的 Webhook 接收端开发文档与代码示例 →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Failures tab */}
          {activeTab === 'failures' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">Webhook 投递失败记录</h3>
                  <p className="text-xs text-gray-500 mt-1">经过全部重试仍未送达的 Webhook 投递。可手动重新投递或删除记录。</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索 URL 或 Delivery ID..."
                    value={failuresSearch}
                    onChange={(e) => {
                      setFailuresSearch(e.target.value);
                      setFailuresPage(1);
                      fetchDashboardData();
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div className="border border-gray-100 rounded overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Webhook</th>
                      <th className="px-4 py-3 text-left">Delivery ID</th>
                      <th className="px-4 py-3 text-left">重试次数</th>
                      <th className="px-4 py-3 text-left">失败时间</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {failures.length > 0 ? (
                      failures.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{f.webhookName || `Webhook #${f.webhookId}`}</div>
                            <div className="font-mono text-[10px] text-gray-400 max-w-[240px] truncate">{f.url}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] max-w-[200px] truncate" title={f.deliveryId}>{f.deliveryId}</td>
                          <td className="px-4 py-3">{f.attempts}</td>
                          <td className="px-4 py-3">{new Date(f.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => retryFailure(f.id)}
                              className="text-emerald-600 hover:text-emerald-800 mr-3 cursor-pointer"
                              title="重新投递"
                            >
                              <RefreshCw className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => deleteFailure(f.id)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                              title="删除记录"
                            >
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">暂无失败记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={failuresPage}
                  totalItems={failuresTotal}
                  onPageChange={(p) => { setFailuresPage(p); fetchDashboardData(); }}
                />
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

              <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded p-4 text-xs flex gap-2 select-none leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>配置提醒</strong>：在添加这些域名之前，您必须在 Cloudflare 的 <strong>Email Routing</strong> 设置中开启 <strong>Catch-all address</strong> 规则，并将接收方设为我们部署的这个 <strong>jotify-email-workers</strong>。
                </div>
              </div>

              <form onSubmit={addDomain} className="flex gap-2">
                <input
                  type="text"
                  required
                  disabled={isAddingDomain}
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="e.g. example.com"
                />
                <button
                  type="submit"
                  disabled={isAddingDomain}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold rounded hover:bg-gray-800 flex items-center gap-1 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isAddingDomain ? '添加中...' : '添加域名'}
                </button>
              </form>

              <div className="border border-gray-100 rounded overflow-hidden">
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
                      getPaginatedItems(domains, domainsPage).map(d => (
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
                <PaginationControls
                  currentPage={domainsPage}
                  totalItems={domains.length}
                  onPageChange={setDomainsPage}
                />
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
                  disabled={isAddingDestination}
                  value={newDestination}
                  onChange={e => setNewDestination(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="e.g. my-private-email@gmail.com"
                />
                <button
                  type="submit"
                  disabled={isAddingDestination}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold rounded hover:bg-gray-800 flex items-center gap-1 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isAddingDestination ? '添加中...' : '添加目标'}
                </button>
              </form>

              <div className="border border-gray-100 rounded overflow-hidden">
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
                      getPaginatedItems(destinations, destinationsPage).map(d => (
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
                <PaginationControls
                  currentPage={destinationsPage}
                  totalItems={destinations.length}
                  onPageChange={setDestinationsPage}
                />
              </div>
            </div>
          )}

          {/* Forwarding Rules tab */}
          {activeTab === 'forwardRules' && (() => {
            const currentSelectedDomain = typeof effectiveSelectedDomainId === 'number'
              ? domains.find(d => d.id === effectiveSelectedDomainId)
              : null;

            // Helper to get domain string for a rule
            const getRuleDomainString = (r: ForwardRule) => {
              const d = domains.find(x => x.id === r.domainId);
              return r.subdomain ? `${r.subdomain}.${d?.domain || ''}` : (d?.domain || '');
            };

            // Filter rules according to selected domain on left
            const domainScopedRules = effectiveSelectedDomainId === 'all'
              ? forwardRules
              : forwardRules.filter(r => r.domainId === effectiveSelectedDomainId);

            // Extract all distinct configured domains/subdomains in the current scope
            const availableDomainStrings = Array.from(
              new Set(domainScopedRules.map(r => getRuleDomainString(r)))
            ).filter(Boolean).sort((a, b) => a.localeCompare(b));

            // Filter rules according to column header filter on "匹配收信域名"
            const domainFilterMatchedRules = domainScopedRules.filter(r => {
              if (!domainHeaderFilter) return true;
              return getRuleDomainString(r).toLowerCase() === domainHeaderFilter.toLowerCase();
            });

            // Filter by search query (username regex, subdomain, or destination email)
            const filteredRules = domainFilterMatchedRules.filter(r => {
              if (!forwardRulesSearch.trim()) return true;
              const search = forwardRulesSearch.trim().toLowerCase();
              const dest = destinations.find(x => x.id === r.destinationId);
              const fullDomain = getRuleDomainString(r).toLowerCase();
              return (
                r.usernamePattern.toLowerCase().includes(search) ||
                (r.subdomain || '').toLowerCase().includes(search) ||
                fullDomain.includes(search) ||
                (dest?.email || '').toLowerCase().includes(search)
              );
            });

            // Group filtered rules by domain string (alphabetically sorted by domain)
            const groupedMap = new Map<string, ForwardRule[]>();
            filteredRules.forEach(r => {
              const domainStr = getRuleDomainString(r);
              if (!groupedMap.has(domainStr)) {
                groupedMap.set(domainStr, []);
              }
              groupedMap.get(domainStr)!.push(r);
            });

            const sortedGroupKeys = Array.from(groupedMap.keys()).sort((a, b) => a.localeCompare(b));

            // Flatten rules based on sorted domain groups
            const sortedAndGroupedRules: ForwardRule[] = [];
            sortedGroupKeys.forEach(domainStr => {
              const rulesInGroup = groupedMap.get(domainStr) || [];
              sortedAndGroupedRules.push(...rulesInGroup);
            });

            const paginatedRules = getPaginatedItems(sortedAndGroupedRules, forwardRulesPage);

            // Filtered domain list for left sidebar
            const displayedDomains = domains.filter(d => {
              if (!domainFilterSearch.trim()) return true;
              return d.domain.toLowerCase().includes(domainFilterSearch.trim().toLowerCase());
            });

            return (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-serif">邮箱转发规则 (Email Forwarding Rules)</h3>
                    <p className="text-xs text-gray-500 mt-1">设置具体邮箱地址或正则规则，匹配成功的收信将转发至您绑定的目标邮箱。</p>
                  </div>
                  <button
                    onClick={() => openForwardRuleModal(null)}
                    className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    新建转发规则
                  </button>
                </div>

                {/* Two column layout */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  {/* Left Column: Domain List */}
                  <div className="w-full lg:w-64 xl:w-72 shrink-0 bg-white border border-gray-200/80 rounded-lg p-3 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                        <Globe className="h-3.5 w-3.5 text-gray-500" />
                        <span>收信域名列表</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {domains.length} 个域名
                      </span>
                    </div>

                    {domains.length > 5 && (
                      <div className="relative">
                        <Search className="h-3 w-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="快速过滤域名..."
                          value={domainFilterSearch}
                          onChange={(e) => setDomainFilterSearch(e.target.value)}
                          className="w-full pl-7 pr-3 py-1 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                    )}

                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-0.5">
                      {/* All domains option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRuleDomainId('all');
                          setForwardRulesPage(1);
                          setDomainHeaderFilter('');
                          setDomainFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                          effectiveSelectedDomainId === 'all'
                            ? 'bg-black text-white font-semibold shadow-xs'
                            : 'text-gray-700 hover:bg-gray-100/70 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">全部域名</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
                            effectiveSelectedDomainId === 'all'
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {forwardRules.length}
                        </span>
                      </button>

                      <div className="my-1.5 border-t border-gray-100" />

                      {displayedDomains.length > 0 ? (
                        displayedDomains.map(d => {
                          const count = forwardRules.filter(r => r.domainId === d.id).length;
                          const isSelected = effectiveSelectedDomainId === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setSelectedRuleDomainId(d.id);
                                setForwardRulesPage(1);
                                setDomainHeaderFilter('');
                                setDomainFilterDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-black text-white font-semibold shadow-xs'
                                  : 'text-gray-700 hover:bg-gray-100/70 border border-transparent'
                              }`}
                              title={d.domain}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                <span className="truncate font-mono">@{d.domain}</span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ml-1.5 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })
                      ) : domains.length === 0 ? (
                        <div className="py-6 px-2 text-center text-xs text-gray-400 space-y-2">
                          <p>暂无配置收信域名</p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('domains')}
                            className="text-black font-semibold underline hover:text-gray-700 cursor-pointer"
                          >
                            前往添加域名
                          </button>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-gray-400">
                          未匹配到域名
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Rules List for Selected Domain */}
                  <div className="flex-1 min-w-0 w-full space-y-3">
                    {/* Controls & Filter bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 border border-gray-200/80 rounded-lg shadow-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {currentSelectedDomain ? `@${currentSelectedDomain.domain}` : '全部域名'}
                        </span>
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium shrink-0">
                          共 {domainFilterMatchedRules.length} 条规则
                        </span>
                        {domainHeaderFilter && (
                          <div className="flex items-center gap-1 bg-black text-white text-[11px] px-2 py-0.5 rounded-full font-mono font-medium shrink-0">
                            <span>过滤: @{domainHeaderFilter}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDomainHeaderFilter('');
                                setForwardRulesPage(1);
                              }}
                              className="text-gray-300 hover:text-white cursor-pointer ml-0.5"
                              title="清除过滤"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="搜索正则 / 目标邮箱..."
                          value={forwardRulesSearch}
                          onChange={(e) => {
                            setForwardRulesSearch(e.target.value);
                            setForwardRulesPage(1);
                          }}
                          className="w-full pl-8 pr-7 py-1.5 bg-gray-50 focus:bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-black transition-colors"
                        />
                        {forwardRulesSearch && (
                          <button
                            onClick={() => {
                              setForwardRulesSearch('');
                              setForwardRulesPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rules Table */}
                    <div className="border border-gray-200/80 rounded-lg overflow-hidden bg-white shadow-xs">
                      <table className="min-w-full divide-y divide-gray-100 text-xs">
                        <thead className="bg-gray-50 font-semibold text-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left">用户名正则</th>
                            <th className="px-4 py-3 text-left">
                              <div className="flex items-center gap-1.5">
                                <span>匹配收信域名</span>
                                <div className="relative inline-block text-left" ref={domainFilterDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => setDomainFilterDropdownOpen(prev => !prev)}
                                    className={`p-1 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
                                      domainHeaderFilter
                                        ? 'bg-black text-white hover:bg-gray-800'
                                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200/80'
                                    }`}
                                    title="按收信域名过滤"
                                  >
                                    <Filter className="h-3 w-3" />
                                    <ChevronDown className="h-2.5 w-2.5" />
                                  </button>

                                  {domainFilterDropdownOpen && (
                                    <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 text-xs">
                                      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-gray-500 font-medium">
                                        <span>筛选收信域名</span>
                                        {domainHeaderFilter && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDomainHeaderFilter('');
                                              setForwardRulesPage(1);
                                              setDomainFilterDropdownOpen(false);
                                            }}
                                            className="text-gray-400 hover:text-black cursor-pointer text-[11px]"
                                          >
                                            重置全部
                                          </button>
                                        )}
                                      </div>
                                      <div className="max-h-56 overflow-y-auto py-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDomainHeaderFilter('');
                                            setForwardRulesPage(1);
                                            setDomainFilterDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                                            !domainHeaderFilter ? 'font-bold text-black bg-gray-50' : 'text-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            {!domainHeaderFilter ? <Check className="h-3 w-3 text-black" /> : <span className="w-3" />}
                                            <span>全部域名</span>
                                          </div>
                                          <span className="text-[10px] text-gray-400 font-mono">({domainScopedRules.length})</span>
                                        </button>

                                        {availableDomainStrings.length > 0 ? (
                                          availableDomainStrings.map(domStr => {
                                            const count = domainScopedRules.filter(r => getRuleDomainString(r) === domStr).length;
                                            const isSelected = domainHeaderFilter.toLowerCase() === domStr.toLowerCase();
                                            return (
                                              <button
                                                key={domStr}
                                                type="button"
                                                onClick={() => {
                                                  setDomainHeaderFilter(domStr);
                                                  setForwardRulesPage(1);
                                                  setDomainFilterDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                                                  isSelected ? 'font-bold text-black bg-gray-50' : 'text-gray-700'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2 truncate">
                                                  {isSelected ? <Check className="h-3 w-3 text-black shrink-0" /> : <span className="w-3 shrink-0" />}
                                                  <span className="truncate font-mono">@{domStr}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">({count})</span>
                                              </button>
                                            );
                                          })
                                        ) : (
                                          <div className="px-3 py-2 text-center text-gray-400 italic text-[11px]">
                                            暂无可筛选域名
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {domainHeaderFilter && (
                                  <span className="inline-flex items-center gap-1 bg-black text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full font-normal">
                                    <span>@{domainHeaderFilter}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDomainHeaderFilter('');
                                        setForwardRulesPage(1);
                                      }}
                                      className="hover:text-gray-300 cursor-pointer ml-0.5"
                                      title="清除此过滤"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                )}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left">转发至目标</th>
                            <th className="px-4 py-3 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {paginatedRules.length > 0 ? (
                            paginatedRules.map((r, idx) => {
                              const displayDomain = getRuleDomainString(r);
                              const prevDisplayDomain = idx > 0 ? getRuleDomainString(paginatedRules[idx - 1]) : null;
                              const isFirstInGroup = effectiveSelectedDomainId === 'all' && displayDomain !== prevDisplayDomain;
                              const groupCount = sortedAndGroupedRules.filter(x => getRuleDomainString(x) === displayDomain).length;
                              const dest = destinations.find(x => x.id === r.destinationId);

                              return (
                                <React.Fragment key={r.id}>
                                  {isFirstInGroup && (
                                    <tr className="bg-gray-100/70 border-t border-b border-gray-200/80">
                                      <td colSpan={4} className="px-4 py-2 font-mono font-bold text-gray-800 bg-gray-100/80">
                                        <div className="flex items-center gap-2">
                                          <Globe className="h-3.5 w-3.5 text-gray-600 inline" />
                                          <span>@{displayDomain}</span>
                                          <span className="text-[10px] font-normal text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                            {groupCount} 条规则
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2.5">
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={r.enabled !== false}
                                          disabled={togglingForwardRuleId === r.id}
                                          onClick={() => toggleForwardRule(r)}
                                          className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                                            (r.enabled !== false) ? 'bg-black' : 'bg-gray-300'
                                          } ${togglingForwardRuleId === r.id ? 'opacity-50 cursor-wait' : ''}`}
                                          title={r.enabled !== false ? '当前已启用，点击停用' : '当前已停用，点击启用'}
                                        >
                                          <span
                                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                              (r.enabled !== false) ? 'translate-x-4' : 'translate-x-0.5'
                                            }`}
                                          />
                                        </button>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className={`font-mono text-xs ${r.enabled !== false ? 'font-semibold text-black' : 'text-gray-400 line-through'}`}>
                                            ^{r.usernamePattern}$
                                          </span>
                                          {r.enabled === false && (
                                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded leading-none shrink-0 font-sans">
                                              已停用
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-gray-500">@{displayDomain}</td>
                                    <td className="px-4 py-3 font-mono font-medium">{dest?.email || '-'}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                      <button
                                        onClick={() => openForwardRuleModal(r)}
                                        className="text-gray-500 hover:text-gray-600 cursor-pointer"
                                        title="编辑"
                                      >
                                        <Edit className="h-4 w-4 inline" />
                                      </button>
                                      <button
                                        onClick={() => deleteForwardRule(r.id)}
                                        className="text-red-500 hover:text-red-700 cursor-pointer"
                                        title="删除"
                                      >
                                        <Trash2 className="h-4 w-4 inline" />
                                      </button>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                                {forwardRulesSearch || domainHeaderFilter ? (
                                  <div className="space-y-2">
                                    <p className="italic">
                                      未匹配到与 {domainHeaderFilter ? `域名 "@${domainHeaderFilter}"` : ''} {forwardRulesSearch ? `关键词 "${forwardRulesSearch}"` : ''} 相关的转发规则
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForwardRulesSearch('');
                                        setDomainHeaderFilter('');
                                        setForwardRulesPage(1);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors"
                                    >
                                      清除筛选条件
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="italic">
                                      {currentSelectedDomain
                                        ? `域名 @${currentSelectedDomain.domain} 暂无转发规则`
                                        : '暂无转发规则数据'}
                                    </p>
                                    {domains.length > 0 && (
                                      <button
                                        onClick={() => openForwardRuleModal(null, currentSelectedDomain?.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        {currentSelectedDomain ? `为此域名添加规则` : '添加转发规则'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <PaginationControls
                        currentPage={forwardRulesPage}
                        totalItems={sortedAndGroupedRules.length}
                        onPageChange={setForwardRulesPage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Webhooks tab */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">API Webhook 接口</h3>
                  <p className="text-xs text-gray-500 mt-1">配置您可以将邮件转发去的一个或多个外部 Webhook 接口。</p>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenDocs && (
                    <button
                      onClick={onOpenDocs}
                      className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      开发接入文档
                    </button>
                  )}
                  <button
                    onClick={() => openWebhookModal(null)}
                    className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors "
                  >
                    <Plus className="h-4 w-4" />
                    新建 Webhook
                  </button>
                </div>
              </div>

              <div className="border border-gray-100 rounded overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">接口名称</th>
                      <th className="px-4 py-3 text-left">接口 URL</th>
                      <th className="px-4 py-3 text-left">鉴权认证方式 / 密钥</th>
                      <th className="px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {webhooks.length > 0 ? (
                      getPaginatedItems(webhooks, webhooksPage).map(w => (
                        <tr key={w.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-gray-800">{w.name}</td>
                          <td className="px-4 py-3 font-mono text-gray-500 truncate max-w-xs" title={w.url}>{w.url}</td>
                          <td className="px-4 py-3 font-mono">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1.5 text-[10px] font-semibold">{w.authType}</span>
                            <span className="text-gray-400">{obscureToken(w.authType, w.authToken)}</span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => openWebhookModal(w)}
                              className="text-gray-500 hover:text-gray-600 cursor-pointer"
                              title="编辑"
                            >
                              <Edit className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => deleteWebhook(w.id)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                              title="删除"
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
                <PaginationControls
                  currentPage={webhooksPage}
                  totalItems={webhooks.length}
                  onPageChange={setWebhooksPage}
                />
              </div>
            </div>
          )}

          {/* Webhook Rules tab */}
          {activeTab === 'webhookRules' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">API 集成规则 (API Webhook Rules)</h3>
                  <p className="text-xs text-gray-500 mt-1">设置接收邮箱规则匹配，当匹配成功的收信将触发 API Webhook 发送给对应接口地址。</p>
                </div>
                <button
                  onClick={() => openWebhookRuleModal(null)}
                  className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors "
                >
                  <Plus className="h-4 w-4" />
                  新建 API 规则
                </button>
              </div>

              <div className="border border-gray-100 rounded overflow-hidden">
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
                      getPaginatedItems(webhookRules, webhookRulesPage).map(r => {
                        const d = domains.find(x => x.id === r.domainId);
                        const w = webhooks.find(x => x.id === r.webhookId);
                        const displayDomain = r.subdomain ? `${r.subdomain}.${d?.domain || ''}` : (d?.domain || '');
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={r.enabled !== false}
                                  disabled={togglingWebhookRuleId === r.id}
                                  onClick={() => toggleWebhookRule(r)}
                                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                                    (r.enabled !== false) ? 'bg-black' : 'bg-gray-300'
                                  } ${togglingWebhookRuleId === r.id ? 'opacity-50 cursor-wait' : ''}`}
                                  title={r.enabled !== false ? '当前已启用，点击停用' : '当前已停用，点击启用'}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                      (r.enabled !== false) ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`font-mono text-xs ${r.enabled !== false ? 'font-semibold text-black' : 'text-gray-400 line-through'}`}>
                                    ^{r.usernamePattern}$
                                  </span>
                                  {r.enabled === false && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded leading-none shrink-0 font-sans">
                                      已停用
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-500">@{displayDomain}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{w?.name}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => openWebhookRuleModal(r)}
                                className="text-gray-500 hover:text-gray-600 cursor-pointer"
                                title="编辑"
                              >
                                <Edit className="h-4 w-4 inline" />
                              </button>
                              <button
                                onClick={() => deleteWebhookRule(r.id)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                                title="删除"
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
                <PaginationControls
                  currentPage={webhookRulesPage}
                  totalItems={webhookRules.length}
                  onPageChange={setWebhookRulesPage}
                />
              </div>
            </div>
          )}

          {/* Admin tab (Registration review) */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">审核用户注册 (User Verification Panel)</h3>
                  <p className="text-xs text-gray-500 mt-1">审核新用户的注册申请，拒绝或通过激活账号。</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索用户名或邮箱..."
                    value={usersSearch}
                    onChange={(e) => {
                      setUsersSearch(e.target.value);
                      setUsersListPage(1);
                      fetchDashboardData();
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div className="border border-gray-100 rounded overflow-hidden">
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
                      getPaginatedItems(usersList, usersListPage).map(u => (
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
                            <button
                              onClick={() => resetUserPassword(u.id, u.email)}
                              className="px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold rounded-md cursor-pointer transition-colors"
                              title="重置该用户密码"
                            >
                              重置密码
                            </button>
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
                <PaginationControls
                  currentPage={usersListPage}
                  totalItems={usersTotal}
                  onPageChange={(p) => { setUsersListPage(p); fetchDashboardData(); }}
                />
              </div>
            </div>
          )}

          {/* Superadmin tab (Admin management) */}
          {activeTab === 'superadmin' && isSuperadmin && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">管理员及用户管理 (Super Admin Controls)</h3>
                  <p className="text-xs text-gray-500 mt-1">添加系统管理员或注销用户账号。</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索用户名或邮箱..."
                    value={usersSearch}
                    onChange={(e) => {
                      setUsersSearch(e.target.value);
                      setUsersListPage(1);
                      fetchDashboardData();
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <form onSubmit={addAdmin} className="bg-gray-50/50 border border-gray-150 rounded p-4 space-y-4 text-xs text-gray-700">
                <div className="font-semibold text-gray-800">新增管理员账号 (Create Admin)</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">姓名</label>
                    <input
                      type="text"
                      required
                      disabled={adminSaving}
                      value={newAdminName}
                      onChange={e => setNewAdminName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                      placeholder="e.g. Sub Admin"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">邮箱</label>
                    <input
                      type="email"
                      required
                      disabled={adminSaving}
                      value={newAdminEmail}
                      onChange={e => setNewAdminEmail(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                      placeholder="name@domain.com"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">密码</label>
                    <input
                      type="password"
                      required
                      disabled={adminSaving}
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                      placeholder="******"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminSaving}
                  className="px-4 py-2 bg-black text-white text-xs font-semibold rounded hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {adminSaving ? '正在创建...' : '创建管理员'}
                </button>
              </form>

              <div className="border border-gray-100 rounded overflow-hidden">
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
                      getPaginatedItems(usersList, usersListPage).map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold">{u.name}</td>
                          <td className="px-4 py-3 font-mono">{u.email}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-black">{u.role}</td>
                          <td className="px-4 py-3 font-mono">{u.status}</td>
                          <td className="px-4 py-3 text-right">
                            {u.role !== 'superadmin' && (
                              <>
                                <button
                                  onClick={() => resetUserPassword(u.id, u.email)}
                                  className="text-gray-500 hover:text-black mr-3 cursor-pointer"
                                  title="重置密码"
                                >
                                  <Key className="h-4 w-4 inline" />
                                </button>
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  className="text-red-500 hover:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 inline" />
                                </button>
                              </>
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
                <PaginationControls
                  currentPage={usersListPage}
                  totalItems={usersTotal}
                  onPageChange={(p) => { setUsersListPage(p); fetchDashboardData(); }}
                />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── WEBHOOK ADD/EDIT MODAL ── */}
      {webhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 shadow-xl rounded p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-900 font-serif flex items-center gap-1.5">
                <Server className="h-4.5 w-4.5 text-gray-600" />
                {editingWebhook ? '修改 Webhook 接口' : '新增 Webhook 接口'}
              </h4>
              <button
                disabled={webhookSaving}
                onClick={() => setWebhookModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveWebhook} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">接口名称 (Name)</label>
                <input
                  type="text"
                  required
                  disabled={webhookSaving}
                  value={webhookName}
                  onChange={e => setWebhookName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="e.g. 我的飞书机器人"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">接口地址 (Webhook URL)</label>
                <input
                  type="url"
                  required
                  disabled={webhookSaving}
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">鉴权方式 (Auth Type)</label>
                  <select
                    value={webhookAuthType}
                    disabled={webhookSaving}
                    onChange={e => setWebhookAuthType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  >
                    <option value="none">无 (None)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="header">自定义 Header (Key:Value)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">密钥 Token / Header 内容</label>
                  <input
                    type="text"
                    value={webhookAuthToken}
                    onChange={e => setWebhookAuthToken(e.target.value)}
                    disabled={webhookAuthType === 'none' || webhookSaving}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                    placeholder={webhookAuthType === 'header' ? 'X-Secret: my_value' : 'Enter secret token'}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={webhookSaving}
                  onClick={() => setWebhookModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={webhookSaving}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-semibold rounded cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {webhookSaving ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FORWARD RULE ADD/EDIT MODAL ── */}
      {forwardRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 shadow-xl rounded p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-900 font-serif flex items-center gap-1.5">
                <Link className="h-4.5 w-4.5 text-gray-600" />
                {editingForwardRule ? '修改邮件转发规则' : '新增邮件转发规则'}
              </h4>
              <button
                disabled={forwardRuleSaving}
                onClick={() => setForwardRuleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveForwardRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">用户名匹配正则 (Regex)</label>
                  <input
                    type="text"
                    required
                    disabled={forwardRuleSaving}
                    value={rulePattern}
                    onChange={e => setRulePattern(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                    placeholder="e.g. u.* 或 co"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">子域名 (Subdomain - 可选)</label>
                  <input
                    type="text"
                    disabled={forwardRuleSaving}
                    value={ruleSubdomain}
                    onChange={e => setRuleSubdomain(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                    placeholder="e.g. mail"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">匹配收信域名 (Domain)</label>
                  <select
                    required
                    value={ruleDomainId}
                    disabled={forwardRuleSaving}
                    onChange={e => setRuleDomainId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50 font-mono"
                  >
                    <option value="">-- 选择域名 --</option>
                    {domains.map(d => (
                      <option key={d.id} value={d.id}>{d.domain}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">转发到目标邮箱</label>
                  <select
                    required
                    value={ruleDestId}
                    disabled={forwardRuleSaving}
                    onChange={e => setRuleDestId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50 font-mono"
                  >
                    <option value="">-- 选择转发目标 --</option>
                    {destinations.map(dest => (
                      <option key={dest.id} value={dest.id}>{dest.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded">
                <div>
                  <span className="font-semibold text-gray-800 block">启用规则</span>
                  <span className="text-[11px] text-gray-500">停用后，匹配此规则的信件将返回标准的 550 5.2.1 拒信响应</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ruleEnabled}
                  disabled={forwardRuleSaving}
                  onClick={() => setRuleEnabled(prev => !prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    ruleEnabled ? 'bg-black' : 'bg-gray-300'
                  }`}
                  title={ruleEnabled ? '已启用' : '已停用'}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      ruleEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={forwardRuleSaving}
                  onClick={() => setForwardRuleModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={forwardRuleSaving}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-semibold rounded cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {forwardRuleSaving ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WEBHOOK RULE ADD/EDIT MODAL ── */}
      {webhookRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 shadow-xl rounded p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-900 font-serif flex items-center gap-1.5">
                <Link className="h-4.5 w-4.5 text-gray-600" />
                {editingWebhookRule ? '修改 API 集成规则' : '新增 API 集成规则'}
              </h4>
              <button
                disabled={webhookRuleSaving}
                onClick={() => setWebhookRuleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveWebhookRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">用户名匹配正则 (Regex)</label>
                  <input
                    type="text"
                    required
                    disabled={webhookRuleSaving}
                    value={webhookRulePattern}
                    onChange={e => setWebhookRulePattern(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                    placeholder="e.g. jot_* 或 .+"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">子域名 (Subdomain - 可选)</label>
                  <input
                    type="text"
                    disabled={webhookRuleSaving}
                    value={webhookRuleSubdomain}
                    onChange={e => setWebhookRuleSubdomain(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                    placeholder="e.g. mail"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">匹配收信域名 (Domain)</label>
                  <select
                    required
                    value={webhookRuleDomainId}
                    disabled={webhookRuleSaving}
                    onChange={e => setWebhookRuleDomainId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50 font-mono"
                  >
                    <option value="">-- 选择域名 --</option>
                    {domains.map(d => (
                      <option key={d.id} value={d.id}>{d.domain}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">触发 Webhook 接口</label>
                  <select
                    required
                    value={webhookRuleWebhookId}
                    disabled={webhookRuleSaving}
                    onChange={e => setWebhookRuleWebhookId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50 font-mono"
                  >
                    <option value="">-- 选择 Webhook --</option>
                    {webhooks.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded">
                <div>
                  <span className="font-semibold text-gray-800 block">启用规则</span>
                  <span className="text-[11px] text-gray-500">停用后，匹配此规则的信件将返回标准的 550 5.2.1 拒信响应</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={webhookRuleEnabled}
                  disabled={webhookRuleSaving}
                  onClick={() => setWebhookRuleEnabled(prev => !prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    webhookRuleEnabled ? 'bg-black' : 'bg-gray-300'
                  }`}
                  title={webhookRuleEnabled ? '已启用' : '已停用'}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      webhookRuleEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={webhookRuleSaving}
                  onClick={() => setWebhookRuleModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={webhookRuleSaving}
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-semibold rounded cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {webhookRuleSaving ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 shadow-xl rounded p-6 max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-gray-900 font-serif flex items-center gap-1.5">
              <Key className="h-4 w-4 text-gray-600" />
              修改账户密码
            </h4>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">当前密码</label>
                <input
                  type="password"
                  required
                  disabled={isChangingPassword}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="输入当前密码"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">新密码</label>
                <input
                  type="password"
                  required
                  disabled={isChangingPassword}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded focus:outline-hidden focus:border-black focus:ring-0 disabled:opacity-50"
                  placeholder="最少 6 位"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={isChangingPassword}
                  onClick={() => { setShowPasswordModal(false); setOldPassword(''); setNewPassword(''); }}
                  className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? '修改中...' : '确认修改'}
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
