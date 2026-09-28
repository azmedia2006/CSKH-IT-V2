import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { FullScreenLoader } from '../components/FullScreenLoader';
import { ticketApi } from '../services/ticketApi';
import { authApi } from '../services/authApi';
import { 
  AlertCircle, Clock, Plus, RefreshCw, LayoutGrid, ListFilter,
  User, Tag, CheckCircle2, Sparkles, Search, ArrowRight,
  Inbox, AlertTriangle, ShieldCheck, CheckSquare, Layers, Copy, Check, Trash2,
  Download, FileSpreadsheet, Bot
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SLACountdown = ({ dueDate, status }: { dueDate?: string; status: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'warning' | 'danger'>('success');

  useEffect(() => {
    if (!dueDate || status === 'RESOLVED' || status === 'CLOSED') {
      setTimeLeft('Đã giải quyết');
      setStatusType('success');
      return;
    }

    const calculate = () => {
      const now = new Date().getTime();
      const due = new Date(dueDate).getTime();
      const diff = due - now;

      if (diff < 0) {
        setTimeLeft('Quá hạn SLA');
        setStatusType('danger');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours < 2) setStatusType('warning');
      else setStatusType('success');

      setTimeLeft(`Còn ${hours}h ${mins}m`);
    };

    calculate();
    const timer = setInterval(calculate, 60000);
    return () => clearInterval(timer);
  }, [dueDate, status]);

  if (timeLeft === 'Đã giải quyết') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap">
        <Check className="w-3 h-3 text-emerald-600" />
        <span>Hoàn thành</span>
      </span>
    );
  }

  if (timeLeft === 'Quá hạn SLA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs whitespace-nowrap">
        <AlertCircle className="w-3 h-3 text-rose-600 animate-pulse" />
        <span>Quá hạn</span>
      </span>
    );
  }

  if (statusType === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs whitespace-nowrap font-mono">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>{timeLeft}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs whitespace-nowrap font-mono">
      <Clock className="w-3 h-3 text-slate-400" />
      <span>{timeLeft}</span>
    </span>
  );
};

