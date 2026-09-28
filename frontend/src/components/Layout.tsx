import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, Ticket as TicketIcon, Users, Settings, Globe, 
  Bell, Search, Menu, LogOut, Plus, AlertCircle, CheckCircle2,
  X, BookOpen, User as UserIcon, ChevronDown, PanelLeftClose, PanelLeftOpen,
  HelpCircle, CheckCheck
} from 'lucide-react';
import { authApi } from '../services/authApi';
import { notificationApi } from '../services/knowledgeApi';
import { FloatingChatWidget } from './FloatingChatWidget';
import { FullScreenLoader } from './FullScreenLoader';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userAvatar, setUserAvatar] = useState('/avatar/01.jpg');
  const [globalSearch, setGlobalSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('user_avatar');
    if (saved) setUserAvatar(saved);

    const onAvatarChanged = () => {
      const updated = localStorage.getItem('user_avatar');
      if (updated) setUserAvatar(updated);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('avatarChanged', onAvatarChanged);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('avatarChanged', onAvatarChanged);
    };
  }, []);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    navigate(`/tickets?search=${encodeURIComponent(globalSearch.trim())}`);
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
    staleTime: 5 * 60 * 1000,
  });

  const userRole = currentUser?.role_name || cachedRole || 'REQUESTER';
  const isRequester = userRole === 'REQUESTER';
  const isAdmin = userRole === 'ADMIN';

  const navItems = isRequester
    ? [
        { path: '/tickets', label: 'Ticket của tôi', icon: TicketIcon },
        { path: '/tickets/new', label: 'Gửi yêu cầu hỗ trợ', icon: Plus },
        { path: '/knowledge', label: 'Kho tri thức', icon: BookOpen },
        { path: '/faq', label: 'Hỏi đáp & FAQ', icon: HelpCircle },
      ]
    : [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/tickets', label: 'Quản lý Tickets', icon: TicketIcon },
        ...(isAdmin ? [{ path: '/customers', label: 'Quản lý Khách hàng', icon: Users }] : []),
        { path: '/knowledge', label: 'Kho tri thức', icon: BookOpen },
        { path: '/faq', label: 'Hỏi đáp & FAQ', icon: HelpCircle },
        ...(isAdmin ? [{ path: '/settings', label: 'Cài đặt AI & SLA', icon: Settings }] : []),
      ];

  const userKey = currentUser?.id ? String(currentUser.id) : (currentUser?.email || 'default_user');

  // Quản lý các thông báo đã đọc theo user trong localStorage
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`read_notif_ids_${userKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`read_notif_ids_${userKey}`);
      setReadNotifIds(saved ? JSON.parse(saved) : []);
    } catch {
      setReadNotifIds([]);
    }
  }, [userKey]);

  const { data: serverNotifications = [] } = useQuery({
    queryKey: ['userNotifications', userKey],
    queryFn: notificationApi.getNotifications,
    refetchInterval: 15000,
    enabled: !!currentUser,
  });

  const DEFAULT_NOTIFICATIONS = [
    {
      id: 'mock-1',
      title: 'Ticket sắp vi phạm SLA!',
      desc: 'Ticket TCK-1001 còn 1 giờ trước thời hạn giải quyết.',
      time: '10 phút trước',
      type: 'danger',
      link: '/tickets'
    },
    {
      id: 'mock-2',
      title: 'Phân loại tự động thành công',
      desc: 'Ticket TCK-1004 đã được phân loại vào nhóm Mạng & VPN (92% tự tin).',
      time: '25 phút trước',
      type: 'info',
      link: '/tickets'
    }
  ];

  const notificationsList = serverNotifications.length > 0 ? serverNotifications : DEFAULT_NOTIFICATIONS;
  const unreadList = notificationsList.filter(n => !readNotifIds.includes(String(n.id)));
  const unreadCount = unreadList.length;

  const markAsRead = (id: string | number) => {
    const idStr = String(id);
    if (!readNotifIds.includes(idStr)) {
      const next = [...readNotifIds, idStr];
      setReadNotifIds(next);
      localStorage.setItem(`read_notif_ids_${userKey}`, JSON.stringify(next));
    }
  };

  const markAllAsRead = () => {
    const allIds = notificationsList.map(n => String(n.id));
    setReadNotifIds(allIds);
    localStorage.setItem(`read_notif_ids_${userKey}`, JSON.stringify(allIds));
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">Admin</span>;
      case 'TEAM_LEAD':
        return <span className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">Team Lead</span>;
      case 'SUPPORT_AGENT':
        return <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">IT Agent</span>;
      case 'REQUESTER':
        return <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Khách hàng</span>;
      default:
        return <span className="inline-flex items-center text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Thành viên</span>;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isNavItemActive = (itemPath: string) => {
    const currentPath = location.pathname;
    if (itemPath.includes('?')) {
      return (location.pathname + location.search) === itemPath;
    }
    if (itemPath === '/settings') {
      return currentPath === '/settings' && !location.search.includes('tab=google');
    }
    if (itemPath === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    if (itemPath === '/tickets/new') {
      return currentPath === '/tickets/new';
    }
    if (itemPath === '/tickets') {
      return currentPath === '/tickets' || (currentPath.startsWith('/tickets/') && currentPath !== '/tickets/new');
    }
    return currentPath === itemPath || (itemPath !== '/' && currentPath.startsWith(itemPath + '/'));
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white p-4 shadow-xl z-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <img src="/avatar/AI_support.svg" alt="ServiceDesk Logo" className="h-7 w-7 object-contain" />
                  <span className="font-bold text-slate-900">ServiceDesk</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="py-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item.path);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80 shadow-2xs' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } border-r border-slate-200 bg-white hidden md:flex flex-col relative z-10 justify-between transition-all duration-300 ease-in-out shrink-0`}
      >
        <div>
          {/* Sidebar Top Brand Header */}
          <div className={`h-16 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5'} border-b border-slate-100 transition-all`}>
            <Link to={isRequester ? "/tickets" : "/dashboard"} className="flex items-center gap-2.5 group overflow-hidden">
              <img 
                src="/avatar/AI_support.svg" 
                alt="AI Support" 
                className="h-8 w-8 rounded-lg object-contain shrink-0 group-hover:scale-105 transition-transform" 
              />
              {!sidebarCollapsed && (
                <span className="font-bold text-base tracking-tight text-slate-900 whitespace-nowrap animate-in fade-in duration-200">
                  ServiceDesk
                </span>
              )}
            </Link>

            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Thu gọn thanh bên"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Navigation Items */}
          <nav className={`overflow-y-auto py-4 ${sidebarCollapsed ? 'px-2' : 'px-3'} space-y-1`}>
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.path);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all text-sm font-medium ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80 shadow-2xs' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} />
                  {!sidebarCollapsed && (
                    <span className="whitespace-nowrap truncate animate-in fade-in duration-200">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Collapsed Expand Toggle Button at Bottom */}
        {sidebarCollapsed && (
          <div className="p-3 border-t border-slate-100 flex justify-center">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
              title="Mở rộng thanh bên"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-200/80 bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shadow-xs">
          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          
          {/* Spacious & Beautiful Global Search Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-xl lg:max-w-2xl mx-4">
            <form onSubmit={handleGlobalSearchSubmit} className="relative w-full group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Search className="h-4 w-4" />
              </div>
              <input 
                ref={searchInputRef}
                type="text" 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Tìm kiếm nhanh ticket, khách hàng, nội dung hỗ trợ..." 
                className="w-full bg-slate-50/90 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 focus:border-indigo-500 rounded-xl h-10 pl-10 pr-10 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 shadow-2xs transition-all font-normal"
              />
              {globalSearch && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                  <button 
                    type="button" 
                    onClick={() => setGlobalSearch('')}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Thông báo"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-1.5 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-indigo-600" /> Thông báo
                      </h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded-full border border-rose-100">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors cursor-pointer flex items-center gap-1"
                          title="Đánh dấu tất cả là đã đọc"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Đã đọc hết</span>
                        </button>
                      )}
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto mt-1">
                    {notificationsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Không có thông báo mới nào
                      </div>
                    ) : (
                      notificationsList.map((n) => {
                        const isRead = readNotifIds.includes(String(n.id));
                        return (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              markAsRead(n.id);
                              if (n.link) {
                                setShowNotifications(false);
                                navigate(n.link);
                              }
                            }}
                            className={`py-2.5 px-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                              isRead 
                                ? 'opacity-75 hover:opacity-100 hover:bg-slate-50' 
                                : 'bg-indigo-50/40 hover:bg-indigo-50/70 border border-indigo-100/50 my-1'
                            }`}
                          >
                            {n.type === 'danger' ? (
                              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            ) : n.type === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs ${isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                                  {n.title}
                                </p>
                                {!isRead && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.desc}</p>
                              <span className="text-[10px] text-slate-400 mt-1 block">{n.time}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-left"
              >
                <div className="shrink-0">
                  <img 
                    src={userAvatar} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                <div className="hidden lg:block leading-tight">
                  <div className="text-xs font-medium text-slate-800 truncate max-w-[140px]">
                    {currentUser?.full_name || 'Người dùng'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {currentUser?.email || 'admin@cskh.vn'}
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  showUserMenu ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Minimal Clean User Menu Popover */}
              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white shadow-lg p-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>Hồ sơ cá nhân</span>
                    </Link>

                    {!isRequester && (
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Cài đặt hệ thống</span>
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {children}
        </main>
      </div>

      {/* Global Floating Chat Bubble Widget (Chỉ hiển thị cho Khách hàng / User) */}
      {isRequester && <FloatingChatWidget />}
    </div>
  );
};

export default Layout;

