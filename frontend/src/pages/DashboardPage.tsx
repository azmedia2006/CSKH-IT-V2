import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { ticketApi } from '../services/ticketApi';
import { 
  AlertCircle, Clock, Ticket as TicketIcon, 
  Sparkles, Plus, ArrowRight, BarChart3, 
  PieChart as PieChartIcon, ShieldAlert, TrendingUp,
  Activity, ArrowUpRight, Download, CheckCircle
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Badge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: 'default' | 'warning' | 'success' | 'danger' | 'info', className?: string }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const SLACountdown = ({ dueDate, status }: { dueDate: string, status: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [statusColor, setStatusColor] = useState<'success' | 'warning' | 'danger'>('success');

  useEffect(() => {
    if (!dueDate || status === 'RESOLVED' || status === 'CLOSED') {
      setTimeLeft('Đã xong');
      setStatusColor('success');
      return;
    }

    const calculate = () => {
      const now = new Date().getTime();
      const due = new Date(dueDate).getTime();
      const diff = due - now;

      if (diff < 0) {
        setTimeLeft('Trễ hạn');
        setStatusColor('danger');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours < 2) setStatusColor('warning');
      else setStatusColor('success');

      setTimeLeft(`${hours}h ${mins}m`);
    };

    calculate();
    const timer = setInterval(calculate, 60000);
    return () => clearInterval(timer);
  }, [dueDate, status]);

  if (timeLeft === 'Đã xong') return <Badge variant="success">Hoàn thành</Badge>;
  if (timeLeft === 'Trễ hạn') return <Badge variant="danger" className="animate-pulse flex gap-1"><AlertCircle className="w-3 h-3"/> Trễ hạn</Badge>;

  return <Badge variant={statusColor} className="flex gap-1"><Clock className="w-3 h-3"/> {timeLeft}</Badge>;
};

const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#64748b', '#ec4899'];

export const DashboardPage = () => {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    staleTime: 5 * 60 * 1000
  });

  const { data: kpi } = useQuery({
    queryKey: ['dashboardKpi'],
    queryFn: ticketApi.getKpi,
    enabled: currentUser?.role_name !== 'REQUESTER'
  });

  const { data: chartData } = useQuery({
    queryKey: ['dashboardChartData'],
    queryFn: ticketApi.getChartData,
    enabled: currentUser?.role_name !== 'REQUESTER'
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketApi.getTickets(),
    enabled: currentUser?.role_name !== 'REQUESTER'
  });

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

  if (currentUser?.role_name === 'REQUESTER') {
    return <Navigate to="/tickets" replace />;
  }

  const statusLabelMap: Record<string, { label: string; color: string }> = {
    NEW: { label: 'Chờ xử lý', color: '#4f46e5' },
    PROCESSING: { label: 'Đang xử lý', color: '#f59e0b' },
    WAITING_CUSTOMER: { label: 'Chờ khách hàng', color: '#8b5cf6' },
    RESOLVED: { label: 'Đã giải quyết', color: '#10b981' },
    CLOSED: { label: 'Đã đóng', color: '#64748b' },
    CANCELLED: { label: 'Đã hủy', color: '#ef4444' }
  };

  const statusPieData = (chartData?.status_distribution || []).map((item: any) => {
    const meta = statusLabelMap[item.name] || { label: item.name, color: '#64748b' };
    return {
      name: meta.label,
      value: item.value,
      color: meta.color
    };
  });

  const priorityLabelMap: Record<string, string> = {
    P1: 'Khẩn cấp',
    P2: 'Cao',
    P3: 'Trung bình',
    P4: 'Thấp'
  };

  const priorityBarData = (chartData?.priority_distribution || []).map((item: any) => ({
    name: priorityLabelMap[item.name] || item.name,
    rawName: item.name,
    value: item.value
  }));

  const urgentTickets = tickets
    .filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED')
    .slice(0, 4);

  const { data: liveAiActivities } = useQuery({
    queryKey: ['dashboard-ai-activities'],
    queryFn: () => ticketApi.getAiActivities(),
    refetchInterval: 20000,
  });

  const aiActivities = (liveAiActivities && Array.isArray(liveAiActivities)) ? liveAiActivities : [];

  return (
    <Layout>
      <div className="space-y-6 p-6 md:p-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Tổng quan Phân tích & SLA
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Xuất báo cáo chi tiết ra Excel (CSV UTF-8)"
            >
              <Download className={`w-3.5 h-3.5 text-indigo-600 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            <Link 
              to="/tickets" 
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span>Quản lý Tickets</span>
            </Link>
          </div>
        </div>

        {/* 4 KPI Cards - Harmonious and Balanced */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tổng số Ticket</h3>
              <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <TicketIcon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-bold text-slate-900">{kpi?.total_tickets || 0}</div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-normal">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Tự động đồng bộ DB
              </p>
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Đang mở / Xử lý</h3>
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-bold text-slate-900">{kpi?.open_tickets || 0}</div>
              <p className="text-xs text-slate-500 mt-1 font-normal">Cần hoàn thành trong ngày</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vi phạm SLA</h3>
              <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertCircle className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-bold text-slate-900">{kpi?.sla_breached || 0}</div>
              <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Ưu tiên xử lý khẩn cấp
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI đã can thiệp</h3>
              <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-bold text-slate-900">{kpi?.ai_handled || 0}</div>
              <p className="text-xs text-slate-500 mt-1 font-normal">Độ tự tin trung bình 90%</p>
            </div>
          </div>
        </div>


        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Priority Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><BarChart3 className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Khối lượng theo Mức ưu tiên</h3>
                  <p className="text-xs text-slate-500">Phân loại dựa trên độ khẩn cấp & tác động</p>
                </div>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(241,245,249,0.5)'}}
                    formatter={(value: any, _: any, item: any) => [
                      `${value} tickets`, 
                      item.payload.name
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Donut Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><PieChartIcon className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tỷ lệ theo Trạng thái xử lý</h3>
                  <p className="text-xs text-slate-500">Tiến độ giải quyết các yêu cầu</p>
                </div>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '12px' }}
                    formatter={(value: any, name: any) => [`${value} tickets`, name]}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Split: Urgent SLA Watchlist & AI Engine Live Stream */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Urgent Tickets Watchlist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900">Ticket Cần Xử Lý Ngay</h3>
                </div>
                <Link to="/tickets" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  Xem tất cả <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5">
                {urgentTickets.map((t) => (
                  <Link 
                    key={t.id} 
                    to={`/tickets/${t.id}`}
                    className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/60 hover:border-slate-300 hover:bg-slate-100/60 flex items-center justify-between transition-colors group block"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{t.ticket_code}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          t.priority === 'P1' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                          t.priority === 'P2' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {t.priority === 'P1' ? 'Khẩn cấp' : t.priority === 'P2' ? 'Cao' : t.priority === 'P3' ? 'Trung bình' : t.priority === 'P4' ? 'Thấp' : t.priority}
                        </span>
                      </div>
                      <p className="font-medium text-slate-800 text-xs truncate mt-1 group-hover:text-indigo-600 transition-colors">
                        {t.title}
                      </p>
                    </div>
                    <SLACountdown dueDate={t.resolution_due_at || ''} status={t.status} />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* AI Engine Live Insights Stream */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Hoạt động AI Engine</h3>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live
              </span>
            </div>

            <div className="space-y-2.5">
              {aiActivities.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                  Chưa ghi nhận hoạt động AI nào trong hệ thống.
                </div>
              ) : (
                aiActivities.map((act: any) => (
                  <div key={act.id} className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/60 flex items-start gap-3">
                    <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900">{act.action}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{act.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 font-normal">
                        Gắn nhãn <span className="font-medium text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">[{act.category}]</span> cho ticket <span className="font-mono text-purple-700 font-semibold">{act.ticket}</span>
                      </p>
                      <div className="flex items-center gap-2.5 mt-1.5 text-[10px]">
                        <span className="text-emerald-700 font-semibold">Độ tự tin: {act.confidence}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-normal">Mức ưu tiên: {act.priority === 'P1' ? 'Khẩn cấp' : act.priority === 'P2' ? 'Cao' : act.priority === 'P3' ? 'Trung bình' : act.priority === 'P4' ? 'Thấp' : act.priority}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
