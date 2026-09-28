import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Clock,
  Search,
  Menu, X, Send, Paperclip, MessageSquare,
  Shield, ChevronDown, 
  Info,
  Laptop, Wifi, KeyRound, FileCode, CheckCircle2
} from 'lucide-react';
import { ticketApi } from '../services/ticketApi';

interface PublicTicket {
  id?: string;
  ticket_code: string;
  title: string;
  category_name: string;
  priority: string;
  status: string;
  assigned_agent_name?: string | null;
  resolution_due_at?: string | null;
  created_at?: string | null;
}

const DEFAULT_SAMPLE_TICKETS: PublicTicket[] = [
  {
    ticket_code: 'TCK-1001',
    title: 'Mất kết nối mạng VPN văn phòng từ xa',
    category_name: 'Mạng & VPN',
    priority: 'P1',
    status: 'PROCESSING',
    assigned_agent_name: 'Phạm Quốc Tuấn (IT)',
    resolution_due_at: 'Còn 35 phút'
  },
  {
    ticket_code: 'TCK-1002',
    title: 'Yêu cầu kết nối và cài driver máy in tầng 2',
    category_name: 'Thiết bị & Máy in',
    priority: 'P3',
    status: 'RESOLVED',
    assigned_agent_name: 'Nguyễn Văn Kỹ Thuật',
    resolution_due_at: 'Hoàn tất đúng hạn'
  },
  {
    ticket_code: 'TCK-1003',
    title: 'Không nhận được mã xác thực OTP đăng nhập email',
    category_name: 'Tài khoản & Xác thực',
    priority: 'P2',
    status: 'WAITING_CUSTOMER',
    assigned_agent_name: 'Trần Minh Anh (Support)',
    resolution_due_at: 'Còn 1h 45m'
  },
  {
    ticket_code: 'TCK-1004',
    title: 'Nâng cấp phần mềm kế toán và cấu hình chữ ký số',
    category_name: 'Phần mềm Kế toán',
    priority: 'P2',
    status: 'PROCESSING',
    assigned_agent_name: 'Lê Hoàng Nam (IT)',
    resolution_due_at: 'Còn 2h 10m'
  }
];

const SERVICE_CATEGORIES = [
  {
    icon: Wifi,
    title: 'Mạng, Internet & VPN',
    desc: 'Sự cố WiFi văn phòng, cấu hình kết nối VPN từ xa và đường truyền nội bộ.'
  },
  {
    icon: Laptop,
    title: 'Thiết bị & Phần cứng',
    desc: 'Hỗ trợ máy tính, laptop cá nhân, màn hình, máy in và thiết bị ngoại vi.'
  },
  {
    icon: KeyRound,
    title: 'Tài khoản & Quyền truy cập',
    desc: 'Cấp lại mật khẩu, kích hoạt tài khoản email nội bộ và phân quyền tài nguyên.'
  },
  {
    icon: FileCode,
    title: 'Phần mềm & Ứng dụng',
    desc: 'Cài đặt bộ phần mềm văn phòng, chữ ký số, ERP và khắc phục lỗi ứng dụng.'
  }
];

