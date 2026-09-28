import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { authApi } from '../services/authApi';
import { 
  User, Mail, Building2, Phone, 
  Lock, Save, CheckCircle2, AlertCircle, Camera, 
  Check, RefreshCw, KeyRound, Upload, Sparkles, X,
  Eye, EyeOff
} from 'lucide-react';

export const AVATAR_LIST = Array.from(
  { length: 39 }, 
  (_, i) => `/avatar/${String(i + 1).padStart(2, '0')}.jpg`
);

export const ProfilePage = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<'info' | 'security'>('info');

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

  // State
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<string>('/avatar/01.jpg');
  const [tempAvatar, setTempAvatar] = useState<string>('/avatar/01.jpg');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<'all' | '3d' | 'anime' | 'gaming'>('all');

  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Sync initial values
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setDepartment(currentUser.department || 'IT');
      setPhoneNumber(currentUser.phone_number || '');
    }
    const savedAvatar = localStorage.getItem('user_avatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
      setTempAvatar(savedAvatar);
    }
  }, [currentUser]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['currentUser'], data);
      setProfileSuccess('Đã lưu thay đổi thông tin cá nhân thành công!');
      setProfileError('');
      setTimeout(() => setProfileSuccess(''), 4000);
    },
    onError: (err: any) => {
      setProfileError(err.response?.data?.detail || 'Cập nhật thông tin thất bại.');
      setProfileSuccess('');
    }
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: () => {
      setPasswordSuccess('Đổi mật khẩu tài khoản thành công!');
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    },
    onError: (err: any) => {
      setPasswordError(err.response?.data?.detail || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.');
      setPasswordSuccess('');
    }
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    updateProfileMutation.mutate({
      full_name: fullName,
      department: department,
      phone_number: phoneNumber
    });
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
      return;
    }

    updatePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword
    });
  };

  // Avatar picker handlers
  const handleOpenAvatarPicker = () => {
    setTempAvatar(selectedAvatar);
    setShowAvatarPicker(true);
  };

  const handleConfirmAvatar = () => {
    setSelectedAvatar(tempAvatar);
    localStorage.setItem('user_avatar', tempAvatar);
    window.dispatchEvent(new Event('avatarChanged'));
    setShowAvatarPicker(false);
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setTempAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredAvatars = AVATAR_LIST.filter((path) => {
    const num = parseInt(path.replace(/[^0-9]/g, ''), 10);
    if (avatarCategory === '3d') return num >= 1 && num <= 12;
    if (avatarCategory === 'anime') return num >= 13 && num <= 26;
    if (avatarCategory === 'gaming') return num >= 27 && num <= 39;
    return true;
  });

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Quản trị viên (Admin)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'TEAM_LEAD':
        return { label: 'Trưởng nhóm (Team Lead)', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'SUPPORT_AGENT':
        return { label: 'Kỹ thuật viên (Support Agent)', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'REQUESTER':
        return { label: 'Khách hàng / Người dùng', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      default:
        return { label: 'Thành viên', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const roleInfo = getRoleLabel(currentUser?.role_name);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Hồ sơ & Tài khoản
          </h2>
        </div>

        {/* User Identity Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            {/* Avatar with click to change */}
            <div 
              onClick={handleOpenAvatarPicker}
              className="relative group cursor-pointer shrink-0"
              title="Nhấp để đổi ảnh đại diện"
            >
              <img 
                src={selectedAvatar} 
                alt="Avatar" 
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border border-slate-200 shadow-2xs group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {currentUser?.full_name || 'Người dùng'}
              </h3>
              <p className="text-xs text-slate-400">
                Phòng ban: <strong className="text-slate-600 font-medium">{currentUser?.department || 'IT Operations'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAvatarPicker}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>Đổi Avatar ({AVATAR_LIST.length})</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSection('info')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px ${
              activeSection === 'info'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Thông tin cá nhân</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 -mb-px ${
              activeSection === 'security'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Bảo mật & Mật khẩu</span>
          </button>
        </div>

        {/* SECTION 1: THÔNG TIN CÁ NHÂN */}
        {activeSection === 'info' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
            {profileSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Email đăng nhập</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type="email"
                      disabled
                      value={currentUser?.email || ''}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">Email cố định gắn liền với tài khoản hệ thống.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Phòng ban</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="IT">IT Support & System</option>
                      <option value="Kế toán">Kế toán & Tài chính</option>
                      <option value="Marketing">Marketing & Truyền thông</option>
                      <option value="Kinh doanh">Kinh doanh & Bán hàng</option>
                      <option value="Nhân sự">Nhân sự & Hành chính</option>
                      <option value="Khác">Phòng ban khác</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0987 654 321"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-70"
                >
                  {updateProfileMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SECTION 2: ĐỔI MẬT KHẨU */}
        {activeSection === 'security' && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
            {passwordSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                      title={showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Tối thiểu 6 ký tự"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                      title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={updatePasswordMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-70"
                >
                  {updatePasswordMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Cập nhật mật khẩu</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LUXURY AVATAR PICKER MODAL USING PORTAL */}
        {showAvatarPicker && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Sparkles className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Bộ Sưu Tập Ảnh Đại Diện</h3>
                    <p className="text-xs text-slate-500">Tùy chọn avatar mẫu hoặc tải ảnh đại diện từ máy tính của bạn.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Active Selection Preview Card */}
              <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <img 
                  src={tempAvatar} 
                  alt="Preview" 
                  className="w-11 h-11 rounded-full object-cover border border-slate-300 shadow-2xs shrink-0"
                />

                <div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleCustomFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tải ảnh từ máy tính</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAvatarCategory('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    avatarCategory === 'all'
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({AVATAR_LIST.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarCategory('3d')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    avatarCategory === '3d'
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  3D Nhân vật (12)
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarCategory('anime')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    avatarCategory === 'anime'
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Anime & Manga (14)
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarCategory('gaming')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    avatarCategory === 'gaming'
                      ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Gaming & Digital (13)
                </button>
              </div>

              {/* Clean Grid of Avatars */}
              <div className="overflow-y-auto pr-1 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3 py-1 flex-1 max-h-64">
                {filteredAvatars.map((avatarPath) => {
                  const isSelected = tempAvatar === avatarPath;
                  return (
                    <button
                      key={avatarPath}
                      type="button"
                      onClick={() => setTempAvatar(avatarPath)}
                      className={`relative rounded-full aspect-square border-2 transition-all p-0.5 cursor-pointer hover:scale-105 ${
                        isSelected 
                          ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img 
                        src={avatarPath} 
                        alt="Avatar Option" 
                        className="w-full h-full object-cover rounded-full"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-600/30 rounded-full flex items-center justify-center">
                          <div className="bg-indigo-600 text-white rounded-full p-1 shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAvatar}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng Avatar</span>
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

export default ProfilePage;
