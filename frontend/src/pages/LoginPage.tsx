import { formatErrorMessage } from '../utils/formatError';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { googleAuthApi } from '../services/settingsApi';
import { Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AuthBackground } from '../components/AuthBackground';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string; redirect_uri: string }>({
    enabled: false,
    client_id: '',
    redirect_uri: ''
  });

  // Check Google Config on mount
  React.useEffect(() => {
    googleAuthApi.getPublicConfig()
      .then((cfg) => setGoogleConfig(cfg))
      .catch((e) => console.warn('Could not load Google auth config', e));
  }, []);

  // Google One-Tap: Hiển thị popup tài khoản Google ở góc trên bên phải màn hình
  React.useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.client_id) return;

    const onCredentialReceived = (response: any) => {
      if (response?.credential) {
        setIsGoogleLoggingIn(true);
        setError('');
        googleAuthApi.loginWithGoogle({ credential: response.credential, is_register: false })
          .then(async (data) => {
            localStorage.setItem('token', data.access_token); if ((data as any).role) localStorage.setItem('user_role', (data as any).role);
            try {
              const user = await authApi.getCurrentUser();
              if (user?.role_name) localStorage.setItem('user_role', user.role_name);
              if (user?.role_name === 'REQUESTER') {
                navigate('/tickets');
              } else {
                navigate('/dashboard');
              }
            } catch {
              navigate('/dashboard');
            }
          })
          .catch((err: any) => {
            console.error('Google One Tap login error:', err);
            setError(formatErrorMessage(err, 'Đăng nhập Google thất bại.'));
          })
          .finally(() => {
            setIsGoogleLoggingIn(false);
          });
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
          console.warn('Google One Tap prompt warning:', e);
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
  }, [googleConfig, navigate]);

  // Initialize Google Identity Services (GSI)
  React.useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.client_id) return;

    const processGoogleToken = (tokenData: { credential?: string; access_token?: string }) => {
      setIsGoogleLoggingIn(true);
      setError('');
      googleAuthApi.loginWithGoogle({ ...tokenData, is_register: false })
        .then(async (data) => {
          localStorage.setItem('token', data.access_token); if ((data as any).role) localStorage.setItem('user_role', (data as any).role);
          try {
            const user = await authApi.getCurrentUser();
            if (user?.role_name === 'REQUESTER') {
              navigate('/tickets');
            } else {
              navigate('/dashboard');
            }
          } catch {
            navigate('/dashboard');
          }
        })
        .catch((err: any) => {
          console.error('Google login error:', err);
          setError(formatErrorMessage(err, 'Đăng nhập Google thất bại. Vui lòng thử lại.'));
        })
        .finally(() => {
          setIsGoogleLoggingIn(false);
        });
    };

    const initGsi = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: googleConfig.client_id,
            callback: (response: any) => {
              if (response?.credential) {
                processGoogleToken({ credential: response.credential });
              }
            }
          });
        } catch (e) {
          console.warn('GSI init warning:', e);
        }
      }
    };

    initGsi();
    const timer = setTimeout(initGsi, 1000);
    return () => clearTimeout(timer);
  }, [googleConfig, navigate]);

  // Handle Google OAuth Redirect Token from hash (#id_token=... or #access_token=...)
  React.useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    if (idToken || accessToken) {
      window.history.replaceState(null, '', window.location.pathname);
      setIsGoogleLoggingIn(true);
      setError('');
      googleAuthApi.loginWithGoogle({
        credential: idToken || undefined,
        access_token: accessToken || undefined
      })
        .then(async (data) => {
          localStorage.setItem('token', data.access_token); if ((data as any).role) localStorage.setItem('user_role', (data as any).role);
          try {
            const user = await authApi.getCurrentUser();
            if (user?.role_name === 'REQUESTER') {
              navigate('/tickets');
            } else {
              navigate('/dashboard');
            }
          } catch {
            navigate('/dashboard');
          }
        })
        .catch((err: any) => {
          console.error('Google login error:', err);
          setError(formatErrorMessage(err, 'Đăng nhập Google thất bại. Vui lòng thử lại.'));
        })
        .finally(() => {
          setIsGoogleLoggingIn(false);
        });
    }
  }, [navigate]);

  const handleGoogleLogin = () => {
    if (!googleConfig.enabled || !googleConfig.client_id) {
      alert('Chức năng đăng nhập Google chưa được kích hoạt hoặc chưa điền Client ID.\n\nQuản trị viên vui lòng đăng nhập tài khoản Admin và vào menu "Cấu hình Google" để thiết lập.');
      return;
    }

    // Luôn ưu tiên dùng redirect_uri đã đăng ký trên Google Cloud Console (https://azmedia247.com/login)
    // Giúp hoạt động mượt mà kể cả khi người dùng truy cập từ địa chỉ IP VPS hay domain
    const redirectUri = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? (window.location.origin + '/login')
      : (googleConfig.redirect_uri || 'https://azmedia247.com/login');

    const nonce = Math.random().toString(36).substring(2);
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleConfig.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${nonce}`;
    window.location.href = googleAuthUrl;
  };

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      localStorage.setItem('token', data.access_token); if ((data as any).role) localStorage.setItem('user_role', (data as any).role);
      try {
        const user = await authApi.getCurrentUser();
        if (user?.role_name === 'REQUESTER') {
          navigate('/tickets');
        } else {
          navigate('/dashboard');
        }
      } catch {
        navigate('/dashboard');
      }
    },
    onError: (err: any) => {
      console.error('Login error:', err);
      setError(formatErrorMessage(err, 'Email hoặc mật khẩu không chính xác.'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <AuthBackground>
      {/* Login Card */}
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
            IT Service Desk
          </h1>
          <p className="text-slate-500 text-xs mt-1 flex items-center gap-1.5 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Hệ thống quản lý hỗ trợ khách hàng
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium animate-in slide-in-from-top-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
              <div className="flex-1 leading-relaxed">
                <span>{error}</span>
                {error.includes('Đăng ký') && (
                  <div className="mt-1.5">
                    <Link to="/register" className="font-bold underline text-indigo-700 hover:text-indigo-800">
                      Bấm vào đây để sang trang Đăng ký ngay
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                required
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                id="login-email" placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">Mật khẩu</label>
              <Link 
                to="/forgot-password" 
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all font-normal"
                id="login-password" placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full mt-2 py-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-70 cursor-pointer text-xs"
          >
            {loginMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>Đăng nhập <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-medium text-[11px]">Hoặc tiếp tục với</span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          disabled={isGoogleLoggingIn}
          onClick={handleGoogleLogin}
          className="w-full py-3 px-4 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-2xs text-xs cursor-pointer hover:border-slate-300 disabled:opacity-60"
        >
          {isGoogleLoggingIn ? (
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Đăng nhập với Google</span>
            </>
          )}
        </button>

        <div className="mt-6 text-center text-xs text-slate-500">
          Chưa có tài khoản? <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline">Đăng ký ngay</Link>
        </div>
      </div>
    </AuthBackground>
  );
};

export default LoginPage;