const FAQS = [
  {
    q: 'Tôi có thể gửi những loại yêu cầu hỗ trợ nào qua cổng này?',
    a: 'Bạn có thể gửi mọi vấn đề kỹ thuật liên quan đến công việc: tài khoản đăng nhập, lỗi phần mềm, mất kết nối mạng/VPN, cấu hình máy tính, thiết bị ngoại vi (chuột, bàn phím, máy in) và xin cấp quyền tài nguyên.'
  },
  {
    q: 'Bao lâu thì yêu cầu của tôi được kỹ thuật viên phản hồi?',
    a: 'Hệ thống áp dụng cam kết thời gian (SLA) minh bạch: các sự cố nghiêm trọng (P1) được phản hồi trong vòng 15-30 phút; các yêu cầu thông thường (P2-P4) được tiếp nhận và xử lý trong 2 đến 4 giờ làm việc.'
  },
  {
    q: 'Làm thế nào để đính kèm ảnh chụp màn hình thông báo lỗi?',
    a: 'Tại biểu mẫu gửi yêu cầu hoặc ngay trong khung trao đổi, bạn chỉ cần bấm nút "Đính kèm ảnh minh chứng" để tải lên tối đa 5 ảnh (định dạng PNG, JPG, WEBP, tối đa 10 MB/ảnh). Kỹ thuật viên sẽ nhìn thấy trực tiếp ảnh này để chẩn đoán nhanh.'
  },
  {
    q: 'Sau khi gửi yêu cầu, tôi theo dõi tiến độ xử lý như thế nào?',
    a: 'Mỗi yêu cầu được cấp một mã Ticket duy nhất (ví dụ: TCK-1001). Bạn có thể đăng nhập để xem trạng thái cập nhật theo thời gian thực (Mới tạo → Đang xử lý → Chờ thông tin → Đã giải quyết) và nhận email thông báo khi có phản hồi mới.'
  },
  {
    q: 'Nếu tôi quên mật khẩu tài khoản thì phải làm sao?',
    a: 'Bạn chỉ cần bấm vào "Quên mật khẩu" tại trang đăng nhập, điền địa chỉ email đã đăng ký. Hệ thống sẽ tự động gửi mã OTP xác thực qua email để bạn đặt lại mật khẩu mới an toàn và nhanh chóng.'
  }
];

