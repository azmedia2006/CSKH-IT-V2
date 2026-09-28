import { formatErrorMessage } from '../utils/formatError';
﻿import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { 
  Mail, Lock, ArrowRight, ShieldCheck, ArrowLeft, 
  Eye, EyeOff, CheckCircle2, RotateCw, Check, Edit2, X
} from 'lucide-react';
import { AuthBackground } from '../components/AuthBackground';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  // 3-step workflow: 'request' -> 'verify' -> 'reset'
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(true);
  const [resetToken, setResetToken] = useState<string>('');

  // Auto-dismiss verified banner after 4 seconds
  useEffect(() => {
    if (step === 'reset') {
      setShowVerifiedBanner(true);
      const timer = setTimeout(() => {
        setShowVerifiedBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Full OTP combined from 6 digits
  const fullOtp = useMemo(() => otpDigits.join(''), [otpDigits]);

  // Mask email for PII security: e.g. mp14122006pt@gmail.com -> mp***pt@gmail.com
  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [user, domain] = emailStr.split('@');
    if (user.length <= 2) {
      return `${user[0]}***@${domain}`;
    } else if (user.length <= 4) {
      return `${user[0]}***${user[user.length - 1]}@${domain}`;
    } else {
      return `${user.slice(0, 2)}***${user.slice(-2)}@${domain}`;
    }
  };

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  // Focus the first OTP input box when stepping into 'verify'
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 120);
    }
  }, [step]);

  // Password requirements calculation
  const passwordChecks = useMemo(() => {
    return {
      hasMinLength: newPassword.length >= 6,
      hasLetter: /[a-zA-Z]/.test(newPassword),
      hasNumberOrSpecial: /[\d\W]/.test(newPassword),
    };
  }, [newPassword]);

  // Password strength score (0 to 3)
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, text: 'Chưa nhập', color: 'bg-slate-200', textColor: 'text-slate-400' };
    let score = 0;
    if (passwordChecks.hasMinLength) score += 1;
    if (newPassword.length >= 8 && passwordChecks.hasLetter) score += 1;
    if (passwordChecks.hasNumberOrSpecial && (score >= 2 || newPassword.length >= 8)) score += 1;

    if (score === 1) {
      return { score: 1, text: 'Yếu', color: 'bg-rose-500', textColor: 'text-rose-600' };
    }
    if (score === 2) {
      return { score: 2, text: 'Trung bình', color: 'bg-amber-500', textColor: 'text-amber-600' };
    }
    return { score: 3, text: 'Mạnh', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
  }, [newPassword, passwordChecks]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1: Request OTP mutation
  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setError('');
      setOtpDigits(['', '', '', '', '', '']);
      setStep('verify');
      setResendCooldown(60);
    },
    onError: (err: any) => {
      console.error('Forgot password error:', err);
      setError(formatErrorMessage(err, 'Không tìm thấy tài khoản với email này.'));
    }
  });

  // Step 2: Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: (data) => {
      setError('');
      if (data.reset_token) {
        setResetToken(data.reset_token);
      }
      // Securely clear raw OTP digits from memory
      setOtpDigits(['', '', '', '', '', '']);
      setStep('reset');
    },
    onError: (err: any) => {
      console.error('Verify OTP error:', err);
      setError(formatErrorMessage(err, 'Mã xác nhận OTP không đúng hoặc đã hết hạn.'));
    }
  });

  // Step 3: Set new password mutation
  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: (data) => {
      setError('');
      setSuccessMessage(data.message || 'Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    },
    onError: (err: any) => {
      console.error('Reset password error:', err);
      setError(formatErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại thông tin.'));
    }
  });

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    forgotMutation.mutate({ email: email.trim() });
  };

  const handleResendOtp = () => {
    if (resendCooldown > 0 || forgotMutation.isPending) return;
    setError('');
    forgotMutation.mutate({ email: email.trim() });
  };

  // Handle single character change in OTP boxes
  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    
    // If empty
    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // If pasted or multi-char in one box
    if (cleaned.length > 1) {
      const newDigits = [...otpDigits];
      const chars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        if (chars[i]) newDigits[i] = chars[i];
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(chars.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    // Normal 1 char input
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    // Auto advance to next box
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace and arrow navigation between OTP boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Paste event on any OTP box
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newDigits = ['', '', '', '', '', ''];
      pasted.split('').forEach((c, idx) => {
        if (idx < 6) newDigits[idx] = c;
      });
      setOtpDigits(newDigits);
      const focusTarget = Math.min(pasted.length, 5);
      otpInputRefs.current[focusTarget]?.focus();
    }
  };

  const handleVerifyOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullOtp.length < 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số của mã OTP.');
      return;
    }

    verifyOtpMutation.mutate({
      email: email.trim(),
      otp: fullOtp
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    resetMutation.mutate({
      reset_token: resetToken || undefined,
      email: !resetToken ? email.trim() : undefined,
      otp: !resetToken ? fullOtp : undefined,
      new_password: newPassword
    });
  };

  return (
    <AuthBackground>
      {/* Solid Pure White Card (Crystal clear contrast against dark background) */}
      <div className="w-full max-w-[450px] p-7 sm:p-8 bg-white/95 backdrop-blur-md border border-white/60 shadow-2xl rounded-2xl relative z-10 animate-in fade-in duration-300 ring-1 ring-slate-900/5">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="mb-3 group cursor-pointer">
            <img 
              src="/avatar/AI_support.svg" 
              alt="AI Support Mascot" 
              className="w-14 h-14 object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200" 
            />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {step === 'request' && 'Quên Mật Khẩu'}
            {step === 'verify' && 'Xác Thực Mã OTP'}
            {step === 'reset' && 'Thiết Lập Mật Khẩu Mới'}
          </h1>
          
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1.5 font-normal justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {step === 'request' && 'Nhập email để nhận mã OTP xác thực khôi phục'}
              {step === 'verify' && 'Nhập mã 6 chữ số vừa được gửi đến email'}
              {step === 'reset' && 'Tạo mật khẩu mới an toàn cho tài khoản'}
            </span>
          </p>
        </div>

        {/* ================= STEP PROGRESS TRACKER (Centered with Proper Spacing) ================= */}
        <div className="mb-6 px-1">
          <div className="relative flex items-center justify-between">
            {/* Connecting Line (Center of 32px node = top-4) */}
            <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-0.5 bg-slate-200 z-0">
              <div 
                className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                style={{
                  width: step === 'request' ? '0%' : step === 'verify' ? '50%' : '100%'
                }}
              />
            </div>

            {/* Step 1 Node */}
            <div className="flex flex-col items-center relative z-10">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === 'request'
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-sm'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {step !== 'request' ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${
                step === 'request' ? 'text-indigo-600 font-semibold' : 'text-slate-600'
              }`}>
                Nhập Email
              </span>
            </div>

            {/* Step 2 Node */}
            <div className="flex flex-col items-center relative z-10">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === 'verify'
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-sm'
                    : step === 'reset'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {step === 'reset' ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${
                step === 'verify' ? 'text-indigo-600 font-semibold' : 'text-slate-500'
              }`}>
                Mã OTP
              </span>
            </div>

            {/* Step 3 Node */}
            <div className="flex flex-col items-center relative z-10">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === 'reset'
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-sm'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                3
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${
                step === 'reset' ? 'text-indigo-600 font-semibold' : 'text-slate-500'
              }`}>
                Mật khẩu mới
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in slide-in-from-top-1 duration-200 flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in slide-in-from-top-1 duration-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* ================= STEP 1: REQUEST OTP ================= */}
        {step === 'request' && (
          <form onSubmit={handleRequestSubmit} className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Email đăng ký tài khoản <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoFocus
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-sans"
                  placeholder="example@company.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-400 pl-0.5">
                Hệ thống sẽ gửi mã xác thực 6 số đến hòm thư này.
              </p>
            </div>

            <button
              type="submit"
              disabled={forgotMutation.isPending || !email.trim()}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {forgotMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Gửi mã OTP về Email <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        )}

        {/* ================= STEP 2: VERIFY OTP ================= */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-4 animate-in fade-in duration-200">
            {/* PII Masked Email Info Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-50/90 border border-indigo-100 text-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-indigo-950 font-sans tracking-tight truncate">
                    {maskedEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer shrink-0"
                  title="Thay đổi địa chỉ email"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Đổi</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-indigo-100/70">
                Mã xác nhận 6 số đã được gửi. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư <strong>Spam/Rác</strong>).
              </p>
            </div>

            {/* 6 Digit OTP Pin Boxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Mã xác nhận (OTP)</label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || forgotMutation.isPending}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 font-medium flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCw className={`w-3 h-3 ${forgotMutation.isPending ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại mã'}
                </button>
              </div>

              {/* 6 Square Inputs with divider */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-1">
                {otpDigits.map((digit, index) => (
                  <React.Fragment key={index}>
                    {index === 3 && (
                      <div className="w-1.5 sm:w-2 h-0.5 bg-slate-300 rounded-full shrink-0" />
                    )}
                    <input
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      onFocus={(e) => e.target.select()}
                      className={`w-10 sm:w-12 h-12 sm:h-13 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border transition-all outline-none cursor-pointer ${
                        digit
                          ? 'bg-indigo-50/70 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                      }`}
                    />
                  </React.Fragment>
                ))}
              </div>

              <p className="text-[11px] text-slate-400 pt-0.5 px-0.5">
                Mã gồm 6 chữ số (Hiệu lực: 15 phút)
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending || fullOtp.length < 6}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {verifyOtpMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Xác thực mã OTP <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        )}

        {/* ================= STEP 3: RESET PASSWORD ================= */}
        {step === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-3.5 animate-in fade-in duration-200">
            {/* Verified Account Banner */}
            {showVerifiedBanner && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="text-[11px] leading-relaxed">
                    Đã xác thực OTP cho tài khoản <strong className="font-semibold text-slate-900">{maskedEmail}</strong>.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVerifiedBanner(false)}
                  className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* New Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-sans"
                  placeholder="Tối thiểu 6 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* 3-Segment Password Strength Bar */}
              {newPassword && (
                <div className="pt-1 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-normal">Độ an toàn:</span>
                    <span className={`font-semibold ${passwordStrength.textColor}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1.5 h-1.5">
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'
                    }`} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span className={passwordChecks.hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      ✓ Ít nhất 6 ký tự
                    </span>
                    <span className={passwordChecks.hasNumberOrSpecial ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                      ✓ Chứa số hoặc ký tự
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-sans"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
                  title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-rose-500 font-medium pl-0.5">
                  Mật khẩu xác nhận chưa trùng khớp.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={resetMutation.isPending || !!successMessage || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {resetMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Xác nhận & Lưu mật khẩu <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        )}

        {/* Back / Navigation links */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-4">
          <Link to="/login" className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
          </Link>

          <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline">
            Đăng ký tài khoản
          </Link>
        </div>
      </div>
    </AuthBackground>
  );
};

export default ForgotPasswordPage;