export const TicketsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW' | 'PROCESSING' | 'BREACHED' | 'RESOLVED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [escalationFilter, setEscalationFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await ticketApi.exportReport();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bao_cao_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Xuất báo cáo thất bại.');
    } finally {
      setIsExporting(false);
    }
  };

  const cachedRole = localStorage.getItem('user_role');
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const u = await authApi.getCurrentUser();
      if (u?.role_name) {
        localStorage.setItem('user_role', u.role_name);
      }
      return u;
    },
    staleTime: 5 * 60 * 1000
  });

  const userRole = currentUser?.role_name || cachedRole || 'REQUESTER';
  const isRequester = userRole === 'REQUESTER';
  const isAdmin = userRole === 'ADMIN';
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => ticketApi.deleteTicket(ticketId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      alert(data?.message || 'Đã xóa ticket thành công!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Xóa ticket thất bại.');
    },
    onSettled: () => {
      setDeletingId(null);
    }
  });

  const handleDeleteTicket = (ticketId: string, ticketCode: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ticket [${ticketCode}] không?\nThao tác này không thể hoàn tác!`)) {
      setDeletingId(ticketId);
      deleteMutation.mutate(ticketId);
    }
  };

  const { data: tickets = [], refetch, isFetching, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketApi.getTickets(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true
  });

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.ticket_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.category_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesTab = true;
    if (activeTab === 'NEW') matchesTab = t.status === 'NEW';
    else if (activeTab === 'PROCESSING') matchesTab = t.status === 'PROCESSING';
    else if (activeTab === 'RESOLVED') matchesTab = t.status === 'RESOLVED' || t.status === 'CLOSED';
    else if (activeTab === 'BREACHED') matchesTab = Boolean(t.is_escalated);

    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'ALL' || getCategoryLabel(t) === categoryFilter;
    const matchesLevel = levelFilter === 'ALL' || (t.support_level || 'L1') === levelFilter;
    const matchesRisk = riskFilter === 'ALL' || (t.risk_flag || 'NORMAL') === riskFilter;
    const matchesEscalation = escalationFilter === 'ALL' || 
      (escalationFilter === 'ESCALATED' ? Boolean(t.is_escalated) : (t.escalation_status || 'NONE') === escalationFilter);

    return matchesSearch && matchesTab && matchesPriority && matchesCategory && matchesLevel && matchesRisk && matchesEscalation;
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Chờ nhân viên xử lý</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Đang xử lý</span>
          </span>
        );
      case 'WAITING_CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Chờ khách hàng phản hồi</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Đã giải quyết</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Đã đóng</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case 'P1':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs whitespace-nowrap">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Khẩn cấp</span>
          </span>
        );
      case 'P2':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Cao</span>
          </span>
        );
      case 'P3':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Trung bình</span>
          </span>
        );
      case 'P4':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Thấp</span>
          </span>
        );
      default:
        return <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{priority}</span>;
    }
  };

  const getSupportLevelBadge = (level?: string) => {
    const isL2 = level === 'L2';
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border shadow-2xs whitespace-nowrap ${
        isL2 
          ? 'bg-purple-100 text-purple-800 border-purple-300' 
          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
      }`}>
        {isL2 ? 'L2' : 'L1'}
      </span>
    );
  };

  const getRiskAndEscalationBadges = (ticket: any) => {
    const hasBadges = ticket.escalation_status === 'AUTO_ESCALATED' || 
                      ticket.escalation_status === 'L2_WAITING' || 
                      ticket.risk_flag === 'HIGH' || 
                      ticket.risk_flag === 'CHECK_REQUIRED';

    if (!hasBadges) return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {/* AI Auto Escalated badge */}
        {ticket.escalation_status === 'AUTO_ESCALATED' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-600 text-white shadow-2xs whitespace-nowrap" title={`AI tự động chuyển cấp do sentiment tiêu cực (${Math.round((ticket.sentiment_score || 0) * 100)}% độ tin cậy)`}>
            <Bot className="w-3 h-3 text-purple-200" />
            <span>AI tự động chuyển cấp</span>
          </span>
        )}

        {/* L2 Waiting badge */}
        {ticket.escalation_status === 'L2_WAITING' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-2xs whitespace-nowrap" title="Đang chờ có Support Agent L2 hoạt động">
            <Clock className="w-2.5 h-2.5 text-white" />
            <span>Hàng chờ L2</span>
          </span>
        )}

        {/* High Risk Flag */}
        {ticket.risk_flag === 'HIGH' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap" title={`Cờ rủi ro HIGH: ${ticket.sentiment_reason || 'Cảm xúc tiêu cực'}`}>
            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
            <span>Rủi ro HIGH</span>
          </span>
        )}

        {/* Check Required */}
        {ticket.risk_flag === 'CHECK_REQUIRED' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs whitespace-nowrap" title="Cần kiểm tra sentiment: Độ tin cậy AI chưa đạt ngưỡng">
            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
            <span>Cần kiểm tra sentiment</span>
          </span>
        )}
      </div>
    );
  };

  const getCategoryLabel = (ticket: any) => {
    if (ticket.category_name) return ticket.category_name;
    
    const raw = ticket.category_id;
    if (raw && !raw.includes('-') && raw.length < 30) {
      return raw;
    }
    
    // Intelligent mapping from ticket title/content
    const text = `${ticket.title || ''} ${ticket.description || ''}`.toLowerCase();
    if (text.includes('máy in') || text.includes('driver')) return 'Thiết bị & Máy in';
    if (text.includes('quyền') || text.includes('thư mục') || text.includes('mkt') || text.includes('truy cập')) return 'Cấp quyền & Tài nguyên';
    if (text.includes('crm') || text.includes('đăng nhập') || text.includes('mật khẩu') || text.includes('tài khoản')) return 'Tài khoản & Xác thực';
    if (text.includes('kế toán') || text.includes('báo cáo') || text.includes('phần mềm') || text.includes('excel') || text.includes('bug')) return 'Bug Phần mềm';
    if (text.includes('mạng') || text.includes('wifi') || text.includes('vpn') || text.includes('internet')) return 'Hạ tầng Mạng';
    
    return 'Hướng dẫn Kỹ thuật';
  };

  // Extract unique categories for filter
  const categories = [
    'Tài khoản & Xác thực',
    'Bug Phần mềm',
    'Hạ tầng Mạng',
    'Cấp quyền & Tài nguyên',
    'Thiết bị & Máy in',
    'Hướng dẫn Kỹ thuật'
  ];

  return (
    <Layout>
      
      <div className="w-full p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isRequester ? 'Ticket của tôi' : 'Quản lý Ticket Hỗ trợ'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRequester 
                ? 'Theo dõi tiến độ, tình trạng xử lý và phản hồi các yêu cầu hỗ trợ của bạn.'
                : 'Trung tâm tiếp nhận, phân loại tự động bằng AI và điều phối xử lý ticket toàn hệ thống.'}
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>

            <button 
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Xuất danh sách ticket ra Excel (CSV UTF-8)"
            >
              <Download className={`w-3.5 h-3.5 text-indigo-600 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            {isRequester && (
              <Link 
                to="/tickets/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo Ticket Mới</span>
              </Link>
            )}
          </div>
        </div>

        {/* 4 Clean Metric Cards - ONLY FOR ADMIN / AGENT */}
        {!isRequester && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-medium text-slate-500">Tổng số Ticket</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{tickets.length}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Yêu cầu tiếp nhận</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-indigo-700">Chờ xử lý & Đang chờ</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              </div>
              <div className="text-2xl font-bold text-indigo-600">
                {tickets.filter(t => t.status === 'NEW').length}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Chưa được xử lý</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-700">Đang xử lý</span>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {tickets.filter(t => t.status === 'PROCESSING' || t.status === 'WAITING_CUSTOMER').length}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Agent đang hỗ trợ</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-rose-700">Cần ưu tiên / Trễ SLA</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-rose-600">
                {tickets.filter(t => t.is_escalated || t.priority === 'P1').length}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Cảnh báo vi phạm SLA</p>
            </div>
          </div>
        )}

        {/* Minimal Tab Navigation & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Tất cả ({tickets.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('NEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                activeTab === 'NEW'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Chờ xử lý ({tickets.filter(t => t.status === 'NEW').length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PROCESSING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                activeTab === 'PROCESSING'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Đang xử lý ({tickets.filter(t => t.status === 'PROCESSING').length})
            </button>

            {/* Chỉ Kỹ thuật viên / Quản trị viên mới cần tab cảnh báo Vi phạm SLA */}
            {!isRequester && (
              <button
                type="button"
                onClick={() => setActiveTab('BREACHED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                  activeTab === 'BREACHED'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                Vi phạm SLA ({tickets.filter(t => t.is_escalated).length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('RESOLVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                activeTab === 'RESOLVED'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Đã giải quyết ({tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length})
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Dạng bảng chi tiết"
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Dạng thẻ lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Tìm theo mã ticket, tiêu đề..." 
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Bộ lọc nội bộ IT (Chỉ hiển thị cho Kỹ thuật viên / Quản trị viên) */}
            {!isRequester && (
              <>
                {/* Cấp hỗ trợ (L1 / L2) */}
                <select 
                  className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  title="Lọc theo cấp hỗ trợ L1/L2"
                >
                  <option value="ALL">Tất cả cấp (L1/L2)</option>
                  <option value="L1">🟢 L1</option>
                  <option value="L2">🟣 L2</option>
                </select>

                {/* Cờ rủi ro (Risk Flag) */}
                <select 
                  className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  title="Lọc theo cờ rủi ro / sentiment"
                >
                  <option value="ALL">Tất cả rủi ro</option>
                  <option value="HIGH">🔴 Rủi ro cao (HIGH)</option>
                  <option value="CHECK_REQUIRED">🟡 Cần kiểm tra</option>
                  <option value="NORMAL">🟢 Bình thường</option>
                </select>

                {/* Trạng thái chuyển cấp (Escalation Status) */}
                <select 
                  className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
                  value={escalationFilter}
                  onChange={(e) => setEscalationFilter(e.target.value)}
                  title="Lọc theo trạng thái chuyển cấp"
                >
                  <option value="ALL">Tất cả trạng thái chuyển cấp</option>
                  <option value="AUTO_ESCALATED">🤖 AI tự động chuyển cấp</option>
                  <option value="L2_WAITING">⚠️ Hàng chờ L2 (Chưa có Agent)</option>
                  <option value="MANUAL_ESCALATED">👤 Thủ công chuyển cấp</option>
                  <option value="NONE">Chưa chuyển cấp</option>
                </select>
              </>
            )}

            <select 
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="ALL">Tất cả mức ưu tiên</option>
              <option value="P1">Khẩn cấp</option>
              <option value="P2">Cao</option>
              <option value="P3">Trung bình</option>
              <option value="P4">Thấp</option>
            </select>

            {categories.length > 0 && (
              <select 
                className="h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* View Mode: Table or Cards */}
        {viewMode === 'table' ? (
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-xs text-left border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200/90 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-[130px] whitespace-nowrap">Mã Ticket</th>
                    <th className="py-3.5 px-4 min-w-[240px]">Tiêu đề yêu cầu</th>
                    <th className="py-3.5 px-4 w-[170px] whitespace-nowrap">Danh mục</th>
                    <th className="py-3.5 px-4 w-[130px] whitespace-nowrap">Mức ưu tiên</th>
                    <th className="py-3.5 px-4 w-[180px] whitespace-nowrap">{isRequester ? 'Kỹ thuật viên hỗ trợ' : 'Phân công'}</th>
                    {!isRequester && (
                      <th className="py-3.5 px-4 w-[120px] whitespace-nowrap">Độ tự tin AI</th>
                    )}
                    <th className="py-3.5 px-4 w-[140px] whitespace-nowrap">Trạng thái</th>
                    <th className="py-3.5 px-4 w-[110px] whitespace-nowrap">{isRequester ? 'Thời gian gửi' : 'Thời gian'}</th>
                    <th className="py-3.5 px-4 w-[150px] whitespace-nowrap">{isRequester ? 'Thời hạn xử lý' : 'Hạn cam kết SLA'}</th>
                    <th className="sticky right-0 z-20 py-3.5 px-4 w-[150px] whitespace-nowrap text-right bg-slate-50/95 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.35)]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={isRequester ? 9 : 10} className="text-center py-12 text-slate-400">
                        <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-xs text-slate-700">Không tìm thấy ticket nào phù hợp!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-indigo-50/40 transition-colors group cursor-pointer">
                        {/* Ticket Code */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Link 
                              to={`/tickets/${t.id}`} 
                              className="font-mono font-bold text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-md border border-indigo-100 transition-all shadow-2xs"
                            >
                              {t.ticket_code}
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(e, t.ticket_code)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Sao chép mã ticket"
                            >
                              {copiedId === t.ticket_code ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-3.5 px-4 align-middle">
                          <Link 
                            to={`/tickets/${t.id}`} 
                            className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 block leading-snug"
                            title={t.title}
                          >
                            {t.title}
                          </Link>
                          {t.description && (
                            <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 block font-normal">
                              {t.description}
                            </span>
                          )}
                          {!isRequester && getRiskAndEscalationBadges(t)}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100/90 text-slate-700 border border-slate-200/80 shadow-2xs">
                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{getCategoryLabel(t)}</span>
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          {getPriorityBadge(t.priority)}
                        </td>

                        {/* Phân công & Cấp hỗ trợ L1/L2 */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5">
                              {!isRequester && getSupportLevelBadge(t.support_level)}
                              {t.assigned_agent_name ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-700 shadow-2xs max-w-[150px]">
                                  <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                                    {t.assigned_agent_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[11px] font-medium truncate">{t.assigned_agent_name}</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  <span>{isRequester ? 'Đang phân công' : 'Chưa phân công'}</span>
                                </span>
                              )}
                            </div>
                            {!isRequester && t.previous_agent_name && (
                              <span className="text-[10px] text-slate-400 italic">
                                Chuyển từ: {t.previous_agent_name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* AI Confidence - Chỉ Staff / Admin thấy */}
                        {!isRequester && (
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            {t.ai_confidence_score ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-purple-700 font-bold bg-purple-50 border border-purple-200/80 px-2.5 py-1 rounded-full shadow-2xs">
                                <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>AI {Math.round(t.ai_confidence_score * 100)}%</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono px-2 py-0.5">--</span>
                            )}
                          </td>
                        )}

                        {/* Status */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>

                        {/* Created Time */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <div className="flex flex-col text-[11px] leading-tight font-mono">
                            <span className="font-semibold text-slate-800">
                              {t.created_at ? new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}
                            </span>
                            <span className="text-slate-400 text-[10px] mt-0.5">
                              {t.created_at ? `${new Date(t.created_at).getDate()}/${new Date(t.created_at).getMonth() + 1}` : '--'}
                            </span>
                          </div>
                        </td>

                        {/* SLA Countdown */}
                        <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                          <SLACountdown dueDate={t.resolution_due_at} status={t.status} />
                        </td>

                        {/* Detail Action */}
                        <td className="sticky right-0 z-10 py-3.5 px-4 align-middle text-right whitespace-nowrap bg-white group-hover:bg-indigo-50/40 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.25)]">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Link
                              to={`/tickets/${t.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-600 hover:text-white border border-indigo-200/70 hover:border-indigo-600 transition-all shadow-2xs"
                            >
                              <span>Xử lý</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteTicket(t.id, t.ticket_code);
                                }}
                                disabled={deletingId === t.id}
                                title="Xóa ticket (Chỉ Quản trị viên)"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === t.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((t) => (
              <div 
                key={t.id} 
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between shadow-2xs group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {t.ticket_code}
                      </span>
                      {!isRequester && getSupportLevelBadge(t.support_level)}
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <Link 
                    to={`/tickets/${t.id}`} 
                    className="font-bold text-slate-900 group-hover:text-indigo-600 text-xs sm:text-sm line-clamp-2 transition-colors block"
                  >
                    {t.title}
                  </Link>

                  {!isRequester && getRiskAndEscalationBadges(t)}

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {t.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {getPriorityBadge(t.priority)}
                  </div>
                  <div className="flex items-center gap-2">
                    <SLACountdown dueDate={t.resolution_due_at} status={t.status} />
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteTicket(t.id, t.ticket_code);
                        }}
                        disabled={deletingId === t.id}
                        title="Xóa ticket (Chỉ Quản trị viên)"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TicketsPage;
