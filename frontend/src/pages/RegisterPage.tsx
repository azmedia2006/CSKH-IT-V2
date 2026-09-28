import { formatErrorMessage } from '../utils/formatError';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { googleAuthApi } from '../services/settingsApi';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AuthBackground } from '../components/AuthBackground';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isGoogleRegistering, setIsGoogleRegistering] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string; redirect_uri: string }>({
    enabled: false,
    client_id: '',
    redirect_uri: ''
  });

  // Lấy cấu hình Google OAuth
  useEffect(() => {
    googleAuthApi.getPublicConfig()
      .then((cfg) => setGoogleConfig(cfg))
      .catch((e) => console.warn('Could not load Google config on register:', e));
  }, []);

  // Xử lý token Google cho luồng đăng ký
  const handleGoogleRegisterToken = (tokenData: { credential?: string; access_token?: string }) => {
    setIsGoogleRegistering(true);
    setError('');
    googleAuthApi.loginWithGoogle({ ...tokenData, is_register: true })
      .then(async (data) => {
        localStorage.setItem('token', data.access_token);
        try {
          const user = await authApi.getCurrentUser();
          if (user?.role_name === 'REQUESTER') {
            navigate('/tickets');
          } else {
            navigate('/dashboard');
          }
        } catch {
          navigate('/tickets');
        }
      })
      .catch((err: any) => {
        console.error('Google register error:', err);
        setError(formatErrorMessage(err, 'Đăng ký bằng Google không thành công. Vui lòng thử lại.'));
      })
      .finally(() => {
        setIsGoogleRegistering(false);
      });
  };

  // Google One-Tap cho trang đăng ký
  useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.client_id) return;

    const onCredentialReceived = (response: any) => {
      if (response?.credential) {
        handleGoogleRegisterToken({ credential: response.credential });
      }
    };

    const displayOneTap = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: googleConfig.client_id,
            callback: onCredentialReceived,
            auto_select: false,
            cancel_on_tap_outside: false
          });
          google.accounts.id.prompt();
        } catch (e) {
          console.warn('Google One Tap register prompt warning:', e);
        }
      }
    };

    displayOneTap();
    const interval = setInterval(displayOneTap, 800);
    const timeout = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      try {
        const google = (window as any).google;
        if (google?.accounts?.id?.cancel) {
          google.accounts.id.cancel();
        }
      } catch (e) {
        // ignore
      }
    };
  }, [googleConfig]);

  // Bấm nút Đăng ký bằng Google
  const handleGoogleRegisterClick = () => {
    setError('');
    const google = (window as any).google;
    if (googleConfig.enabled && googleConfig.client_id && google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: googleConfig.client_id,
        callback: (response: any) => {
          if (response?.credential) {
            handleGoogleRegisterToken({ credential: response.credential });
          }
        }
      });
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback mở OAuth popup chuẩn nếu One-Tap bị chặn
          if (google?.accounts?.oauth2) {
            const client = google.accounts.oauth2.initTokenClient({
              client_id: googleConfig.client_id,
              scope: 'email profile openid',
              callback: (tokenResp: any) => {
                if (tokenResp?.access_token) {
                  handleGoogleRegisterToken({ access_token: tokenResp.access_token });
                }
              }
            });
            client.requestAccessToken();
          }
        }
      });
    } else if (googleConfig.enabled && googleConfig.client_id) {
      // Direct redirect fallback
      const origin = window.location.origin;
      const targetDomain = 'https://azmedia247.com';
      const redirectUri = (origin === targetDomain) ? `${targetDomain}/register` : `${origin}/register`;
      const scope = encodeURIComponent('email profile openid');
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleConfig.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token%20token&scope=${scope}&nonce=${Date.now()}`;
      window.location.href = oauthUrl;
    } else {
      setError('Đăng ký bằng Google tạm thời chưa khả dụng. Vui lòng đăng ký qua form bên dưới.');
    }
  };

  // Lắng nghe token OAuth redirect từ URL hash
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    if (idToken || accessToken) {
      handleGoogleRegisterToken({
        credential: idToken || undefined,
        access_token: accessToken || undefined
      });
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      localStorage.setItem('token', data.access_token);
      navigate('/tickets');
    },
    onError: (err: any) => {
      console.error('Registration error:', err);
      setError(formatErrorMessage(err, 'Đăng ký không thành công. Vui lòng thử lại.'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    registerMutation.mutate({
      email,
      password,
      full_name: fullName
    });
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-[420px] p-7 sm:p-8 bg-white/95 backdrop-blur-md border border-white/60 shadow-2xl rounded-2xl relative z-10 animate-in fade-in duration-300 ring-1 ring-slate-900/5">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="mb-3 group cursor-pointer">
            <img 
              src="/avatar/AI_support.svg" 
              alt="AI Support Logo" 
              className="w-14 h-14 object-contain drop-shadow-sm group-hover:scale-105 transition-transform" 
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Tạo Tài Khoản Mới
          </h1>
          <p className="text-slate-600 text-xs mt-1 flex items-center gap-1.5 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Cổng dịch vụ khách hàng IT Service Desk
          </p>
        </div>

        {/* Nút Đăng ký bằng Google đặt trên cùng hoặc dưới */}
        <button
          type="button"
          disabled={isGoogleRegistering}
          onClick={handleGoogleRegisterClick}
          className="w-full py-3 px-4 min-h-[44px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-xs text-xs sm:text-sm cursor-pointer hover:border-slate-400 disabled:opacity-60 mb-4"
          aria-label="Đăng ký tài khoản nhanh bằng Google"
        >
          {isGoogleRegistering ? (
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Đăng ký nhanh bằng Google</span>
            </>
          )}
        </button>

        {/* Đường phân cách */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2.5 text-slate-500 font-medium text-[11px]">Hoặc đăng ký bằng email</span>
          </div>
        </div>

        {/* Form Đăng ký truyền thống */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium animate-in slide-in-from-top-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="reg-fullname" className="text-xs font-semibold text-slate-700">Họ và Tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="reg-fullname"
                type="text"
                required
                className="w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                placeholder="Họ và tên của bạn"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-email" className="text-xs font-semibold text-slate-700">Email liên hệ</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="reg-email"
                type="email"
                required
                className="w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-password" className="text-xs font-semibold text-slate-700">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full pl-9 pr-10 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="reg-confirm-password" className="text-xs font-semibold text-slate-700">Xác nhận mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className="w-full pl-9 pr-10 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
                aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full mt-2 py-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-70 cursor-pointer text-xs sm:text-sm"
          >
            {registerMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>Đăng ký tài khoản <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-5 text-center text-xs text-slate-600 border-t border-slate-100 pt-3.5 font-normal">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </AuthBackground>
  );
};

export default RegisterPage;
