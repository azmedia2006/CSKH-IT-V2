import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { Layout } from '../components/Layout';
import {
  Sparkles, Shield, Clock, Bell, Save, Check, Key, RefreshCw, Plus,
  Trash2, Play, CheckCircle2, AlertCircle, AlertTriangle, Copy,
  Sliders, History, Terminal, CheckSquare, Zap, ExternalLink, X, Edit2, Cpu, Globe, Eye, EyeOff,
  ChevronDown, HelpCircle
} from 'lucide-react';
import {
  settingsApi, AISettingsResponse, GeminiKeyInfo, KeyTestResult, RotationLog, PromptTestResult, googleAuthApi, GoogleAuthSettings, SLAPolicyItem
} from '../services/settingsApi';

export const SettingsPage = () => {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    staleTime: 5 * 60 * 1000
  });

  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState<'ai' | 'sla' | 'security' | 'notifications' | 'logs' | 'google'>((urlTab === 'google') ? 'google' : 'ai');
  const [keyPoolTab, setKeyPoolTab] = useState<'google' | 'groq' | 'cohere'>('google');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Google OAuth Settings State
  const [googleSettings, setGoogleSettings] = useState<GoogleAuthSettings>({
    enabled: false,
    client_id: '',
    client_secret: '',
    redirect_uri: window.location.origin + '/login'
  });
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const fetchGoogleSettings = async () => {
    try {
      const data = await googleAuthApi.getSettings();
      setGoogleSettings({
        enabled: data.enabled || false,
        client_id: data.client_id || '',
        client_secret: data.client_secret || '',
        redirect_uri: data.redirect_uri || (window.location.origin + '/login')
      });
    } catch (e) {
      console.error('Failed to load Google settings', e);
    }
  };

  const handleSaveGoogleSettings = async () => {
    try {
      setSaving(true);
      await googleAuthApi.updateSettings(googleSettings);
      setSaveNotice('Đã lưu cấu hình Google OAuth thành công!');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (currentUser && currentUser.role_name !== 'ADMIN') {
    return <Navigate to={currentUser.role_name === 'REQUESTER' ? '/tickets' : '/dashboard'} replace />;
  }

  // Settings State
  const [settings, setSettings] = useState<AISettingsResponse>({
    provider: 'auto',
    model_name: 'gemini-flash-latest',
    groq_model_name: 'openai/gpt-oss-120b',
    cohere_model_name: 'command-r-plus',
    rotation_strategy: 'FAILOVER',
    cooldown_seconds: 60,
    timeout_seconds: 20,
    confidence_threshold: 0.80,
    auto_triage: true,
    mask_pii: true,
    sla_p1_response: 15,
    sla_p1_resolve: 240,
    email_alerts: true,
    keys: [],
    groq_keys: [],
    cohere_keys: [],
    stats: {
      total_keys: 0,
      active_keys: 0,
      rate_limited_keys: 0,
      error_keys: 0,
      current_index: 0
    },
    groq_stats: {
      total_keys: 0,
      active_keys: 0,
      rate_limited_keys: 0,
      error_keys: 0,
      current_index: 0
    },
    cohere_stats: {
      total_keys: 0,
      active_keys: 0,
      rate_limited_keys: 0,
      error_keys: 0,
      current_index: 0
    }
  });

  // Add Key Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyStr, setNewKeyStr] = useState('');
  const [batchKeysStr, setBatchKeysStr] = useState('');
  const [testingNewKey, setTestingNewKey] = useState(false);
  const [newKeyTestResult, setNewKeyTestResult] = useState<KeyTestResult | null>(null);

  // Per-key testing state
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [isTestingAllKeys, setIsTestingAllKeys] = useState(false);
  const [keyTestFeedback, setKeyTestFeedback] = useState<{ [id: string]: KeyTestResult }>({});
  
  // Per-key rename state
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState<string>('');

  // Prompt Playground State
  const [testPromptText, setTestPromptText] = useState('Khách hàng gửi yêu cầu: "Tôi không nhận được mã OTP đăng nhập vào hệ thống từ sáng nay". Hãy phân loại và gợi ý phản hồi.');
  const [testingPrompt, setTestingPrompt] = useState(false);
  const [promptResult, setPromptResult] = useState<PromptTestResult | null>(null);

  // Rotation Logs State
  const [logs, setLogs] = useState<RotationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Copied alert
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SLA Policies State
  const [slaPolicies, setSlaPolicies] = useState<SLAPolicyItem[]>([
    { priority_level: 'P1', response_time_minutes: 15, resolve_time_minutes: 240, description: 'Sự cố Nghiêm trọng (P1 - Critical)' },
    { priority_level: 'P2', response_time_minutes: 30, resolve_time_minutes: 480, description: 'Sự cố Mức độ cao (P2 - High)' },
    { priority_level: 'P3', response_time_minutes: 60, resolve_time_minutes: 1440, description: 'Sự cố Mức độ trung bình (P3 - Medium)' },
    { priority_level: 'P4', response_time_minutes: 120, resolve_time_minutes: 2880, description: 'Yêu cầu Hỗ trợ thông thường (P4 - Low)' },
  ]);
  const [loadingSla, setLoadingSla] = useState(false);
  const [savingSla, setSavingSla] = useState(false);

  useEffect(() => {
    if (activeTab === 'sla') {
      setLoadingSla(true);
      settingsApi.getSLAPolicies()
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setSlaPolicies(res);
          }
        })
        .catch((e) => console.error('Error fetching SLA policies:', e))
        .finally(() => setLoadingSla(false));
    }
  }, [activeTab]);

  const handleSaveSlaPolicies = async () => {
    try {
      setSavingSla(true);
      await settingsApi.updateSLAPolicies(slaPolicies);
      showNotice('Đã lưu và áp dụng tiêu chuẩn SLA cho P1, P2, P3, P4 thành công!');
    } catch (err: any) {
      showNotice('Lỗi khi lưu SLA: ' + (err.response?.data?.detail || err.message), true);
    } finally {
      setSavingSla(false);
    }
  };

  // Load Settings on Mount
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getAISettings();
      setSettings(data);
      if (data.provider && data.provider !== 'auto') {
        setKeyPoolTab(data.provider);
      } else {
        setKeyPoolTab('google');
      }
    } catch (err) {
      console.warn('Could not fetch settings from backend, using local defaults', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([
        fetchSettings(),
        activeTab === 'logs' ? fetchLogs() : Promise.resolve()
      ]);
      await new Promise(r => setTimeout(r, 400));
      setSaveNotice('Đã làm mới dữ liệu cài đặt và trạng thái Key thành công!');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: any) {
      showNotice('Không thể làm mới: ' + (err.response?.data?.detail || err.message), true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const data = await settingsApi.getRotationLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchGoogleSettings();
  }, []);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'google') {
      setActiveTab('google');
    }
  }, [window.location.search]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const updated = await settingsApi.updateAISettings(settings);
      setSettings(updated);
      showNotice('Cấu hình hệ thống đã được lưu và áp dụng thành công!');
    } catch (err: any) {
      showNotice('Lỗi khi lưu cài đặt: ' + (err.response?.data?.detail || err.message), true);
    } finally {
      setSaving(false);
    }
  };

  const showNotice = (msg: string, isError = false) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 4000);
  };

  // Test single key inside table
  const handleTestKey = async (keyId: string, targetTab = keyPoolTab) => {
    setTestingKeyId(keyId);
    try {
      let res;
      if (targetTab === 'cohere') {
        res = await settingsApi.testCohereKey(keyId);
      } else if (targetTab === 'groq') {
        res = await settingsApi.testGroqKey(keyId);
      } else {
        res = await settingsApi.testKey(keyId);
      }
      setKeyTestFeedback(prev => ({ ...prev, [keyId]: res }));
      const updated = await settingsApi.getAISettings();
      setSettings(updated);
      setTimeout(() => {
        setKeyTestFeedback(prev => {
          const next = { ...prev };
          delete next[keyId];
          return next;
        });
      }, 5000);
    } catch (err: any) {
      setKeyTestFeedback(prev => ({
        ...prev,
        [keyId]: {
          success: false,
          status_code: 500,
          latency_ms: 0,
          message: err.response?.data?.detail || 'Lỗi kiểm tra key'
        }
      }));
      setTimeout(() => {
        setKeyTestFeedback(prev => {
          const next = { ...prev };
          delete next[keyId];
          return next;
        });
      }, 5000);
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test all keys in current active pool tab
  const handleTestAllKeys = async () => {
    if (currentKeys.length === 0 || isTestingAllKeys) return;
    setIsTestingAllKeys(true);
    showNotice(`Đang kiểm tra toàn bộ ${currentKeys.length} Key trong Pool...`);
    try {
      let passCount = 0;
      let failCount = 0;
      const targetTab = keyPoolTab;

      for (const k of currentKeys) {
        setTestingKeyId(k.id);
        try {
          let res;
          if (targetTab === "cohere") {
            res = await settingsApi.testCohereKey(k.id);
          } else if (targetTab === "groq") {
            res = await settingsApi.testGroqKey(k.id);
          } else {
            res = await settingsApi.testKey(k.id);
          }
          setKeyTestFeedback(prev => ({ ...prev, [k.id]: res }));
          if (res.success) passCount++;
          else failCount++;
        } catch (err: any) {
          failCount++;
          setKeyTestFeedback(prev => ({
            ...prev,
            [k.id]: {
              success: false,
              status_code: 500,
              latency_ms: 0,
              message: err.response?.data?.detail || "Lỗi kiểm tra key"
            }
          }));
        }
      }

      const updated = await settingsApi.getAISettings();
      setSettings(updated);
      showNotice(`Hoàn tất kiểm tra! ${passCount} Key hoạt động, ${failCount} Key lỗi/chờ.`);

      setTimeout(() => {
        setKeyTestFeedback({});
      }, 8000);
    } catch (err: any) {
      showNotice("Lỗi: " + (err.response?.data?.detail || err.message), true);
    } finally {
      setTestingKeyId(null);
      setIsTestingAllKeys(false);
    }
  };

  // Test unsaved key in modal
  const handleTestUnsavedKey = async () => {
    if (!newKeyStr.trim()) return;
    setTestingNewKey(true);
    setNewKeyTestResult(null);
    try {
      let res;
      if (keyPoolTab === 'cohere') {
        res = await settingsApi.testUnsavedCohereKey(newKeyStr.trim(), settings.cohere_model_name || 'command-r-plus');
      } else if (keyPoolTab === 'groq') {
        res = await settingsApi.testUnsavedGroqKey(newKeyStr.trim(), settings.groq_model_name || 'openai/gpt-oss-120b');
      } else {
        res = await settingsApi.testUnsavedKey(newKeyStr.trim(), settings.model_name || 'gemini-flash-latest');
      }
      setNewKeyTestResult(res);
    } catch (err: any) {
      setNewKeyTestResult({
        success: false,
        status_code: 500,
        latency_ms: 0,
        message: err.response?.data?.detail || 'Không thể kiểm tra API Key'
      });
    } finally {
      setTestingNewKey(false);
    }
  };

  // Add Key handler
  const handleAddKey = async () => {
    try {
      const providerLabel = keyPoolTab === 'cohere' ? 'Cohere' : (keyPoolTab === 'groq' ? 'Groq' : 'Gemini');
      if (addMode === 'single') {
        if (!newKeyStr.trim()) return;
        let updated;
        if (keyPoolTab === 'cohere') {
          updated = await settingsApi.addCohereKey(newKeyStr.trim(), newKeyName.trim() || undefined);
        } else if (keyPoolTab === 'groq') {
          updated = await settingsApi.addGroqKey(newKeyStr.trim(), newKeyName.trim() || undefined);
        } else {
          updated = await settingsApi.addKey(newKeyStr.trim(), newKeyName.trim() || undefined);
        }
        setSettings(updated);
      } else {
        if (!batchKeysStr.trim()) return;
        let updated;
        if (keyPoolTab === 'cohere') {
          updated = await settingsApi.addBatchCohereKeys(batchKeysStr.trim());
        } else if (keyPoolTab === 'groq') {
          updated = await settingsApi.addBatchGroqKeys(batchKeysStr.trim());
        } else {
          updated = await settingsApi.addBatchKeys(batchKeysStr.trim());
        }
        setSettings(updated);
      }
      setShowAddModal(false);
      setNewKeyName('');
      setNewKeyStr('');
      setBatchKeysStr('');
      setNewKeyTestResult(null);
      showNotice(`Đã thêm ${providerLabel} API Key vào Pool thành công!`);
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Lỗi khi thêm key');
    }
  };

  // Toggle Key Status
  const handleToggleKey = async (key: GeminiKeyInfo, targetTab = keyPoolTab) => {
    try {
      let updated;
      if (targetTab === 'cohere') {
        updated = await settingsApi.updateCohereKey(key.id, { is_active: !key.is_active });
      } else if (targetTab === 'groq') {
        updated = await settingsApi.updateGroqKey(key.id, { is_active: !key.is_active });
      } else {
        updated = await settingsApi.updateKey(key.id, { is_active: !key.is_active });
      }
      setSettings(updated);
    } catch (err: any) {
      showNotice('Không thể cập nhật trạng thái: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  // Rename Key
  const handleSaveRename = async (keyId: string, targetTab = keyPoolTab) => {
    if (!editingKeyName.trim()) {
      showNotice('Tên Key không được để trống!', true);
      return;
    }
    try {
      let updated;
      if (targetTab === 'cohere') {
        updated = await settingsApi.updateCohereKey(keyId, { name: editingKeyName.trim() });
      } else if (targetTab === 'groq') {
        updated = await settingsApi.updateGroqKey(keyId, { name: editingKeyName.trim() });
      } else {
        updated = await settingsApi.updateKey(keyId, { name: editingKeyName.trim() });
      }
      setSettings(updated);
      setEditingKeyId(null);
      showNotice(`Đã đổi tên Key thành "${editingKeyName.trim()}" thành công!`);
    } catch (err: any) {
      showNotice('Lỗi khi đổi tên key: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  // Delete Key
  const handleDeleteKey = async (keyId: string, name: string, targetTab = keyPoolTab) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Key "${name}" khỏi Pool?`)) return;
    try {
      let updated;
      if (targetTab === 'cohere') {
        updated = await settingsApi.deleteCohereKey(keyId);
      } else if (targetTab === 'groq') {
        updated = await settingsApi.deleteGroqKey(keyId);
      } else {
        updated = await settingsApi.deleteKey(keyId);
      }
      setSettings(updated);
      showNotice(`Đã xóa Key "${name}" khỏi danh sách.`);
    } catch (err: any) {
      showNotice('Lỗi khi xóa key: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  // Reset All Statuses
  const handleResetStatuses = async () => {
    try {
      let updated;
      const providerLabel = keyPoolTab === 'cohere' ? 'Cohere' : (keyPoolTab === 'groq' ? 'Groq' : 'Gemini');
      if (keyPoolTab === 'cohere') {
        updated = await settingsApi.resetCohereKeysStatus();
      } else if (keyPoolTab === 'groq') {
        updated = await settingsApi.resetGroqKeysStatus();
      } else {
        updated = await settingsApi.resetKeysStatus();
      }
      setSettings(updated);
      showNotice(`Đã mở khóa và kích hoạt lại toàn bộ các ${providerLabel} Key trong Pool!`);
    } catch (err: any) {
      showNotice('Lỗi: ' + (err.response?.data?.detail || err.message), true);
    }
  };

  // Run AI Playground prompt test
  const handleRunPromptTest = async () => {
    if (!testPromptText.trim()) return;
    setTestingPrompt(true);
    setPromptResult(null);
    try {
      const res = await settingsApi.testPrompt(testPromptText.trim());
      setPromptResult(res);
    } catch (err: any) {
      setPromptResult({
        success: false,
        latency_ms: 0,
        error: err.response?.data?.detail || err.message || 'Lỗi kiểm thử prompt'
      });
    } finally {
      setTestingPrompt(false);
    }
  };

  // Copy Key to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (ts?: number | null) => {
    if (!ts) return 'Chưa sử dụng';
    const d = new Date(ts * 1000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  const currentKeys = keyPoolTab === 'cohere'
    ? (settings.cohere_keys || [])
    : (keyPoolTab === 'groq' ? (settings.groq_keys || []) : settings.keys);

  const currentStats = keyPoolTab === 'cohere'
    ? (settings.cohere_stats || { total_keys: 0, active_keys: 0, rate_limited_keys: 0, error_keys: 0, current_index: 0 })
    : (keyPoolTab === 'groq'
        ? (settings.groq_stats || { total_keys: 0, active_keys: 0, rate_limited_keys: 0, error_keys: 0, current_index: 0 })
        : settings.stats);

  return (
    <Layout>
      <div className="space-y-6 p-6 md:p-8 pt-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Cài đặt AI & Quy chuẩn Hệ thống</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>

        {/* Save Notice Banner */}
        {saveNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveNotice}</span>
            </div>
            <button type="button" onClick={() => setSaveNotice(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'ai'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mô hình AI & Key Pool</span>
          </button>

          <button
            onClick={() => setActiveTab('sla')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'sla'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Quy chuẩn SLA</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Bảo mật & PII</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Thông báo</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Nhật ký luân chuyển</span>
          </button>

          <button
            onClick={() => setActiveTab('google')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'google'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Cấu hình Google</span>
          </button>
        </div>

        {/* TAB 1: AI MODELS & KEY POOL */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Key Pool Health Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium text-slate-500">Tổng Key ({keyPoolTab === 'groq' ? 'Groq' : 'Gemini'})</span>
                  <Key className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{currentStats.total_keys}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Sẵn sàng luân chuyển</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-emerald-700">Khả dụng (Active)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-2xl font-bold text-emerald-600">{currentStats.active_keys}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Sẵn sàng nhận request</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-amber-700">Hết Token / Chờ</span>
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                </div>
                <div className="text-2xl font-bold text-amber-600">{currentStats.rate_limited_keys}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Đang Cooldown tự động</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-rose-700">Lỗi / Hỏng</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                </div>
                <div className="text-2xl font-bold text-rose-600">{currentStats.error_keys}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Key sai hoặc không hợp lệ</p>
              </div>
            </div>

            {/* AI Engine & Auto-Rotation Configuration (Unified 2-Part Design) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cấu hình Mô hình & Xoay Key Tự động</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetStatuses}
                  title={`Mở khóa lại toàn bộ Key (${keyPoolTab === 'groq' ? 'Groq' : 'Gemini'})`}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* PHẦN 1: CHỌN NHÀ CUNG CẤP AI (PROVIDER & MODE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">1</span>
                    <span>Chọn Nhà cung cấp & Chế độ Vận hành AI</span>
                  </label>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Option 1: Auto Hybrid Failover */}
                  <div
                    onClick={() => setSettings({ ...settings, provider: 'auto' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      settings.provider === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Tự Động Kết Hợp</span>
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          settings.provider === 'auto' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {settings.provider === 'auto' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Google Gemini */}
                  <div
                    onClick={() => setSettings({ ...settings, provider: 'google' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      settings.provider === 'google'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Google Gemini AI</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          settings.provider === 'google' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {settings.provider === 'google' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Groq Cloud */}
                  <div
                    onClick={() => setSettings({ ...settings, provider: 'groq' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      settings.provider === 'groq'
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Groq Cloud (LPU)</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          settings.provider === 'groq' ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                        }`}>
                          {settings.provider === 'groq' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 4: Cohere AI */}
                  <div
                    onClick={() => setSettings({ ...settings, provider: 'cohere' })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      settings.provider === 'cohere'
                        ? 'border-purple-600 bg-purple-50/50 shadow-xs ring-2 ring-purple-500/15'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Cohere AI (Trial)</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          settings.provider === 'cohere' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                        }`}>
                          {settings.provider === 'cohere' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN 2: CHỌN MÔ HÌNH VÀ THIẾT LẬP XOAY KEY */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">2</span>
                  <span>Chọn Mô hình & Thiết lập Xoay Key</span>
                </label>

                {settings.provider === 'auto' ? (
                  /* Hybrid Auto-Failover: Configure both Gemini Model & Groq Fallback Model */
                  <div className="grid gap-4 sm:grid-cols-4">
                    {/* Primary Gemini Model */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Mô hình Gemini (Chính)</span>
                      </label>
                      <select
                        value={settings.model_name || 'gemini-flash-latest'}
                        onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="gemini-flash-latest">Gemini Flash Latest (Khuyên dùng)</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                      <p className="text-[11px] text-slate-400">Được gọi ưu tiên trước</p>
                    </div>

                    {/* Fallback Groq Model */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Mô hình Groq (Dự phòng)</span>
                      </label>
                      <select
                        value={settings.groq_model_name || 'openai/gpt-oss-120b'}
                        onChange={(e) => setSettings({ ...settings, groq_model_name: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 cursor-pointer shadow-2xs"
                      >
                        <option value="openai/gpt-oss-120b">OpenAI GPT OSS 120B (Khuyên dùng • Mạnh mẽ nhất)</option>
                        <option value="openai/gpt-oss-20b">OpenAI GPT OSS 20B (Siêu tốc &lt; 0.2s)</option>
                        <option value="qwen/qwen3.6-27b">Qwen 3.6 27B (Đa ngôn ngữ &amp; Lập luận)</option>
                        <option value="llama-3.3-70b-versatile">Meta Llama 3.3 70B</option>
                        <option value="llama-3.1-8b-instant">Meta Llama 3.1 8B</option>
                        <option value="llama3-70b-8192">Meta Llama 3 70B</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                      </select>
                      <p className="text-[11px] text-slate-400">Tự động gọi khi Gemini bận</p>
                    </div>

                    {/* Rotation Strategy */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Chiến lược Xoay Key
                      </label>
                      <select
                        value={settings.rotation_strategy}
                        onChange={(e) => setSettings({ ...settings, rotation_strategy: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="FAILOVER">Failover (Ưu tiên Key 1, chỉ xoay khi 429)</option>
                        <option value="ROUND_ROBIN">Round Robin (Luân phiên đều)</option>
                      </select>
                      <p className="text-[11px] text-slate-400">Xoay vòng trong Key Pool</p>
                    </div>

                    {/* Cooldown */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Thời gian Cooldown phục hồi
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={10}
                          max={3600}
                          value={settings.cooldown_seconds}
                          onChange={(e) => setSettings({ ...settings, cooldown_seconds: Number(e.target.value) })}
                          className="w-full pl-3 pr-12 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 shadow-2xs"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                          Giây
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Thời gian nghỉ của Key bị 429</p>
                    </div>
                  </div>
                ) : (
                  /* Single Provider Selection */
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Model selection */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {settings.provider === 'cohere' ? 'Mô hình Cohere AI' : (settings.provider === 'groq' ? 'Mô hình Groq AI' : 'Mô hình Gemini AI')}
                      </label>
                      {settings.provider === 'cohere' ? (
                        <select
                          value={settings.cohere_model_name || 'command-r-plus-08-2024'}
                          onChange={(e) => setSettings({ ...settings, cohere_model_name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/15 focus:border-purple-500 cursor-pointer shadow-2xs"
                        >
                          <option value="command-r-plus-08-2024">Cohere Command R+ 08-2024 (Khuyên dùng • Lập luận sâu)</option>
                          <option value="command-r-08-2024">Cohere Command R 08-2024 (Nhanh • Tối ưu hội thoại)</option>
                          <option value="command-r7b-12-2024">Cohere Command R 7B (Siêu tốc &amp; Nhẹ)</option>
                          <option value="c4ai-aya-expanse-32b">Cohere Aya Expanse 32B (Đa ngôn ngữ &amp; Tiếng Việt)</option>
                        </select>
                      ) : settings.provider === 'groq' ? (
                        <select
                          value={settings.groq_model_name || 'openai/gpt-oss-120b'}
                          onChange={(e) => setSettings({ ...settings, groq_model_name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 cursor-pointer shadow-2xs"
                        >
                          <option value="openai/gpt-oss-120b">OpenAI GPT OSS 120B (Khuyên dùng • Mạnh mẽ nhất)</option>
                          <option value="openai/gpt-oss-20b">OpenAI GPT OSS 20B (Siêu tốc &lt; 0.2s)</option>
                          <option value="qwen/qwen3.6-27b">Qwen 3.6 27B (Đa ngôn ngữ &amp; Lập luận)</option>
                          <option value="llama-3.3-70b-versatile">Meta Llama 3.3 70B</option>
                          <option value="llama-3.1-8b-instant">Meta Llama 3.1 8B</option>
                          <option value="llama3-70b-8192">Meta Llama 3 70B</option>
                          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                        </select>
                      ) : (
                        <select
                          value={settings.model_name || 'gemini-flash-latest'}
                          onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 cursor-pointer shadow-2xs"
                        >
                          <option value="gemini-flash-latest">Gemini Flash Latest (Khuyên dùng • Mới nhất)</option>
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Lập luận sâu)</option>
                        </select>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {settings.provider === 'cohere' ? 'Mô hình chuyên biệt xử lý hội thoại CSKH' : (settings.provider === 'groq' ? 'Tốc độ tạo chữ 300-800 từ/giây' : 'Xử lý tiếng Việt tự nhiên và hiểu ngữ cảnh đa dạng')}
                      </p>
                    </div>

                    {/* Rotation Strategy */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Chiến lược Xoay Key
                      </label>
                      <select
                        value={settings.rotation_strategy}
                        onChange={(e) => setSettings({ ...settings, rotation_strategy: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="FAILOVER">Failover (Ưu tiên Key 1, chỉ xoay khi lỗi 429)</option>
                        <option value="ROUND_ROBIN">Round Robin (Luân phiên đều từng Key)</option>
                      </select>
                      <p className="text-[11px] text-slate-400">Tự động chuyển đổi khi chạm giới hạn Rate Limit</p>
                    </div>

                    {/* Cooldown */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Thời gian Cooldown phục hồi
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={10}
                          max={3600}
                          value={settings.cooldown_seconds}
                          onChange={(e) => setSettings({ ...settings, cooldown_seconds: Number(e.target.value) })}
                          className="w-full pl-3 pr-12 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 shadow-2xs"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                          Giây
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Thời gian nghỉ trước khi kích hoạt lại Key bị khóa</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 2 Bottom Modern Toggle Cards */}
              <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-slate-100">
                {/* Auto Triage Switch */}
                <div 
                  onClick={() => setSettings({ ...settings, auto_triage: !settings.auto_triage })}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors cursor-pointer group"
                >
                  <div className="pr-4">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Tự động phân loại Ticket</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tự động gán danh mục và mức ưu tiên khi có ticket mới tạo.</p>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.auto_triage ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.auto_triage ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </div>

                {/* Confidence Threshold */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div className="pr-4">
                    <p className="text-xs font-bold text-slate-900">Ngưỡng tự tin tối thiểu</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Gắn cờ cho Kỹ thuật viên duyệt lại nếu điểm tin cậy dưới ngưỡng.</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      {Math.round(settings.confidence_threshold * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={0.95}
                      step={0.05}
                      value={settings.confidence_threshold}
                      onChange={(e) => setSettings({ ...settings, confidence_threshold: parseFloat(e.target.value) })}
                      className="w-20 sm:w-24 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Key Pool Management Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setKeyPoolTab('google')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      keyPoolTab === 'google'
                        ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Google Gemini Keys ({settings.keys.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyPoolTab('groq')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      keyPoolTab === 'groq'
                        ? 'bg-white text-amber-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Groq Cloud Keys ({(settings.groq_keys || []).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeyPoolTab('cohere')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      keyPoolTab === 'cohere'
                        ? 'bg-white text-purple-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Cohere Keys ({(settings.cohere_keys || []).length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode('single');
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Key {keyPoolTab === 'cohere' ? 'Cohere' : (keyPoolTab === 'groq' ? 'Groq' : 'Gemini')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode('batch');
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <span>Dán hàng loạt</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestAllKeys}
                    disabled={isTestingAllKeys || currentKeys.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                    title={`Kiểm tra độ phản hồi của toàn bộ ${currentKeys.length} Key trong tab hiện tại`}
                  >
                    <Play className={`w-3.5 h-3.5 text-emerald-600 ${isTestingAllKeys ? "animate-spin" : ""}`} />
                    <span>{isTestingAllKeys ? "Đang test..." : "Test toàn bộ Key"}</span>
                  </button>
                </div>
              </div>

              {currentKeys.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl p-6 space-y-3">
                  <Key className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Chưa có {keyPoolTab === 'groq' ? 'Groq' : 'Google Gemini'} API Key nào trong Pool
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {keyPoolTab === 'groq' 
                      ? 'Lấy API Key miễn phí từ console.groq.com để trải nghiệm tốc độ phản hồi cực nhanh.' 
                      : 'Thêm một hoặc nhiều Google Gemini API Key để kích hoạt AI ServiceDesk.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode('single');
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm {keyPoolTab === 'groq' ? 'Groq' : 'Gemini'} Key đầu tiên</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3.5">Tên / Nhãn</th>
                        <th className="py-2.5 px-3.5">API Key (Đã che)</th>
                        <th className="py-2.5 px-3.5">Trạng thái</th>
                        <th className="py-2.5 px-3.5">Lượt gọi / Lỗi</th>
                        <th className="py-2.5 px-3.5">Sử dụng gần nhất</th>
                        <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                      {currentKeys.map((k) => {
                        const feedback = keyTestFeedback[k.id];
                        const isTesting = testingKeyId === k.id;

                        let statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Khả dụng
                          </span>
                        );
                        if (k.status === 'RATE_LIMITED') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Cooldown
                            </span>
                          );
                        } else if (k.status === 'INVALID') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Lỗi Key
                            </span>
                          );
                        } else if (!k.is_active) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Tắt
                            </span>
                          );
                        }

                        return (
                          <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3.5 font-medium text-slate-900">
                              {editingKeyId === k.id ? (
                                <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
                                  <input
                                    type="text"
                                    value={editingKeyName}
                                    onChange={(e) => setEditingKeyName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRename(k.id, keyPoolTab);
                                      if (e.key === 'Escape') setEditingKeyId(null);
                                    }}
                                    className="px-2 py-1 bg-white border border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none ring-2 ring-indigo-500/20 w-32 sm:w-40"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveRename(k.id, keyPoolTab)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                                    title="Lưu tên"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingKeyId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer"
                                    title="Hủy"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group">
                                  <span className="font-semibold text-slate-900">{k.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingKeyId(k.id);
                                      setEditingKeyName(k.name);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Đổi tên Key"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <span>{k.masked_key}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(k.masked_key, k.id)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                  title="Sao chép"
                                >
                                  {copiedId === k.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5">
                              {statusBadge}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600">
                              <span className="font-semibold text-slate-900">{k.total_requests || 0}</span>
                              <span className="text-slate-400 mx-1">/</span>
                              <span className={(k.failed_requests || 0) > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}>
                                {k.failed_requests || 0} lỗi
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">
                              {formatTime(k.last_used_at)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKeyId(k.id);
                                    setEditingKeyName(k.name);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Đổi tên Key"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTestKey(k.id, keyPoolTab)}
                                  disabled={isTesting}
                                  className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Kiểm tra ping & quota"
                                >
                                  <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleKey(k, keyPoolTab)}
                                  className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer"
                                  title={k.is_active ? 'Tắt Key' : 'Bật Key'}
                                >
                                  <CheckSquare className={`w-3.5 h-3.5 ${k.is_active ? 'text-indigo-600' : 'text-slate-300'}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKey(k.id, k.name, keyPoolTab)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Xóa Key"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {feedback && (
                                <div 
                                  title={feedback.message}
                                  className={`text-[11px] font-medium mt-1 max-w-[200px] truncate ml-auto ${feedback.success ? 'text-emerald-600' : 'text-rose-600'}`}
                                >
                                  {feedback.success ? `✓ ${feedback.latency_ms}ms` : feedback.message}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Prompt Playground */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">AI Prompt Playground</h3>
                </div>
                <button
                  type="button"
                  onClick={handleRunPromptTest}
                  disabled={testingPrompt || !testPromptText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingPrompt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Chạy thử nghiệm</span>
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={testPromptText}
                  onChange={(e) => setTestPromptText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  placeholder="Nhập nội dung câu hỏi để AI xử lý..."
                />
              </div>

              {promptResult && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] pb-1.5 border-b border-slate-200">
                    <span className={promptResult.success ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                      {promptResult.success ? `✓ Thành công (${promptResult.latency_ms}ms)` : '✕ Thất bại'}
                    </span>
                    <span className="text-slate-600 font-medium">
                      Nhà cung cấp: {promptResult.provider === 'groq' ? 'Groq Cloud' : 'Google Gemini'} ({promptResult.model || ''})
                    </span>
                  </div>
                  <pre className="text-slate-800 whitespace-pre-wrap leading-relaxed text-[11px] overflow-x-auto">
                    {promptResult.response || promptResult.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SLA POLICIES */}
        {activeTab === 'sla' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Thiết lập Tiêu chuẩn SLA (P1 - P4)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cấu hình hạn phản hồi lần đầu (MTTFR) và hạn giải quyết (MTTR) lưu trữ trực tiếp trong cơ sở dữ liệu.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSlaPolicies}
                disabled={savingSla}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                {savingSla ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingSla ? 'Đang lưu...' : 'Lưu tiêu chuẩn SLA'}</span>
              </button>
            </div>

            {loadingSla ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Đang tải cấu hình SLA từ cơ sở dữ liệu...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {slaPolicies.map((p, idx) => {
                    const isP1 = p.priority_level.includes('P1');
                    const isP2 = p.priority_level.includes('P2');
                    const isP3 = p.priority_level.includes('P3');
                    const isP4 = p.priority_level.includes('P4');

                    const badgeColor = isP1
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isP2
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : isP3
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';

                    const levelLabel = isP1
                      ? 'P1 - Khẩn cấp / Nghiêm trọng'
                      : isP2
                      ? 'P2 - Mức độ cao'
                      : isP3
                      ? 'P3 - Trung bình (Mặc định)'
                      : 'P4 - Thông thường / Thấp';

                    return (
                      <div key={p.priority_level || idx} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                            {levelLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {p.resolve_time_minutes ? `${(p.resolve_time_minutes / 60).toFixed(1)} giờ` : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">Phản hồi lần đầu (Phút)</label>
                            <input
                              type="number"
                              min={1}
                              value={p.response_time_minutes}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSlaPolicies(prev => prev.map((item, i) => i === idx ? { ...item, response_time_minutes: val } : item));
                              }}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600">Giải quyết hoàn tất (Phút)</label>
                            <input
                              type="number"
                              min={1}
                              value={p.resolve_time_minutes}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSlaPolicies(prev => prev.map((item, i) => i === idx ? { ...item, resolve_time_minutes: val } : item));
                              }}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-500">Mô tả chính sách</label>
                          <input
                            type="text"
                            value={p.description || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSlaPolicies(prev => prev.map((item, i) => i === idx ? { ...item, description: val } : item));
                            }}
                            placeholder="Mô tả phạm vi áp dụng..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold">Quy tắc tạm dừng SLA:</span> Khi ticket chuyển sang trạng thái <span className="font-semibold text-amber-800">Chờ khách hàng (WAITING_CUSTOMER)</span>, đồng hồ đo thời gian xử lý SLA sẽ được tạm dừng tính toán để bảo đảm tính khách quan cho hiệu suất của Đội ngũ Hỗ trợ.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SECURITY & PII */}
        {activeTab === 'security' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Bảo mật & Che thông tin nhạy cảm</h3>
              <p className="text-xs text-slate-500">Ngăn ngừa lộ thông tin cá nhân và dữ liệu định danh trước khi gửi prompt lên AI.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">Bật cơ chế lọc & che thông tin nhạy cảm</p>
                <p className="text-[11px] text-slate-500">Tự động thay thế SĐT, Email, CCCD, Thẻ tín dụng thành `[REDACTED]`.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.mask_pii}
                onChange={(e) => setSettings({ ...settings, mask_pii: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Kênh thông báo & Cảnh báo Sự cố</h3>
              <p className="text-xs text-slate-500">Gửi thông báo tức thì khi có ticket vi phạm SLA hoặc toàn bộ Key bị Rate-limit.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">Gửi thông báo qua Email</p>
                <p className="text-[11px] text-slate-500">Gửi email cảnh báo đến ban quản trị khi có sự cố khẩn cấp.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.email_alerts}
                onChange={(e) => setSettings({ ...settings, email_alerts: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 6: GOOGLE OAUTH CONFIGURATION */}
        {activeTab === 'google' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
              {/* Header & Main Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">Google OAuth 2.0</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        googleSettings.enabled 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${googleSettings.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        {googleSettings.enabled ? 'Đang bật' : 'Đang tắt'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cho phép đăng nhập nhanh bằng tài khoản Google tại trang đăng nhập.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {/* Status Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Kích hoạt:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={googleSettings.enabled}
                      onClick={() => setGoogleSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        googleSettings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                      title={googleSettings.enabled ? 'Bấm để tắt tính năng' : 'Bấm để bật tính năng'}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          googleSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveGoogleSettings}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {saving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu cấu hình</span>
                  </button>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Google Client ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Google Client ID</span>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">Bắt buộc</span>
                  </label>
                  <input
                    type="text"
                    value={googleSettings.client_id}
                    onChange={(e) => setGoogleSettings(prev => ({ ...prev, client_id: e.target.value.trim() }))}
                    placeholder="...apps.googleusercontent.com"
                    className="w-full h-9 px-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Google Client Secret */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Google Client Secret</span>
                    <span className="text-[10px] font-medium text-slate-400">Tùy chọn</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showGoogleSecret ? 'text' : 'password'}
                      value={googleSettings.client_secret}
                      onChange={(e) => setGoogleSettings(prev => ({ ...prev, client_secret: e.target.value.trim() }))}
                      placeholder="GOCSPX-..."
                      className="w-full h-9 pl-3 pr-9 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      {showGoogleSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Authorized Redirect URI */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Authorized Redirect URI (Đường dẫn chuyển hướng)</span>
                    <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">Cần dán vào Google Console</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      value={googleSettings.redirect_uri || (window.location.origin + '/login')}
                      className="w-full h-9 pl-3 pr-24 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const uri = googleSettings.redirect_uri || (window.location.origin + '/login');
                        navigator.clipboard.writeText(uri);
                        setCopiedRedirect(true);
                        setTimeout(() => setCopiedRedirect(false), 2000);
                      }}
                      className="absolute right-1.5 h-6.5 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-[11px] font-medium flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    >
                      {copiedRedirect ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Step-by-Step Guide */}
              <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cách lấy Client ID & Secret từ Google Cloud Console</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showGuide ? 'rotate-180' : ''}`} />
                </button>

                {showGuide && (
                  <div className="px-4 pb-3.5 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-200/70 bg-white">
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>Truy cập <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold inline-flex items-center gap-0.5 hover:underline">Google Cloud Console - Credentials <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                      <li>Nhấn <strong>Create Credentials</strong> → chọn <strong>OAuth client ID</strong>.</li>
                      <li>Mục <em>Application type</em> chọn: <strong>Web application</strong>.</li>
                      <li>Tại phần <strong>Authorized redirect URIs</strong>, nhấn <em>Add URI</em> rồi dán link chuyển hướng phía trên.</li>
                      <li>Nhấn <strong>Create</strong>, sau đó sao chép <strong>Client ID</strong> và <strong>Client Secret</strong> dán vào 2 ô bên trên và nhấn <strong>Lưu cấu hình</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

                {/* TAB 5: ROTATION LOGS */}
        {activeTab === 'logs' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nhật ký luân chuyển Key & Sự kiện Cooldown ({logs.length})</h3>
                <p className="text-xs text-slate-500">Ghi lại toàn bộ lịch sử xoay key tự động khi xảy ra Rate-limit hoặc chuyển đổi dự phòng.</p>
              </div>
              <button
                type="button"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Tải lại log</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Chưa có sự kiện luân chuyển nào được ghi nhận.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5">Thời gian</th>
                      <th className="py-2.5 px-3.5">Sự kiện</th>
                      <th className="py-2.5 px-3.5">Lý do</th>
                      <th className="py-2.5 px-3.5">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                    {logs.map((lg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                          {formatTime(lg.timestamp)}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                          {lg.event}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600">
                          {lg.message}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 text-[11px] font-mono">
                          {lg.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADD API KEY USING PORTAL */}
        {showAddModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 flex flex-col animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  {addMode === 'single' 
                    ? `Thêm ${keyPoolTab === 'cohere' ? 'Cohere AI' : (keyPoolTab === 'groq' ? 'Groq Cloud' : 'Google Gemini')} API Key Mới`
                    : `Dán danh sách ${keyPoolTab === 'cohere' ? 'Cohere' : (keyPoolTab === 'groq' ? 'Groq' : 'Gemini')} API Key Hàng loạt`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addMode === 'single' ? (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Tên gợi nhớ (Tùy chọn)</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={keyPoolTab === 'cohere' ? 'Ví dụ: Cohere Key 01 (Trial)' : (keyPoolTab === 'groq' ? 'Ví dụ: Groq Key 01 (LPU)' : 'Ví dụ: Gemini Key 02 (Account Dev)')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      {keyPoolTab === 'cohere' ? 'Cohere API Key (Trial) *' : (keyPoolTab === 'groq' ? 'Groq API Key (bắt đầu bằng gsk_...) *' : 'Google Gemini API Key *')}
                    </label>
                    <input
                      type="password"
                      value={newKeyStr}
                      onChange={(e) => setNewKeyStr(e.target.value)}
                      placeholder={keyPoolTab === 'cohere' ? 'Nhập Cohere API Key...' : (keyPoolTab === 'groq' ? 'gsk_...' : 'AIzaSy...')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestUnsavedKey}
                      disabled={testingNewKey || !newKeyStr.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {testingNewKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-slate-500" />}
                      <span>Kiểm tra Key trước khi lưu</span>
                    </button>
                  </div>

                  {newKeyTestResult && (
                    <div className={`p-2.5 rounded-lg text-xs font-medium ${
                      newKeyTestResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}>
                      {newKeyTestResult.success
                        ? `✓ API Key hợp lệ và hoạt động tốt (${newKeyTestResult.latency_ms}ms)`
                        : `✕ Lỗi: ${newKeyTestResult.message}`}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Danh sách API Key (Mỗi dòng 1 key)</label>
                  <textarea
                    rows={6}
                    value={batchKeysStr}
                    onChange={(e) => setBatchKeysStr(e.target.value)}
                    placeholder={keyPoolTab === 'cohere' ? 'CohereKey1...\nCohereKey2...' : (keyPoolTab === 'groq' ? 'gsk_Key1...\ngsk_Key2...' : 'AIzaSyKey1...\nAIzaSyKey2...')}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400">Các dòng trống hoặc key trùng lặp sẽ tự động được bỏ qua.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddKey}
                  disabled={addMode === 'single' ? !newKeyStr.trim() : !batchKeysStr.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Xác nhận thêm vào Pool</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </Layout>
  );
};

export default SettingsPage;