export const LandingPage: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [recentTickets, setRecentTickets] = useState<PublicTicket[]>(DEFAULT_SAMPLE_TICKETS);
  const [activePreviewTab, setActivePreviewTab] = useState<'list' | 'timeline'>('list');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [searchTicketCode, setSearchTicketCode] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadTickets = async () => {
      try {
        const data = await ticketApi.getPublicRecentTickets();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setRecentTickets(data);
        }
      } catch {
        // Fallback to sample tickets seamlessly
      }
    };
    loadTickets();
    return () => { isMounted = false; };
  }, []);

  // Smooth Scroll Reveal Engine: Triggers natural entrance animations as user scrolls down
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-scale');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [recentTickets, activePreviewTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTicketCode.trim()) {
      setSearchResult(null);
      return;
    }
    const query = searchTicketCode.trim().toUpperCase();
    const found = recentTickets.find(t => t.ticket_code.toUpperCase().includes(query));
    if (found) {
      setSearchResult(`Tìm thấy ticket [${found.ticket_code}]: "${found.title}" — Trạng thái: ${getStatusBadge(found.status).label} (${found.resolution_due_at || 'Đang xử lý'})`);
    } else {
      setSearchResult(`Mã yêu cầu "${query}" chưa có trong danh sách công khai gần đây. Vui lòng đăng nhập để xem toàn bộ ticket cá nhân của bạn.`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return { label: 'Mới tạo', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'PROCESSING':
        return { label: 'Đang xử lý', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'WAITING_CUSTOMER':
        return { label: 'Chờ phản hồi', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'RESOLVED':
        return { label: 'Đã giải quyết', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CLOSED':
        return { label: 'Đã hoàn tất', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'P1':
        return { label: 'Khẩn cấp', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'P2':
        return { label: 'Ưu tiên cao', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'P3':
        return { label: 'Tiêu chuẩn', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      default:
        return { label: 'Bình thường', bg: 'bg-slate-50 text-slate-600 border-slate-200' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. TOP NAVBAR (ENTERPRISE SERVICE DESK) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Logo with AI Mascot Emblem */}
          <Link to="/" className="flex items-center gap-3 min-w-0 group" aria-label="Trang chủ Cổng Hỗ trợ IT Service Desk">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
              <img 
                src="/avatar/AI_support.svg" 
                alt="IT Service Desk Logo" 
                className="w-full h-full object-contain filter drop-shadow-xs group-hover:scale-105 transition-transform duration-200" 
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-lg text-slate-900 leading-tight block truncate group-hover:text-blue-600 transition-colors tracking-tight">
                IT Service Desk
              </span>
              <span className="text-[11px] text-slate-500 font-medium block truncate">
                Cổng Tiếp Nhận & Khắc Phục Sự Cố Kỹ Thuật
              </span>
            </div>
          </Link>

          {/* Clean Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Điều hướng chính">
            <a href="#danh-muc" className="hover:text-blue-600 transition-colors">
              Danh mục hỗ trợ
            </a>
            <a href="#quy-trinh" className="hover:text-blue-600 transition-colors">
              Quy trình gửi
            </a>
            <a href="#theo-doi" className="hover:text-blue-600 transition-colors">
              Tra cứu tiến độ
            </a>
            <a href="#sla" className="hover:text-blue-600 transition-colors">
              Cam kết SLA
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">
              Câu hỏi thường gặp
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100/80 rounded-md transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              to="/tickets/create"
              className="inline-flex items-center justify-center px-3.5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Gửi Yêu Cầu Hỗ Trợ
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex sm:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              aria-label="Mở danh mục điều hướng di động"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3">
            <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a 
                href="#danh-muc" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-slate-100"
              >
                Danh mục hỗ trợ
              </a>
              <a 
                href="#quy-trinh" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-slate-100"
              >
                Quy trình gửi
              </a>
              <a 
                href="#theo-doi" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-slate-100"
              >
                Tra cứu tiến độ
              </a>
              <a 
                href="#sla" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-slate-100"
              >
                Cam kết SLA
              </a>
              <a 
                href="#faq" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-slate-100"
              >
                Câu hỏi thường gặp
              </a>
            </nav>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full text-center py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Đăng nhập
              </Link>
              <Link
                to="/tickets/create"
                className="w-full text-center py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
              >
                Gửi Yêu Cầu Hỗ Trợ Ngay
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 2. COMPACT, GROUNDED HERO SECTION */}
      <section className="bg-white border-b border-slate-200 pt-10 pb-10 md:pt-14 md:pb-14 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Main Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-[40px] font-bold text-slate-900 tracking-tight leading-tight reveal-on-scroll">
            Cổng Tiếp Nhận Hỗ Trợ & Khắc Phục Sự Cố Kỹ Thuật
          </h1>

          {/* Subtitle */}
          <p className="mt-3.5 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed reveal-on-scroll delay-75">
            Hệ thống ghi nhận tập trung sự cố phần mềm, thiết bị, mạng nội bộ và tài khoản. 
            Tự động cấp mã ticket định danh, đính kèm ảnh chụp lỗi và theo dõi thời gian cam kết xử lý rõ ràng.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 reveal-on-scroll delay-150">
            <Link
              to="/tickets/create"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors hover:scale-[1.02]"
            >
              <Send className="w-4 h-4 mr-2" />
              Gửi Yêu Cầu Hỗ Trợ Mới
            </Link>
            <a
              href="#theo-doi"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-2xs transition-colors hover:scale-[1.02]"
            >
              <Search className="w-4 h-4 mr-2 text-slate-500" />
              Tra Cứu Tiến Độ Ticket
            </a>
          </div>

          {/* Concrete Operational Micro-strip */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-slate-500 reveal-on-scroll delay-200">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Tiếp nhận: <strong className="text-slate-700 font-semibold">08:00 – 18:00 (T2 – T6)</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sự cố khẩn cấp (P1): <strong className="text-slate-700 font-semibold">Phản hồi 15–30 phút</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Cấp mã ticket tức thì
            </span>
          </div>
        </div>
      </section>

      {/* 3. CORE SERVICE CATEGORIES */}
      <section id="danh-muc" className="py-10 md:py-12 bg-slate-50/70 border-b border-slate-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 pb-2 border-b border-slate-200/80 gap-2 reveal-on-scroll">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Nhóm Sự Cố Tiếp Nhận Hỗ Trợ
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Chọn đúng danh mục để yêu cầu được chuyển trực tiếp đến kỹ thuật viên chuyên môn.
              </p>
            </div>
            <Link to="/tickets/create" className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center hover:underline shrink-0">
              Tạo ticket cho nhóm khác →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICE_CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              const delayClass = idx === 0 ? 'delay-75' : idx === 1 ? 'delay-150' : idx === 2 ? 'delay-200' : 'delay-250';
              return (
                <Link
                  key={idx}
                  to="/tickets/create"
                  className={`bg-white p-4 rounded-md border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between group reveal-on-scroll ${delayClass} hover:-translate-y-1`}
                >
                  <div>
                    <div className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-blue-600">
                    <span>Gửi sự cố nhóm này</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. REALISTIC LIVE TICKET PREVIEW & TRACKER */}
      <section id="theo-doi" className="py-12 md:py-16 bg-white border-b border-slate-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-8 reveal-on-scroll">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Bảng Theo Dõi & Tra Cứu Tiến Độ Ticket
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Mọi yêu cầu tiếp nhận qua cổng Service Desk đều được gán mã định danh và theo dõi thời gian cam kết xử lý công khai.
            </p>
          </div>

          {/* Quick Search Bar with Sample Tags */}
          <div className="max-w-xl mx-auto mb-8 reveal-on-scroll delay-100">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nhập mã ticket cần tra cứu (ví dụ: TCK-1001)..."
                  value={searchTicketCode}
                  onChange={(e) => setSearchTicketCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shrink-0 shadow-2xs transition-colors"
              >
                Tra cứu
              </button>
            </form>
            
            {/* Quick Filter Tag Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-slate-500">
              <span>Mã mẫu thử nghiệm:</span>
              {['TCK-1001', 'TCK-1002', 'TCK-1003', 'TCK-1004'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setSearchTicketCode(code);
                    const found = recentTickets.find(t => t.ticket_code === code);
                    if (found) {
                      setSearchResult(`Tìm thấy ticket [${found.ticket_code}]: "${found.title}" — Trạng thái: ${getStatusBadge(found.status).label} (${found.resolution_due_at || 'Đang xử lý'})`);
                    }
                  }}
                  className="font-mono text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                >
                  {code}
                </button>
              ))}
            </div>

            {searchResult && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs sm:text-sm text-blue-900 flex items-start gap-2 animate-in fade-in duration-200">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{searchResult}</span>
              </div>
            )}
          </div>

          {/* Interactive 3D Dashboard Table Container (Image 1) */}
          <div className="tracker-3d-stage reveal-on-scroll delay-150">
            <div className="tracker-3d-card">
              
              {/* Window Bar & Tabs */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="ml-1 text-xs font-semibold text-slate-700">
                    Cổng Thông Tin Theo Dõi Yêu Cầu Kỹ Thuật
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('list')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activePreviewTab === 'list'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Danh sách yêu cầu mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('timeline')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activePreviewTab === 'timeline'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Chi tiết tiến trình mẫu
                  </button>
                </div>
              </div>

              {/* Tab Content 1: Ticket Table View */}
              {activePreviewTab === 'list' && (
                <div>
                  {/* Desktop Table: Responsive without any clipping */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4 w-[110px]">Mã Ticket</th>
                          <th className="py-3 px-4">Nội dung yêu cầu</th>
                          <th className="py-3 px-4 w-[150px]">Danh mục</th>
                          <th className="py-3 px-4 w-[110px]">Mức ưu tiên</th>
                          <th className="py-3 px-4 w-[120px]">Trạng thái</th>
                          <th className="py-3 px-4 w-[150px]">Cam kết thời hạn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {recentTickets.map((t, idx) => {
                          const statusBadge = getStatusBadge(t.status);
                          const priorityBadge = getPriorityBadge(t.priority);
                          return (
                            <tr key={t.id || idx} className="table-row-3d-elevate cursor-pointer group">
                              <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap group-hover:text-blue-700 transition-colors">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  {t.ticket_code}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-900">
                                <div className="line-clamp-1 group-hover:text-blue-950 transition-colors">{t.title}</div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="inline-block px-2.5 py-0.5 bg-slate-100 group-hover:bg-white rounded text-slate-700 font-medium text-[11px] shadow-2xs transition-colors">
                                  {t.category_name}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${priorityBadge.bg} shadow-2xs`}>
                                  {priorityBadge.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.bg} shadow-2xs`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                  {statusBadge.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-[11px] font-medium font-mono">
                                {t.resolution_due_at || 'Đang xử lý'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile / Tablet Card View (< 768px): Zero clipping */}
                  <div className="md:hidden divide-y divide-slate-100 p-3 space-y-2.5">
                    {recentTickets.slice(0, 4).map((t, idx) => {
                      const statusBadge = getStatusBadge(t.status);
                      const priorityBadge = getPriorityBadge(t.priority);
                      return (
                        <div key={t.id || idx} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-blue-600">
                              {t.ticket_code}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityBadge.bg}`}>
                                {priorityBadge.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${statusBadge.bg}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 leading-snug">
                            {t.title}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                              {t.category_name}
                            </span>
                            <span className="font-mono text-slate-600">
                              {t.resolution_due_at || 'Đang xử lý'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab Content 2: Process Timeline Stepper */}
              {activePreviewTab === 'timeline' && (
                <div className="p-6 sm:p-8">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-xs font-bold text-slate-500">Mã minh họa: <span className="text-blue-600 font-mono">TCK-1001</span></div>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-bold">
                        Đang Xử Lý (Bước 3/4)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                      {/* Step 1 */}
                      <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-left">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                            ✓
                          </span>
                          <span className="text-xs font-bold text-emerald-800">1. Tiếp nhận</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Yêu cầu được gửi lúc 09:30, cấp mã ticket tự động.</p>
                      </div>

                      {/* Step 2 */}
                      <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-left">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                            ✓
                          </span>
                          <span className="text-xs font-bold text-emerald-800">2. Phân loại</span>
                        </div>
                        <p className="text-[11px] text-slate-600">Xác định mức P1 Khẩn cấp, cam kết SLA hoàn tất trước 11:30.</p>
                      </div>

                      {/* Step 3 - Active Step */}
                      <div className="p-4 rounded-lg bg-blue-50 border-2 border-blue-600 text-left shadow-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            3
                          </span>
                          <span className="text-xs font-bold text-blue-900">3. Đang xử lý</span>
                        </div>
                        <p className="text-[11px] text-blue-950 font-medium">KTV Phạm Quốc Tuấn đang kiểm tra cấu hình mạng VPN.</p>
                      </div>

                      {/* Step 4 */}
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left opacity-70">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold">
                            4
                          </span>
                          <span className="text-xs font-bold text-slate-600">4. Nghiệm thu</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Xác nhận khắc phục thành công và đánh giá chất lượng.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Footer Helper Note */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-1">
                <span>* Dữ liệu mô phỏng quy trình theo dõi SLA. Khi gửi ticket thật, bạn sẽ nhận mã riêng và theo dõi trực tiếp.</span>
                <Link to="/tickets/create" className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center hover:underline">
                  Gửi yêu cầu hỗ trợ mới →
                </Link>
              </div>
            </div>
            <div className="floor-shadow-3d" />
          </div>
        </div>
      </section>

      {/* 5. 4-STEP OPERATIONAL WORKFLOW (LINEAR INTEGRATED PIPELINE) */}
      <section id="quy-trinh" className="py-12 md:py-16 bg-slate-50 border-b border-slate-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-slate-200/80 gap-3 reveal-on-scroll">
            <div>
              <span className="text-xs font-bold tracking-wider text-blue-600 uppercase">
                Quy trình tiếp nhận chuẩn ITIL
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                4 Bước Gửi & Tiếp Nhận Xử Lý Yêu Cầu
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Quy trình chuẩn hóa từng bước giúp phân loại chính xác, tránh sót việc và theo sát cam kết SLA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="relative pl-6 md:pl-0 md:pt-6 border-l-2 md:border-l-0 md:border-t-2 border-blue-600 reveal-on-scroll delay-75">
              <div className="absolute -left-[9px] md:-top-[9px] md:left-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-slate-50" />
              <div className="text-[11px] font-mono font-bold text-blue-600 uppercase tracking-wider">Bước 01</div>
              <h3 className="text-sm font-bold text-slate-900 mt-1.5">Mô tả sự cố & Đính kèm ảnh</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Chọn đúng nhóm sự cố, mô tả hiện tượng gặp phải và tải ảnh chụp màn hình thông báo lỗi (PNG, JPG tối đa 10 MB).
              </p>
              <div className="mt-3 text-[11px] text-slate-500">
                Thao tác: <strong className="text-slate-700">~60 giây</strong>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-6 md:pl-0 md:pt-6 border-l-2 md:border-l-0 md:border-t-2 border-slate-300 reveal-on-scroll delay-150">
              <div className="absolute -left-[9px] md:-top-[9px] md:left-0 w-4 h-4 rounded-full bg-slate-400 ring-4 ring-slate-50" />
              <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Bước 02</div>
              <h3 className="text-sm font-bold text-slate-900 mt-1.5">Nhận mã Ticket & Gán SLA</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Hệ thống tự động cấp mã định danh (TCK-XXXX), gửi email xác nhận và xác định hạn mức xử lý theo độ khẩn cấp.
              </p>
              <div className="mt-3 text-[11px] text-slate-500">
                Cấp mã: <strong className="text-slate-700">Tức thì qua email</strong>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-6 md:pl-0 md:pt-6 border-l-2 md:border-l-0 md:border-t-2 border-slate-300 reveal-on-scroll delay-200">
              <div className="absolute -left-[9px] md:-top-[9px] md:left-0 w-4 h-4 rounded-full bg-slate-400 ring-4 ring-slate-50" />
              <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Bước 03</div>
              <h3 className="text-sm font-bold text-slate-900 mt-1.5">Trao đổi & Khắc phục sự cố</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Kỹ thuật viên chuyên trách tiếp nhận, trao đổi 2 chiều trực tiếp trong ticket hoặc hỗ trợ từ xa qua TeamViewer / UltraView.
              </p>
              <div className="mt-3 text-[11px] text-slate-500">
                Phản hồi: <strong className="text-slate-700">15m – 2h theo mức P1-P4</strong>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-6 md:pl-0 md:pt-6 border-l-2 md:border-l-0 md:border-t-2 border-slate-300 reveal-on-scroll delay-250">
              <div className="absolute -left-[9px] md:-top-[9px] md:left-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-slate-50" />
              <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider">Bước 04</div>
              <h3 className="text-sm font-bold text-slate-900 mt-1.5">Nghiệm thu & Đóng ticket</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Người dùng kiểm tra kết quả, bấm xác nhận hoàn tất để đóng ticket và gửi đánh giá mức độ hài lòng về chất lượng phục vụ.
              </p>
              <div className="mt-3 text-[11px] text-slate-500">
                Đánh giá: <strong className="text-slate-700">Chất lượng 1 – 5 sao</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONCRETE SLA MATRIX & TECHNICAL POLICIES (IMAGE 2 - 3D ANIMATION) */}
      <section id="sla" className="py-12 md:py-16 bg-white border-b border-slate-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-3 border-b border-slate-200 gap-3 reveal-on-scroll">
            <div>
              <span className="text-xs font-bold tracking-wider text-blue-600 uppercase">
                Tiêu chuẩn vận hành
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Khung Cam Kết Thời Gian Xử Lý (SLA) & Quy Chuẩn Kỹ Thuật
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Mọi sự cố đều được phân định rõ ràng về thời hạn phản hồi, mức độ ưu tiên và tiêu chuẩn bàn giao kỹ thuật.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 cols: 3D SLA Matrix Table */}
            <div className="lg:col-span-7 bg-slate-50 rounded-lg border border-slate-200 p-5 sla-3d-stage reveal-on-scroll delay-100">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Bảng Phân Định Cấp Độ Sự Cố & Cam Kết SLA
                </h3>
                <span className="text-[11px] text-slate-500">Giờ hành chính: 08:00 – 18:00</span>
              </div>

              <div className="space-y-3">
                {/* P1 */}
                <div className="sla-card-3d sla-card-3d-p1 p-3.5 bg-white rounded-md border border-slate-200 border-l-4 border-l-rose-500 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      P1 - Khẩn Cấp (Sự cố diện rộng)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Phản hồi: 15–30 phút
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Mất kết nối mạng toàn công ty, sập máy chủ email/ERP, gián đoạn dịch vụ thanh toán. Kỹ thuật viên trực chiến hỗ trợ 24/7/365.
                  </p>
                </div>

                {/* P2 */}
                <div className="sla-card-3d sla-card-3d-p2 p-3.5 bg-white rounded-md border border-slate-200 border-l-4 border-l-amber-500 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      P2 - Ưu Tiên Cao (Phòng ban / Nhóm)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Phản hồi: ≤ 1 giờ
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Lỗi máy in mạng văn phòng, phần mềm kế toán/bán hàng bị gián đoạn, lỗi VPN chi nhánh. Cam kết xử lý dứt điểm trong vòng 4 giờ.
                  </p>
                </div>

                {/* P3 */}
                <div className="sla-card-3d sla-card-3d-p3 p-3.5 bg-white rounded-md border border-slate-200 border-l-4 border-l-blue-500 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      P3 - Tiêu Chuẩn (Sự cố cá nhân)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Phản hồi: ≤ 2 giờ
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Lỗi hệ điều hành, cài đặt ứng dụng chuyên môn, cấp quyền thư mục chia sẻ nội bộ. Cam kết hoàn tất trong vòng 8 giờ làm việc.
                  </p>
                </div>

                {/* P4 */}
                <div className="sla-card-3d sla-card-3d-p4 p-3.5 bg-white rounded-md border border-slate-200 border-l-4 border-l-slate-400 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      P4 - Yêu Cầu Định Kỳ & Thiết Bị
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Phản hồi: ≤ 4 giờ
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Cấp phát chuột/bàn phím thay thế, vệ sinh bảo dưỡng máy tính, cấp tài khoản cho nhân viên mới. Xử lý trong 24 giờ làm việc.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 5 cols: 3D Technical Rules & Tooling Cards */}
            <div className="lg:col-span-5 space-y-4 reveal-on-scroll delay-150">
              <div className="policy-card-3d border border-slate-200 rounded-lg p-5 bg-white group cursor-pointer">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="policy-icon-3d w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Đính kèm minh chứng lỗi trực quan
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cho phép tải lên tối đa <strong>5 tệp đính kèm</strong> (ảnh chụp thông báo lỗi định dạng PNG, JPG, WEBP hoặc file log hệ thống) với dung lượng tới <strong>10 MB/tệp</strong>. Kỹ thuật viên hiểu đúng lỗi ngay mà không cần bạn mô tả dài dòng.
                </p>
              </div>

              <div className="policy-card-3d border border-slate-200 rounded-lg p-5 bg-white group cursor-pointer">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="policy-icon-3d w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Lưu vết trao đổi & Nhật ký xử lý
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Toàn bộ phản hồi, ghi chú hướng dẫn và thời điểm cập nhật của kỹ thuật viên đều được lưu trữ theo từng ticket định danh. Tránh thất lạc thông tin như khi nhắn tin riêng qua các ứng dụng chat cá nhân.
                </p>
              </div>

              <div className="policy-card-3d border border-slate-200 rounded-lg p-5 bg-white group cursor-pointer">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="policy-icon-3d w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Bảo mật xác thực & Khôi phục mật khẩu
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hệ thống phân quyền truy cập nghiêm ngặt với xác thực JWT an toàn. Cán bộ nhân viên có thể tự đổi hoặc khôi phục mật khẩu cổng Service Desk bất cứ lúc nào thông qua mã OTP gửi về email cơ quan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. INTERACTIVE FAQ ACCORDION */}
      <section id="faq" className="py-16 md:py-20 bg-slate-50 border-b border-slate-200 scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 reveal-on-scroll">
            <span className="text-xs font-bold tracking-wider text-blue-600 uppercase">
              Giải đáp thắc mắc
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Câu Hỏi Thường Gặp
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Những thông tin thiết thực giúp bạn gửi yêu cầu và nhận hỗ trợ thuận tiện nhất.
            </p>
          </div>

          <div className="space-y-3 reveal-on-scroll delay-100">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden transition-colors hover:border-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 focus:outline-hidden hover:bg-slate-50/50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {faq.q}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. CLEAN BOTTOM CTA (ELEGANT & GROUNDED) */}
      <section className="py-12 md:py-14 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center reveal-on-scroll">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Gặp Trục Trặc Kỹ Thuật? Gửi Yêu Cầu Để Được Hỗ Trợ Kịp Thời
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto mt-2.5 leading-relaxed">
            Chỉ mất 60 giây để tạo ticket. Hệ thống tự động phân loại và chuyển đến kỹ thuật viên chuyên trách theo đúng khung cam kết thời gian (SLA).
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tickets/create"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-all hover:scale-[1.02]"
            >
              <Send className="w-4 h-4 mr-2" />
              Gửi Yêu Cầu Hỗ Trợ Mới
            </Link>
            <a
              href="#theo-doi"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-2xs transition-all hover:scale-[1.02]"
            >
              <Search className="w-4 h-4 mr-2 text-slate-500" />
              Tra Cứu Tiến Độ Ticket
            </a>
          </div>
        </div>
      </section>

      {/* 9. STRUCTURED 3-COLUMN USER-FACING FOOTER */}
      <footer className="bg-slate-50 text-xs text-slate-500 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 reveal-on-scroll">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            {/* Col 1: Brand & Help Desk Emblem */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  <img 
                    src="/avatar/AI_support.svg" 
                    alt="IT Service Desk Logo" 
                    className="w-full h-full object-contain filter drop-shadow-xs" 
                  />
                </div>
                <span className="font-bold text-slate-900 text-sm">IT Service Desk</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed max-w-md">
                Cổng tiếp nhận và khắc phục sự cố công nghệ thông tin nội bộ. Phục vụ toàn thể cán bộ nhân viên với quy trình chuẩn hóa và cam kết SLA minh bạch.
              </p>
            </div>

            {/* Col 2: User Shortcuts */}
            <div>
              <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">Hỗ trợ người dùng</h4>
              <ul className="space-y-2">
                <li><Link to="/tickets/create" className="hover:text-blue-600 transition-colors">Gửi yêu cầu hỗ trợ mới</Link></li>
                <li><a href="#theo-doi" className="hover:text-blue-600 transition-colors">Tra cứu tiến độ ticket</a></li>
                <li><a href="#sla" className="hover:text-blue-600 transition-colors">Cam kết thời hạn (SLA)</a></li>
                <li><a href="#faq" className="hover:text-blue-600 transition-colors">Câu hỏi thường gặp (FAQ)</a></li>
              </ul>
            </div>

            {/* Col 3: Service Hours */}
            <div>
              <h4 className="font-bold text-slate-900 mb-3 text-xs uppercase tracking-wider">Thời gian làm việc</h4>
              <p className="text-slate-600 leading-relaxed mb-1">
                Thứ Hai – Thứ Sáu: <strong>08:00 – 18:00</strong>
              </p>
              <p className="text-slate-600 leading-relaxed">
                Sự cố khẩn cấp (P1): <strong>Trực hỗ trợ 24/7</strong>
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 text-center sm:text-left text-[11px] text-slate-500">
            © 2026 IT Service Desk. Cổng tiếp nhận dịch vụ CNTT nội bộ.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
