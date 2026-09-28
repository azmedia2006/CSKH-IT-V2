import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GitCommit,
  GitBranch,
  RefreshCw,
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Bug,
  FileText,
  Layers,
  Wrench,
  Calendar,
  Clock,
  Code2,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { commitsApi, CommitItem } from '../services/commitsApi';

const TYPE_CONFIG: Record<
  string,
  { label: string; badgeBg: string; badgeText: string; badgeBorder: string; dotBg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  feat: {
    label: 'Tính năng mới',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200/80',
    dotBg: 'bg-emerald-500 ring-emerald-100',
    icon: Sparkles
  },
  fix: {
    label: 'Sửa lỗi',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200/80',
    dotBg: 'bg-rose-500 ring-rose-100',
    icon: Bug
  },
  docs: {
    label: 'Tài liệu',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200/80',
    dotBg: 'bg-sky-500 ring-sky-100',
    icon: FileText
  },
  refactor: {
    label: 'Tối ưu & UI',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    badgeBorder: 'border-violet-200/80',
    dotBg: 'bg-violet-500 ring-violet-100',
    icon: Layers
  },
  style: {
    label: 'Giao diện',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200/80',
    dotBg: 'bg-indigo-500 ring-indigo-100',
    icon: Layers
  },
  chore: {
    label: 'Cấu hình',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    dotBg: 'bg-slate-400 ring-slate-100',
    icon: Wrench
  },
  other: {
    label: 'Cập nhật',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200/80',
    dotBg: 'bg-amber-500 ring-amber-100',
    icon: Code2
  }
};

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 30) return `${diffDays} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function formatDateHeader(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return 'Hôm nay';
    if (isYesterday) return 'Hôm qua';

    return `Ngày ${date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })}`;
  } catch {
    return 'Lịch sử phát triển';
  }
}

export const CommitsPage: React.FC = () => {
  const selectedRepo = 'azmedia2006/CSKH-IT-V2';
  const selectedBranch = 'main';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const {
    data: commitsData,
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ['commits', selectedRepo, selectedBranch],
    queryFn: () => commitsApi.getCommits(selectedRepo, selectedBranch),
    staleTime: 45 * 1000
  });

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const handleRefresh = async () => {
    await commitsApi.getCommits(selectedRepo, selectedBranch, true);
    await refetch();
  };

  const filteredCommits = useMemo(() => {
    if (!commitsData?.commits) return [];
    return commitsData.commits.filter((c) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.full_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.short_sha.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.author_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType =
        filterType === 'all' ||
        (filterType === 'feat' && c.type === 'feat') ||
        (filterType === 'fix' && c.type === 'fix') ||
        (filterType === 'docs' && c.type === 'docs') ||
        (filterType === 'refactor' && (c.type === 'refactor' || c.type === 'style')) ||
        (filterType === 'chore' && (c.type === 'chore' || c.type === 'build' || c.type === 'other'));

      return matchSearch && matchType;
    });
  }, [commitsData, searchQuery, filterType]);

  const groupedCommits = useMemo(() => {
    const groups: { [key: string]: CommitItem[] } = {};
    filteredCommits.forEach((commit) => {
      const dateKey = commit.date ? commit.date.substring(0, 10) : 'unknown';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(commit);
    });
    return groups;
  }, [filteredCommits]);

  const stats = useMemo(() => {
    const list = commitsData?.commits || [];
    const featCount = list.filter((c) => c.type === 'feat').length;
    const fixCount = list.filter((c) => c.type === 'fix').length;
    const refactorCount = list.filter((c) => c.type === 'refactor' || c.type === 'style').length;
    return {
      total: list.length,
      feat: featCount,
      fix: fixCount,
      refactor: refactorCount
    };
  }, [commitsData]);

  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={hasToken ? '/dashboard' : '/'}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100/80 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>{hasToken ? 'Về Dashboard' : 'Về Trang chủ'}</span>
            </Link>

            <span className="text-slate-300">/</span>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xs">
                <GitCommit className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-800 text-sm">Lộ Trình & Commits</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer disabled:opacity-60"
              title="Đồng bộ lại commit mới nhất từ GitHub"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ</span>
            </button>

            <a
              href={`https://github.com/${selectedRepo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Elegant Clean Header Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>GitHub Synchronized (Live)</span>
                <span className="text-emerald-400">•</span>
                <span className="font-mono text-[11px] text-emerald-800">azmedia2006/CSKH-IT</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Lộ Trình & Bản Cập Nhật Hệ Thống
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl">
                Nhật ký phát triển, tính năng mới và các bản vá lỗi được đồng bộ tự động từ kho mã nguồn chính thức.
              </p>
            </div>

            {/* Quick Metrics Capsules */}
            <div className="flex items-center gap-2 shrink-0 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
              <div className="px-3.5 py-1.5 text-center">
                <div className="text-lg font-bold text-slate-900 font-mono leading-none">{stats.total}</div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Commits</div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="px-3.5 py-1.5 text-center">
                <div className="text-lg font-bold text-emerald-600 font-mono leading-none">{stats.feat}</div>
                <div className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider mt-1">Features</div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="px-3.5 py-1.5 text-center">
                <div className="text-lg font-bold text-rose-600 font-mono leading-none">{stats.fix}</div>
                <div className="text-[10px] text-rose-700 font-semibold uppercase tracking-wider mt-1">Fixes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo từ khóa commit, mã SHA, tác giả..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Branch pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 shrink-0">
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-400">nhánh:</span>
              <span className="text-indigo-700 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                {selectedBranch}
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">Phân loại:</span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'feat', label: '✨ Tính năng mới' },
              { id: 'fix', label: '🐛 Sửa lỗi' },
              { id: 'refactor', label: '🎨 Tối ưu & UI' },
              { id: 'docs', label: '📚 Tài liệu' },
              { id: 'chore', label: '⚙️ Cấu hình' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  filterType === t.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Content */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3 shadow-xs">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Đang đồng bộ commit từ GitHub...</p>
          </div>
        ) : filteredCommits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3 shadow-xs">
            <p className="text-sm font-medium text-slate-500">Không tìm thấy bản cập nhật phù hợp.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Hiện tất cả commit
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedCommits).map(([dateKey, commitsInGroup]) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Header Pill */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{formatDateHeader(dateKey)}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 font-mono text-[11px] font-normal">{commitsInGroup.length} commit</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Timeline Cards */}
                <div className="relative pl-6 sm:pl-8 space-y-3.5 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {commitsInGroup.map((c) => {
                    const typeConfig = TYPE_CONFIG[c.type] || TYPE_CONFIG.other;
                    const IconComp = typeConfig.icon;

                    return (
                      <div key={c.sha} className="relative group">
                        {/* Connecting Dot */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-4.5 w-3 h-3 rounded-full ${typeConfig.dotBg} ring-4 transition-transform group-hover:scale-125 shadow-xs`}
                        />

                        {/* Clean Commit Box */}
                        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              {/* Tag row */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${typeConfig.badgeBg} ${typeConfig.badgeText} ${typeConfig.badgeBorder}`}
                                >
                                  <IconComp className="w-3 h-3" />
                                  <span>{typeConfig.label}</span>
                                </span>

                                {c.scope && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                                    {c.scope}
                                  </span>
                                )}

                                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 font-sans">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{formatRelativeTime(c.date)}</span>
                                </span>
                              </div>

                              {/* Title */}
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                                {c.title}
                              </h4>

                              {/* Message body if any */}
                              {c.full_message && c.full_message.trim() !== c.title && (
                                <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-line font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                                  {c.full_message.replace(c.title, '').trim()}
                                </p>
                              )}
                            </div>

                            {/* Author & SHA actions */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              <div className="flex items-center gap-2">
                                {c.author_avatar ? (
                                  <img
                                    src={c.author_avatar}
                                    alt={c.author_name}
                                    className="w-5 h-5 rounded-full object-cover border border-slate-200"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center border border-slate-200">
                                    {c.author_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleCopySha(c.sha)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200"
                                  title="Copy SHA"
                                >
                                  {copiedSha === c.sha ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Đã chép</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-slate-400" />
                                      <span>{c.short_sha}</span>
                                    </>
                                  )}
                                </button>

                                <a
                                  href={c.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                  title="Xem trên GitHub"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nguồn chính thức: <span className="font-mono font-semibold text-slate-700">{selectedRepo}</span></span>
          </div>
          <div>
            <span>Đồng bộ lúc: {commitsData?.synced_at ? new Date(commitsData.synced_at).toLocaleTimeString('vi-VN') : 'Đang cập nhật'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CommitsPage;
