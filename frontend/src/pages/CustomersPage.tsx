import { formatErrorMessage } from '../utils/formatError';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { FullScreenLoader } from '../components/FullScreenLoader';
import { api } from '../services/api';
import { authApi } from '../services/authApi';
import { 
  Users, UserCheck, ShieldCheck, Mail, Building2, 
  Search, Plus, MoreVertical, Ticket as TicketIcon, CheckCircle2,
  Lock, Unlock, Key, Trash2, Edit3, X, Check, AlertCircle, Phone, RefreshCw,
  Layers, Wrench, RotateCcw, Filter
} from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  full_name: string | null;
  role_name?: string;
  is_active: boolean;
  department?: string;
  phone_number?: string;
  ticket_count?: number;
  support_level?: string | null; // 'L1' | 'L2' | null
  skill_group?: string | null;   // 'ACCOUNT_AUTH' | 'SOFTWARE_BUG' | 'NETWORK_INFRA' | 'ACCESS_RESOURCE' | 'TECH_GUIDE' | null
}

const SKILL_GROUPS: Record<string, { label: string; badge: string; dot: string }> = {
  ACCOUNT_AUTH: { label: 'Tài khoản & Xác thực', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  SOFTWARE_BUG: { label: 'Bug Phần mềm', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  NETWORK_INFRA: { label: 'Hạ tầng Mạng', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  ACCESS_RESOURCE: { label: 'Cấp quyền & Tài nguyên', badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  TECH_GUIDE: { label: 'Hướng dẫn Kỹ thuật', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
};

export const CustomersPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Menu popover state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number; placement: 'top' | 'bottom' } | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<UserItem | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [viewingRequesterId, setViewingRequesterId] = useState<string | null>(null);

  const { data: requesterProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['requester-profile', viewingRequesterId],
    queryFn: async () => {
      const res = await api.get(`/users/requesters/${viewingRequesterId}`);
      return res.data;
    },
    enabled: !!viewingRequesterId,
  });

  // Form states for Add User
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('User@123');
  const [newRole, setNewRole] = useState('REQUESTER');
  const [newDepartment, setNewDepartment] = useState('IT Support');
  const [newPhone, setNewPhone] = useState('');
  const [newSupportLevel, setNewSupportLevel] = useState('L1');
  const [newSkillGroup, setNewSkillGroup] = useState('ACCOUNT_AUTH');

  // Notice
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
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

  const userRole = currentUser?.role_name || cachedRole || '';
  if (userRole && userRole !== 'ADMIN') {
    return <Navigate to={userRole === 'REQUESTER' ? '/tickets' : '/dashboard'} replace />;
  }

  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    const handleAvatarChange = () => setAvatarVersion(v => v + 1);
    window.addEventListener('avatarChanged', handleAvatarChange);
    window.addEventListener('storage', handleAvatarChange);
    return () => {
      window.removeEventListener('avatarChanged', handleAvatarChange);
      window.removeEventListener('storage', handleAvatarChange);
    };
  }, []);

  const getUserAvatar = (user: UserItem, idx: number) => {
    const isCurrent = (currentUser && (user.id === currentUser.id || user.email === currentUser.email)) || user.email === 'admin@cskh.vn';
    if (isCurrent) {
      const saved = localStorage.getItem('user_avatar');
      if (saved) return saved;
    }
    const userCustom = localStorage.getItem(`user_avatar_${user.id}`);
    if (userCustom) return userCustom;

    const sum = (user.email || user.full_name || 'U').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const avatarIndex = (sum % 39) + 1;
    return `/avatar/${String(avatarIndex).padStart(2, '0')}.jpg`;
  };

  // Close 3-dot dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-action-menu') && !target.closest('.user-action-popover')) {
        setActiveMenuId(null);
        setMenuCoords(null);
      }
    };
    const handleClose = () => {
      setActiveMenuId(null);
      setMenuCoords(null);
    };
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, []);

  // Fetch Users directly from API
  const { data: users = [], isLoading, refetch } = useQuery<UserItem[]>({
    queryKey: ['usersList'],
    queryFn: async () => {
      const res = await api.get('/users/', { params: { limit: 200 } });
      return res.data;
    }
  });

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/users/', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setShowAddModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('User@123');
      setNewPhone('');
      showToast('Đã thêm người dùng mới thành công!');
    },
    onError: (err: any) => {
      showToast(formatErrorMessage(err, 'Thêm người dùng thất bại'), 'error');
    }
  });

  // Update User Mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.put(`/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setEditingUser(null);
      setResettingPasswordUser(null);
      setNewPasswordVal('');
      showToast('Cập nhật thông tin người dùng thành công!');
    },
    onError: (err: any) => {
      showToast(formatErrorMessage(err, 'Cập nhật thất bại'), 'error');
    }
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      showToast('Đã xóa người dùng khỏi hệ thống.');
    },
    onError: (err: any) => {
      showToast(formatErrorMessage(err, 'Xóa người dùng thất bại'), 'error');
    }
  });

  const handleToggleActive = (user: UserItem) => {
    setActiveMenuId(null);
    if (user.email === 'admin@cskh.vn') {
      alert('Đây là tài khoản Quản trị viên tổng (Super Admin), không thể khóa tài khoản này!');
      return;
    }
    const nextActive = !user.is_active;
    updateUserMutation.mutate(
      {
        id: user.id,
        payload: { is_active: nextActive }
      },
      {
        onSuccess: () => {
          showToast(nextActive ? 'Đã mở khóa tài khoản thành công!' : 'Đã tạm khóa tài khoản thành công!');
        }
      }
    );
  };

  const handleDeleteUser = (user: UserItem) => {
    setActiveMenuId(null);
    if (user.email === 'admin@cskh.vn') {
      alert('Đây là tài khoản Quản trị viên tổng (Super Admin), không thể xóa tài khoản này!');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${user.full_name || user.email}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'error');
      return;
    }
    createUserMutation.mutate({
      email: newEmail.trim(),
      password: newPassword.trim(),
      full_name: newFullName.trim(),
      role_name: newRole,
      department: newDepartment,
      phone_number: newPhone.trim() || undefined,
      is_active: true,
      support_level: newRole === 'SUPPORT_AGENT' ? newSupportLevel : null,
      skill_group: newRole === 'SUPPORT_AGENT' ? newSkillGroup : null
    });
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editingUser.email === 'admin@cskh.vn' && !editingUser.is_active) {
      alert('Đây là tài khoản Quản trị viên tổng (Super Admin), không thể khóa tài khoản này!');
      return;
    }
    updateUserMutation.mutate(
      {
        id: editingUser.id,
        payload: {
          full_name: editingUser.full_name,
          role_name: editingUser.role_name,
          department: editingUser.department,
          phone_number: editingUser.phone_number,
          is_active: editingUser.is_active,
          support_level: editingUser.role_name === 'SUPPORT_AGENT' ? (editingUser.support_level || 'L1') : null,
          skill_group: editingUser.role_name === 'SUPPORT_AGENT' ? (editingUser.skill_group || 'ACCOUNT_AUTH') : null
        }
      },
      {
        onSuccess: () => {
          setEditingUser(null);
          showToast('Cập nhật hồ sơ người dùng thành công!');
        }
      }
    );
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError(null);
    if (!resettingPasswordUser || !newPasswordVal.trim()) {
      setResetPasswordError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPasswordVal.trim().length < 6) {
      setResetPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    updateUserMutation.mutate(
      {
        id: resettingPasswordUser.id,
        payload: {
          new_password: newPasswordVal.trim()
        }
      },
      {
        onSuccess: () => {
          setResettingPasswordUser(null);
          setNewPasswordVal('');
          setResetPasswordError(null);
          showToast('Đổi mật khẩu tài khoản thành công!');
        },
        onError: (err: any) => {
          setResetPasswordError(formatErrorMessage(err, 'Đổi mật khẩu thất bại'));
        }
      }
    );
  };

  // Filter users based on state
  const filteredUsers = users.filter((u) => {
    const matchesSearch = (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'ALL' || (u.department && u.department.includes(departmentFilter));
    const matchesRole = roleFilter === 'ALL' || u.role_name === roleFilter;
    const matchesLevel = levelFilter === 'ALL' || 
                         (levelFilter === 'L1' && u.support_level === 'L1') ||
                         (levelFilter === 'L2' && u.support_level === 'L2') ||
                         (levelFilter === 'NONE' && !u.support_level);
    const matchesSkill = skillFilter === 'ALL' || u.skill_group === skillFilter;
    const matchesStatus = statusFilter === 'ALL' || 
                          (statusFilter === 'ACTIVE' && u.is_active) || 
                          (statusFilter === 'INACTIVE' && !u.is_active);
    return matchesSearch && matchesDept && matchesRole && matchesLevel && matchesSkill && matchesStatus;
  });

  const isFiltered = searchTerm !== '' || departmentFilter !== 'ALL' || roleFilter !== 'ALL' || 
                     levelFilter !== 'ALL' || skillFilter !== 'ALL' || statusFilter !== 'ALL';

  const resetAllFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('ALL');
    setRoleFilter('ALL');
    setLevelFilter('ALL');
    setSkillFilter('ALL');
    setStatusFilter('ALL');
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Admin</span>;
      case 'TEAM_LEAD':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Team Lead</span>;
      case 'SUPPORT_AGENT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Support Agent</span>;
      case 'REQUESTER':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Requester</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">User</span>;
    }
  };

  const getSupportLevelBadge = (level?: string | null) => {
    if (level === 'L1') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          L1
        </span>
      );
    }
    if (level === 'L2') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          L2
        </span>
      );
    }
    return <span className="text-slate-400 font-mono text-[11px]">—</span>;
  };

  const getSkillBadge = (skillGroup?: string | null) => {
    if (!skillGroup || !SKILL_GROUPS[skillGroup]) {
      return <span className="text-slate-400 font-mono text-[11px]">—</span>;
    }
    const s = SKILL_GROUPS[skillGroup];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${s.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
        {s.label}
      </span>
    );
  };

  const l1Count = users.filter(u => u.role_name === 'SUPPORT_AGENT' && u.support_level === 'L1').length;
  const l2Count = users.filter(u => u.role_name === 'SUPPORT_AGENT' && u.support_level === 'L2').length;
  const activeUser = users.find(u => u.id === activeMenuId) || null;

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Quản lý Khách hàng & Người dùng
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách tài khoản nội bộ, phân quyền vai trò, cấp hỗ trợ L1/L2 và quản lý trạng thái hoạt động.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Người dùng</span>
            </button>
          </div>
        </div>

        {/* Global Toast Notice */}
        {notice && (
          <div className={`fixed top-5 right-5 z-[100000] max-w-md p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-2 duration-150 ${
            notice.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2">
              {notice.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              <span>{notice.message}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium text-slate-500">Tổng Người dùng</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{users.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Tài khoản trong hệ thống</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-emerald-700">Đang hoạt động</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {users.filter(u => u.is_active).length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Sẵn sàng đăng nhập</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-indigo-700">Support Agent</span>
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-600">
                {users.filter(u => u.role_name === 'SUPPORT_AGENT').length}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({l1Count} L1 • {l2Count} L2)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">5 nhóm kỹ năng chuyên môn</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-700">Tài khoản tạm ngưng</span>
              <Lock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {users.filter(u => !u.is_active).length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Tạm dừng truy cập</p>
          </div>
        </div>

        {/* Filter Bar with Full Support Level, Skill Group & Status Filters */}
        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Tìm theo họ tên, email..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors font-normal"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex flex-wrap w-full lg:w-auto items-center gap-2">
              {/* Cấp hỗ trợ (L1 / L2) Filter */}
              <select 
                className={`px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                  levelFilter !== 'ALL' ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <option value="ALL">Tất cả cấp hỗ trợ</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="NONE">Không có cấp</option>
              </select>

              {/* Nhóm kỹ năng Filter */}
              <select 
                className={`px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                  skillFilter !== 'ALL' ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
              >
                <option value="ALL">Tất cả kỹ năng</option>
                <option value="ACCOUNT_AUTH">Tài khoản & Xác thực</option>
                <option value="SOFTWARE_BUG">Bug Phần mềm</option>
                <option value="NETWORK_INFRA">Hạ tầng Mạng</option>
                <option value="ACCESS_RESOURCE">Cấp quyền & Tài nguyên</option>
                <option value="TECH_GUIDE">Hướng dẫn Kỹ thuật</option>
              </select>

              {/* Vai trò Filter */}
              <select 
                className={`px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                  roleFilter !== 'ALL' ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="ADMIN">Admin</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="SUPPORT_AGENT">Support Agent</option>
                <option value="REQUESTER">Requester</option>
              </select>

              {/* Trạng thái hoạt động Filter */}
              <select 
                className={`px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                  statusFilter !== 'ALL' ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Đang tạm khóa</option>
              </select>

              {/* Phòng ban Filter */}
              <select 
                className={`px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                  departmentFilter !== 'ALL' ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">Tất cả phòng ban</option>
                <option value="Hỗ trợ Kỹ thuật">Hỗ trợ Kỹ thuật</option>
                <option value="Hạ tầng IT">Hạ tầng IT</option>
                <option value="An ninh & Hệ thống">An ninh & Hệ thống</option>
                <option value="Kế toán">Kế toán & Tài chính</option>
                <option value="Marketing">Marketing & PR</option>
                <option value="Kinh doanh">Kinh doanh (Sales)</option>
              </select>

              {/* Reset Filters button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Xóa bộ lọc"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* Active filter summary tag bar */}
          {isFiltered && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Bộ lọc đang áp dụng:</span>
              <span>Hiển thị {filteredUsers.length} / {users.length} tài khoản</span>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto min-h-[340px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Người dùng</th>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Cấp hỗ trợ</th>
                  <th className="px-4 py-3">Nhóm kỹ năng</th>
                  <th className="px-4 py-3">Số điện thoại</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Đang tải danh sách người dùng...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Không tìm thấy người dùng phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const isMenuOpen = activeMenuId === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={getUserAvatar(user, idx)} 
                              alt={user.full_name || user.email} 
                              key={`${user.id}-${avatarVersion}`}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0 bg-slate-100"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="hidden w-8 h-8 rounded-full bg-indigo-600 items-center justify-center font-bold text-xs text-white shrink-0">
                              {(user.full_name || user.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setViewingRequesterId(user.id)}
                                className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                                title="Bấm để xem hồ sơ và lịch sử ticket"
                              >
                                {user.full_name || 'Người dùng'}
                              </button>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                <Mail className="w-3 h-3" /> {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {user.department || 'Chung'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {getRoleBadge(user.role_name)}
                        </td>

                        {/* Cấp hỗ trợ L1 / L2 */}
                        <td className="px-4 py-3">
                          {getSupportLevelBadge(user.support_level)}
                        </td>

                        {/* Nhóm kỹ năng */}
                        <td className="px-4 py-3">
                          {getSkillBadge(user.skill_group)}
                        </td>

                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {user.phone_number || '—'}
                        </td>

                        <td className="px-4 py-3">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Đang hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Tạm khóa
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right user-action-menu">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMenuId === user.id) {
                                setActiveMenuId(null);
                                setMenuCoords(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const placement = spaceBelow < 240 && rect.top > 240 ? 'top' : 'bottom';
                                const top = placement === 'top' ? rect.top - 6 : rect.bottom + 6;
                                const right = Math.max(16, window.innerWidth - rect.right);
                                setActiveMenuId(user.id);
                                setMenuCoords({ top, right, placement });
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isMenuOpen 
                                ? 'bg-indigo-100 text-indigo-700' 
                                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                            }`}
                            title="Thao tác"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3-DOT ACTION POPOVER PORTAL (rendered to document.body to avoid table overflow clipping) */}
        {activeMenuId && menuCoords && activeUser && createPortal(
          <div 
            className="user-action-popover fixed w-48 rounded-xl border border-slate-200 bg-white shadow-2xl p-1 z-[9999] animate-in fade-in zoom-in-95 duration-150 text-left"
            style={{
              top: `${menuCoords.top}px`,
              right: `${menuCoords.right}px`,
              transform: menuCoords.placement === 'top' ? 'translateY(-100%)' : 'none'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveMenuId(null);
                setMenuCoords(null);
                setViewingRequesterId(activeUser.id);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
            >
              <TicketIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Xem hồ sơ & Lịch sử</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenuId(null);
                setMenuCoords(null);
                setEditingUser({ ...activeUser });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Chỉnh sửa hồ sơ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenuId(null);
                setMenuCoords(null);
                setResettingPasswordUser(activeUser);
                setNewPasswordVal('');
                setResetPasswordError(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenuId(null);
                setMenuCoords(null);
                handleToggleActive(activeUser);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
            >
              {activeUser.is_active ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Khóa tài khoản</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Mở khóa tài khoản</span>
                </>
              )}
            </button>

            <div className="pt-1 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveMenuId(null);
                  setMenuCoords(null);
                  handleDeleteUser(activeUser);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xóa người dùng</span>
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL 1: ADD USER USING PORTAL */}
        {showAddModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Thêm Người dùng / Kỹ thuật viên Mới</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.test"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Mật khẩu ban đầu *</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Vai trò phân quyền</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="REQUESTER">Requester (Người dùng)</option>
                      <option value="SUPPORT_AGENT">Support Agent (Kỹ thuật viên)</option>
                      <option value="TEAM_LEAD">Team Lead (Trưởng nhóm)</option>
                      <option value="ADMIN">Admin (Quản trị viên)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Phòng ban</label>
                    <select
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Hỗ trợ Kỹ thuật">Hỗ trợ Kỹ thuật</option>
                      <option value="Hạ tầng IT">Hạ tầng IT</option>
                      <option value="An ninh & Hệ thống">An ninh & Hệ thống</option>
                      <option value="Kế toán">Kế toán & Tài chính</option>
                      <option value="Marketing">Marketing & PR</option>
                      <option value="Kinh doanh">Kinh doanh (Sales)</option>
                    </select>
                  </div>
                </div>

                {/* Additional Fields when role is SUPPORT_AGENT */}
                {newRole === 'SUPPORT_AGENT' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        Cấp hỗ trợ
                      </label>
                      <select
                        value={newSupportLevel}
                        onChange={(e) => setNewSupportLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="L1">L1 (Cơ bản)</option>
                        <option value="L2">L2 (Chuyên sâu)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                        Nhóm kỹ năng
                      </label>
                      <select
                        value={newSkillGroup}
                        onChange={(e) => setNewSkillGroup(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="ACCOUNT_AUTH">Tài khoản & Xác thực</option>
                        <option value="SOFTWARE_BUG">Bug Phần mềm</option>
                        <option value="NETWORK_INFRA">Hạ tầng Mạng</option>
                        <option value="ACCESS_RESOURCE">Cấp quyền & Tài nguyên</option>
                        <option value="TECH_GUIDE">Hướng dẫn Kỹ thuật</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0987 654 321"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {createUserMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Lưu người dùng</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL 2: EDIT USER USING PORTAL */}
        {editingUser && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Chỉnh sửa thông tin người dùng</h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditUserSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={editingUser.full_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Email (Cố định)</label>
                  <input
                    type="email"
                    disabled
                    value={editingUser.email}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Vai trò</label>
                    <select
                      value={editingUser.role_name || 'REQUESTER'}
                      onChange={(e) => setEditingUser({ ...editingUser, role_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="REQUESTER">Requester</option>
                      <option value="SUPPORT_AGENT">Support Agent</option>
                      <option value="TEAM_LEAD">Team Lead</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Phòng ban</label>
                    <select
                      value={editingUser.department || 'Hỗ trợ Kỹ thuật'}
                      onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Hỗ trợ Kỹ thuật">Hỗ trợ Kỹ thuật</option>
                      <option value="Hạ tầng IT">Hạ tầng IT</option>
                      <option value="An ninh & Hệ thống">An ninh & Hệ thống</option>
                      <option value="Kế toán">Kế toán & Tài chính</option>
                      <option value="Marketing">Marketing & PR</option>
                      <option value="Kinh doanh">Kinh doanh (Sales)</option>
                    </select>
                  </div>
                </div>

                {/* Edit Support Level and Skill Group when role is SUPPORT_AGENT */}
                {editingUser.role_name === 'SUPPORT_AGENT' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        Cấp hỗ trợ
                      </label>
                      <select
                        value={editingUser.support_level || 'L1'}
                        onChange={(e) => setEditingUser({ ...editingUser, support_level: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="L1">L1 (Cơ bản)</option>
                        <option value="L2">L2 (Chuyên sâu)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                        Nhóm kỹ năng
                      </label>
                      <select
                        value={editingUser.skill_group || 'ACCOUNT_AUTH'}
                        onChange={(e) => setEditingUser({ ...editingUser, skill_group: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="ACCOUNT_AUTH">Tài khoản & Xác thực</option>
                        <option value="SOFTWARE_BUG">Bug Phần mềm</option>
                        <option value="NETWORK_INFRA">Hạ tầng Mạng</option>
                        <option value="ACCESS_RESOURCE">Cấp quyền & Tài nguyên</option>
                        <option value="TECH_GUIDE">Hướng dẫn Kỹ thuật</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Số điện thoại</label>
                  <input
                    type="text"
                    value={editingUser.phone_number || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone_number: e.target.value })}
                    placeholder="0987 654 321"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Trạng thái kích hoạt</p>
                    <p className="text-[11px] text-slate-500">Cho phép người dùng đăng nhập hệ thống.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingUser.is_active}
                    onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {updateUserMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Lưu cập nhật</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL 3: RESET PASSWORD USING PORTAL */}
        {resettingPasswordUser && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 flex flex-col animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">Đổi mật khẩu tài khoản</h3>
                <button
                  type="button"
                  onClick={() => {
                    setResettingPasswordUser(null);
                    setResetPasswordError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                <p className="text-xs text-slate-600">
                  Thiết lập lại mật khẩu đăng nhập mới cho người dùng <strong className="text-slate-900">{resettingPasswordUser.full_name || resettingPasswordUser.email}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Mật khẩu mới *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPasswordVal}
                    onChange={(e) => {
                      setNewPasswordVal(e.target.value);
                      if (resetPasswordError) setResetPasswordError(null);
                    }}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {resetPasswordError && (
                    <p className="text-[11px] text-rose-600 font-medium pt-0.5">{resetPasswordError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setResettingPasswordUser(null);
                      setResetPasswordError(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {updateUserMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Cập nhật mật khẩu</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL 4: REQUESTER PROFILE & TICKET HISTORY */}
        {viewingRequesterId && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Hồ sơ Người dùng & Lịch sử Ticket</h3>
                    <p className="text-xs text-slate-500">Thông tin liên hệ và danh sách ticket liên quan.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRequesterId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isProfileLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  Đang tải hồ sơ và lịch sử ticket...
                </div>
              ) : requesterProfile ? (
                <div className="space-y-5">
                  {/* Contact Info Card */}
                  <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Họ và tên</span>
                      <span className="font-bold text-slate-900 text-sm">{requesterProfile.full_name || 'Người dùng'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email liên hệ</span>
                      <span className="font-medium text-slate-800 font-mono">{requesterProfile.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phòng ban</span>
                      <span className="font-medium text-slate-800">{requesterProfile.department || 'Chung'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Số điện thoại</span>
                      <span className="font-medium text-slate-800 font-mono">{requesterProfile.phone_number || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Vai trò</span>
                      <span className="inline-block mt-0.5">{getRoleBadge(requesterProfile.role_name)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Trạng thái tài khoản</span>
                      <span className="inline-block mt-0.5">
                        {requesterProfile.is_active ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Đang tạm khóa
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-center">
                      <span className="text-[11px] text-indigo-600 font-semibold block">Tổng ticket</span>
                      <span className="text-lg font-bold text-indigo-900">{requesterProfile.total_tickets ?? (requesterProfile.tickets || requesterProfile.recent_tickets || []).length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-center">
                      <span className="text-[11px] text-amber-600 font-semibold block">Đang xử lý</span>
                      <span className="text-lg font-bold text-amber-900">{requesterProfile.open_tickets ?? 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-center">
                      <span className="text-[11px] text-emerald-600 font-semibold block">Đã giải quyết</span>
                      <span className="text-lg font-bold text-emerald-900">{requesterProfile.closed_tickets ?? 0}</span>
                    </div>
                  </div>

                  {/* Ticket History List */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <TicketIcon className="w-3.5 h-3.5 text-indigo-600" /> Lịch sử yêu cầu gần đây ({(requesterProfile.recent_tickets || requesterProfile.tickets || []).length})
                    </h4>

                    {(!(requesterProfile.recent_tickets || requesterProfile.tickets) || (requesterProfile.recent_tickets || requesterProfile.tickets).length === 0) ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Chưa có lịch sử ticket nào được ghi nhận cho tài khoản này.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {(requesterProfile.recent_tickets || requesterProfile.tickets).map((t: any) => (
                          <div key={t.id} className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-colors flex items-center justify-between gap-3 shadow-2xs">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/tickets/${t.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                  {t.ticket_code}
                                </a>
                                <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                                  t.priority === 'P1' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  t.priority === 'P2' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  t.priority === 'P3' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {t.priority}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 font-medium truncate mt-0.5">
                                {t.title}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                Tạo lúc: {new Date(t.created_at).toLocaleString('vi-VN')}
                              </span>
                            </div>

                            <div className="shrink-0 text-right">
                              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                t.status === 'RESOLVED' || t.status === 'CLOSED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : t.status === 'PROCESSING'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-rose-500">
                  Không thể tải thông tin hồ sơ người dùng.
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingRequesterId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Đóng
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

export default CustomersPage;
