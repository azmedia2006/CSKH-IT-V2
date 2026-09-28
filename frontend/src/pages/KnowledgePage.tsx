import { authApi } from "../services/authApi";
import { api } from "../services/api";
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../services/knowledgeApi';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from '../components/Layout';
import { 
  BookOpen, Search, Ticket as TicketIcon, Sparkles, HelpCircle, 
  ChevronRight, ChevronLeft, Bot, ArrowRight, Printer,
  Shield, Cpu, Wifi, Lock, X, Check, ThumbsUp, ThumbsDown, Copy,
  Plus, Trash2, Pencil, ChevronDown, ChevronUp, FileText, CheckCircle2, MessageCircleQuestion,
  Eye
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { MarkdownView } from '../components/MarkdownView';

interface Article {
  id: number | string;
  category: string;
  categoryLabel: string;
  title: string;
  desc: string;
  views: string;
  time: string;
  badge?: string;
  content: string;
  steps: string[];
  isCustom?: boolean;
  isSampleUnapproved?: boolean;
}

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const DEFAULT_ARTICLES: Article[] = [
  {
    "id": 1,
    "category": "DEVICE",
    "categoryLabel": "Thiết bị & Máy in",
    "title": "Hướng dẫn cài đặt Driver máy in văn phòng và kết nối qua mạng IP nội bộ",
    "desc": "Các bước thêm máy in Canon / HP / Ricoh trên Windows 10/11 và macOS mà không cần đĩa cài.",
    "views": "3.5k lượt xem",
    "time": "Cập nhật 1 ngày trước",
    "badge": "Phổ biến",
    "content": "Tất cả các tầng văn phòng của AZ Media 247 đều được trang bị máy in mạng đa năng tốc độ cao. Nhân viên có thể tự cài đặt theo địa chỉ IP máy in của tầng mình mà không cần gọi IT.",
    "steps": [
      "Vào Windows Settings > Devices > Printers & Scanners > Chọn 'Add a printer or scanner'.",
      "Chọn 'The printer that I want isn't listed' > Chọn 'Add a printer using an IP address or hostname'.",
      "Nhập IP máy in văn phòng (Tầng 1: 192.168.1.200, Tầng 2: 192.168.1.201, Tầng 3: 192.168.1.202).",
      "Chọn Driver phù hợp (Canon Generic Plus UFR II hoặc HP Universal Print Driver) và in trang kiểm tra (Print Test Page)."
    ]
  },
  {
    "id": 2,
    "category": "DEVICE",
    "categoryLabel": "Thiết bị & Máy in",
    "title": "Xử lý lỗi máy in báo Offline hoặc kẹt giấy (Paper Jam)",
    "desc": "Cách reset dịch vụ Print Spooler và gỡ kẹt giấy an toàn không làm rách bao lụa.",
    "views": "2.1k lượt xem",
    "time": "Cập nhật 3 ngày trước",
    "badge": "Khắc phục nhanh",
    "content": "Lỗi máy in báo Offline thường xảy ra khi hàng đợi in (Print Queue) bị treo hoặc khay giấy bị lệch cảm biến.",
    "steps": [
      "Mở cửa sổ Run (Win + R), gõ services.msc, tìm dịch vụ 'Print Spooler' > Nhấp chuột phải chọn 'Restart'.",
      "Kiểm tra khay nạp giấy xem giấy có bị ẩm, nhăn hoặc đặt quá vạch giới hạn MAX không.",
      "Nếu máy báo kẹt giấy (Jam in cartridge area), mở nắp hông theo chiều mũi tên, nhẹ nhàng rút giấy kẹt theo chiều quay của trục cuốn (tuyệt đối không giật ngược chiều).",
      "Đóng chặt nắp máy in, nhấn nút Resume/OK trên máy để tiếp tục in."
    ]
  },
  {
    "id": 3,
    "category": "AUTH",
    "categoryLabel": "Tài khoản & Xác thực",
    "title": "Hướng dẫn khôi phục mật khẩu tài khoản nội bộ AZ Media 247",
    "desc": "Các bước reset mật khẩu qua email công ty và kích hoạt lại ứng dụng xác thực nhanh chóng.",
    "views": "4.2k lượt xem",
    "time": "Cập nhật hôm nay",
    "badge": "Phổ biến",
    "content": "Để bảo vệ an toàn thông tin theo chuẩn ITIL & ISO 27001 của AZ Media 247, mật khẩu tài khoản cần có độ phức tạp cao và cập nhật định kỳ.",
    "steps": [
      "Truy cập cổng đăng nhập nội bộ tại azmedia247.com/login và nhấn vào 'Quên mật khẩu'.",
      "Nhập địa chỉ email công vụ của bạn để hệ thống gửi mã OTP xác thực khôi phục qua hòm thư.",
      "Nhập mã OTP 6 số nhận được và thiết lập mật khẩu mới (tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt).",
      "Đăng nhập lại trên các ứng dụng liên kết (Outlook, Slack, Teams, VPN) với mật khẩu mới vừa đổi."
    ]
  },
  {
    "id": 4,
    "category": "NETWORK",
    "categoryLabel": "Mạng & VPN",
    "title": "Cách kết nối OpenVPN khi làm việc từ xa (Work from Home - WFH)",
    "desc": "Cài đặt cấu hình file .ovpn, xác thực 2 bước và xử lý lỗi không truy cập được server nội bộ.",
    "views": "3.8k lượt xem",
    "time": "Cập nhật 2 ngày trước",
    "badge": "Quan trọng",
    "content": "Tất cả nhân viên làm việc từ xa (WFH) bắt buộc phải bật OpenVPN trước khi truy cập tài nguyên cơ sở dữ liệu, file server và CRM nội bộ của AZ Media 247.",
    "steps": [
      "Tải ứng dụng OpenVPN Client phiên bản tương thích với hệ điều hành của bạn (Windows / macOS / Linux).",
      "Nhập file cấu hình vpn-azmedia247.ovpn được cấp bởi phòng IT ServiceDesk.",
      "Nhập tài khoản đăng nhập và mã Authenticator OTP khi kết nối.",
      "Kiểm tra biểu tượng OpenVPN chuyển sang màu xanh lá và truy cập thử cổng thông tin nội bộ."
    ]
  },
  {
    "id": 5,
    "category": "SECURITY",
    "categoryLabel": "Bảo mật & 2FA",
    "title": "Kích hoạt xác thực 2 yếu tố (2FA) bằng Google Authenticator",
    "desc": "Bảo mật tài khoản với 2FA và lưu trữ mã khôi phục dự phòng an toàn.",
    "views": "1.9k lượt xem",
    "time": "Cập nhật 3 ngày trước",
    "badge": "Bảo mật",
    "content": "Xác thực 2 lớp (2FA) giúp ngăn chặn 99.9% nguy cơ bị tấn công chiếm đoạt tài khoản ngay cả khi mật khẩu bị lộ lọt.",
    "steps": [
      "Tải ứng dụng Google Authenticator hoặc Microsoft Authenticator trên điện thoại thông minh.",
      "Đăng nhập tài khoản > Vào mục 'Hồ sơ cá nhân' > Chọn tab 'Bảo mật' > Nhấn 'Bật xác thực 2 bước'.",
      "Mở ứng dụng trên điện thoại và quét mã QR hiển thị trên màn hình máy tính.",
      "Lưu lại 5 mã dự phòng (Backup Codes) vào nơi an toàn đề phòng trường hợp mất hoặc đổi điện thoại."
    ]
  },
  {
    "id": 6,
    "category": "SOFTWARE",
    "categoryLabel": "Phần mềm & Cấp quyền",
    "title": "Quy trình xin cấp bản quyền phần mềm Microsoft 365, Adobe & JetBrains",
    "desc": "Hướng dẫn gửi ticket yêu cầu cấp key và thời gian phê duyệt tiêu chuẩn của IT Helpdesk.",
    "views": "2.4k lượt xem",
    "time": "Cập nhật 5 ngày trước",
    "badge": "Bản quyền",
    "content": "AZ Media 247 trang bị đầy đủ bản quyền phần mềm chuyên dụng cho nhân sự chính thức phục vụ công việc thiết kế, lập trình và truyền thông.",
    "steps": [
      "Vào mục 'Tạo Ticket' trên hệ thống ServiceDesk, chọn danh mục 'Phần mềm & Cấp quyền'.",
      "Chọn gói phần mềm cần cấp (Microsoft 365 Business, Adobe Creative Cloud, JetBrains All Products, Figma Enterprise).",
      "Đính kèm xác nhận (Approval) qua email hoặc tin nhắn của Trưởng bộ phận phụ trách.",
      "Đội ngũ IT Support sẽ kiểm tra license pool, cấp tài khoản và bàn giao key kích hoạt trong vòng 2-4 giờ làm việc."
    ]
  },
  {
    "id": 7,
    "category": "NETWORK",
    "categoryLabel": "Mạng & VPN",
    "title": "Khắc phục sự cố mạng Wifi văn phòng chập chờn hoặc không nhận IP",
    "desc": "Các lệnh giải phóng IP (ipconfig /release) và flush DNS trên máy trạm Windows / macOS.",
    "views": "3.1k lượt xem",
    "time": "Cập nhật 1 tuần trước",
    "content": "Sự cố kết nối Wifi văn phòng thường do xung đột địa chỉ IP cục bộ từ DHCP hoặc bộ nhớ đệm DNS cũ của máy tính.",
    "steps": [
      "Tắt Wifi trên thiết bị, chờ 5 giây rồi bật lại và chọn mạng 'AZMedia247-Enterprise-5G'.",
      "Trên Windows: Mở Command Prompt (cmd) dưới quyền Run as Administrator, gõ: 'ipconfig /flushdns' rồi gõ tiếp 'ipconfig /renew'.",
      "Trên macOS: Mở Terminal gõ lệnh: 'sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder' rồi nhập mật khẩu máy.",
      "Nếu vẫn không vào được mạng, khởi động lại máy hoặc liên hệ ngay hotline IT Tầng: Ext 101."
    ]
  },
  {
    "id": 8,
    "category": "SOFTWARE",
    "categoryLabel": "Phần mềm & Cấp quyền",
    "title": "Cài đặt và cấu hình chứng chỉ bảo mật SSL nội bộ trên trình duyệt",
    "desc": "Tải file .crt và cài đặt vào Trusted Root Certification Authorities để loại bỏ cảnh báo trình duyệt.",
    "views": "1.2k lượt xem",
    "time": "Cập nhật 2 tuần trước",
    "content": "Hướng dẫn loại bỏ thông báo cảnh báo bảo mật 'Kết nối của bạn không phải là kết nối riêng tư' khi truy cập các hệ thống quản trị nội bộ (*.azmedia247.com).",
    "steps": [
      "Tải chứng chỉ bảo mật gốc 'AZMediaRootCA.crt' từ cổng tài nguyên nội bộ.",
      "Nhấp đúp chuột vào file certificate vừa tải > Chọn 'Install Certificate...'.",
      "Chọn 'Local Machine' > Chọn 'Place all certificates in the following store' > Chọn thư mục 'Trusted Root Certification Authorities'.",
      "Nhấn Next > Finish > Khởi động lại toàn bộ trình duyệt Chrome hoặc Edge để áp dụng chứng chỉ mới."
    ]
  }
];

export const KnowledgePage = () => {
  const cachedRole = localStorage.getItem("user_role");
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const u = await authApi.getCurrentUser();
      if (u?.role_name) {
        localStorage.setItem("user_role", u.role_name);
      }
      return u;
    },
    staleTime: 5 * 60 * 1000
  });

  const userRole = currentUser?.role_name || cachedRole || "REQUESTER";
  const isRequester = userRole === "REQUESTER";
  const canManageArticles = userRole === "ADMIN" || userRole === "TEAM_LEAD" || userRole === "SUPPORT_AGENT";

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Real Persistent Views & Feedback Map from Backend
  const [statsMap, setStatsMap] = useState<Record<string, { views: number; helpful: number; not_helpful: number }>>(() => {
    try {
      const saved = localStorage.getItem('article_real_stats_map_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // User-scoped feedback: { [articleId]: 'yes' | 'no' }
  const userKey = currentUser?.id || currentUser?.email || 'default_user';
  const [userFeedbacks, setUserFeedbacks] = useState<Record<string, 'yes' | 'no'>>(() => {
    try {
      const saved = localStorage.getItem(`article_user_feedbacks_${userKey}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Đồng bộ feedback người dùng theo tài khoản
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`article_user_feedbacks_${userKey}`);
      setUserFeedbacks(saved ? JSON.parse(saved) : {});
    } catch {
      setUserFeedbacks({});
    }
  }, [userKey]);

  // Load stats from server
  const { data: serverStats, refetch: refetchStats } = useQuery({
    queryKey: ['articleStatsAll'],
    queryFn: knowledgeApi.getStats,
    staleTime: 30 * 1000
  });

  useEffect(() => {
    if (serverStats && Object.keys(serverStats).length > 0) {
      setStatsMap(serverStats);
      localStorage.setItem('article_real_stats_map_v1', JSON.stringify(serverStats));
    }
  }, [serverStats]);

  // Hàm mở bài viết và tăng lượt xem thực tế
  const handleOpenArticle = (art: Article) => {
    setReadingArticle(art);
    
    // Gọi API tăng lượt xem backend
    const artIdStr = String(art.id);
    knowledgeApi.recordView(artIdStr).then(res => {
      if (res?.views) {
        setStatsMap(prev => {
          const next = {
            ...prev,
            [artIdStr]: {
              ...(prev[artIdStr] || { helpful: 0, not_helpful: 0 }),
              views: res.views
            }
          };
          localStorage.setItem('article_real_stats_map_v1', JSON.stringify(next));
          return next;
        });
      }
    }).catch(() => {
      // Fallback local increment nếu offline
      setStatsMap(prev => {
        const cur = prev[artIdStr] || { views: 0, helpful: 0, not_helpful: 0 };
        const next = { ...prev, [artIdStr]: { ...cur, views: cur.views + 1 } };
        localStorage.setItem('article_real_stats_map_v1', JSON.stringify(next));
        return next;
      });
    });
  };

  // Hàm bình chọn Hữu ích / Chưa rõ
  const handleVoteFeedback = async (articleId: string | number, helpful: boolean) => {
    const artIdStr = String(articleId);
    const voteType: 'yes' | 'no' = helpful ? 'yes' : 'no';
    const prevVote = userFeedbacks[artIdStr];

    if (prevVote === voteType) return; // Đã vote rồi thì không vote trùng

    // Optimistic UI update
    setUserFeedbacks(prev => {
      const next = { ...prev, [artIdStr]: voteType };
      localStorage.setItem(`article_user_feedbacks_${userKey}`, JSON.stringify(next));
      return next;
    });

    setStatsMap(prev => {
      const cur = prev[artIdStr] || { views: 1, helpful: 0, not_helpful: 0 };
      const next = {
        ...prev,
        [artIdStr]: {
          ...cur,
          helpful: helpful ? cur.helpful + 1 : (prevVote === 'yes' ? Math.max(0, cur.helpful - 1) : cur.helpful),
          not_helpful: !helpful ? cur.not_helpful + 1 : (prevVote === 'no' ? Math.max(0, cur.not_helpful - 1) : cur.not_helpful),
        }
      };
      localStorage.setItem('article_real_stats_map_v1', JSON.stringify(next));
      return next;
    });

    try {
      const res = await knowledgeApi.submitFeedback(artIdStr, helpful);
      if (res?.message) {
        setToastMessage(helpful ? '✓ Cảm ơn bạn! Đã ghi nhận tài liệu hữu ích.' : '✓ Cảm ơn góp ý! IT sẽ tiếp tục hoàn thiện tài liệu.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e) {
      setToastMessage(helpful ? '✓ Đã ghi nhận: Hữu ích' : '✓ Đã ghi nhận: Chưa rõ');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Custom Articles State & Storage
  const [customArticles, setCustomArticles] = useState<Article[]>(() => {
    const saved = localStorage.getItem('custom_knowledge_articles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Modal State for adding new article
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('DEVICE');
  const [newDesc, setNewDesc] = useState('');
  const [newBadge, setNewBadge] = useState('Hướng dẫn');
  const [newContent, setNewContent] = useState('');
  const [stepInputs, setStepInputs] = useState<string[]>(['', '']);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: serverArticles, refetch: refetchArticles } = useQuery({
    queryKey: ['knowledgeArticles'],
    queryFn: knowledgeApi.getArticles,
  });
  const baseArticles = serverArticles && serverArticles.length > 0 ? serverArticles : DEFAULT_ARTICLES;
  const allArticles: Article[] = [...customArticles, ...baseArticles];

  const categoryIcons: Record<string, typeof BookOpen> = {
    DEVICE: Printer,
    AUTH: Lock,
    NETWORK: Wifi,
    SOFTWARE: Cpu,
    SECURITY: Shield,
  };
  const categories = [
    { id: 'ALL', label: 'Tất cả chủ đề', icon: BookOpen, count: allArticles.length },
    ...Array.from(new Map(allArticles.map(article => [article.category, article.categoryLabel])).entries())
      .map(([id, label]) => ({
        id,
        label,
        icon: categoryIcons[id] || BookOpen,
        count: allArticles.filter(article => article.category === id).length,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi')),
  ];

  const [searchParams] = useSearchParams();

  // Tự động mở bài viết khi có query param ?article=HW-011 hoặc ?id=HW-011 từ Chat Widget hoặc link
  useEffect(() => {
    const articleParam = searchParams.get('article') || searchParams.get('id');
    if (articleParam && allArticles.length > 0) {
      const cleanParam = articleParam.trim().toLowerCase();
      const target = allArticles.find(a => 
        String(a.id).toLowerCase() === cleanParam ||
        a.title.toLowerCase().includes(cleanParam)
      );
      if (target) {
        handleOpenArticle(target);
        if (target.category) {
          setSelectedCategory(target.category);
        }
      }
    }
  }, [searchParams, allArticles]);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = aiQuestion.trim() || searchQuery.trim();
    if (!query) return;

    setIsAskingAi(true);
    setAiAnswer(null);

    try {
      const resp = await api.post("/settings/ai/prompt-test", {
        prompt: `Người dùng tìm kiếm hướng dẫn trong Kho tri thức: "${query}". Dựa trên các tài liệu hỗ trợ IT Helpdesk và quy trình nội bộ, hãy tóm tắt và hướng dẫn ngắn gọn các bước xử lý bằng Tiếng Việt.`,
        temperature: 0.2
      });
      const reply = resp.data?.response || resp.data?.reply;
      if (reply) {
        setAiAnswer(reply);
      } else {
        throw new Error("No reply");
      }
    } catch (err) {
      setAiAnswer(
        `Dựa trên tài liệu kho tri thức IT ServiceDesk của AZ Media 247, để xử lý vấn đề "${query}":

` +
        `1. Kiểm tra nguồn điện, dây cáp kết nối và đường truyền mạng nội bộ/VPN.
` +
        `2. Thực hiện theo các bước chuẩn trong tài liệu hướng dẫn tương ứng bên dưới.
` +
        `3. Nếu cần hỗ trợ thêm, bạn có thể tạo Ticket để Kỹ thuật viên xử lý trực tiếp theo cam kết SLA.`
      );
    } finally {
      setIsAskingAi(false);
    }
  };

  const filteredArticles = allArticles.filter(art => {
    const matchesCat = selectedCategory === 'ALL' || art.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
                          art.title.toLowerCase().includes(query) || 
                          art.desc.toLowerCase().includes(query) ||
                          art.content.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / itemsPerPage));
  const paginatedArticles = filteredArticles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddStep = () => {
    setStepInputs(prev => [...prev, '']);
  };

  const handleStepChange = (index: number, val: string) => {
    setStepInputs(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveStep = (index: number) => {
    if (stepInputs.length <= 1) return;
    setStepInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    const validSteps = stepInputs.map(step => step.trim()).filter(Boolean);
    const payload = {
      category: newCategory,
      title: newTitle.trim(),
      desc: newDesc.trim(),
      badge: newBadge.trim() || undefined,
      content: newContent.trim() || newDesc.trim(),
      steps: validSteps.length ? validSteps : ['Liên hệ IT Service Desk để được hỗ trợ.'],
    };

    try {
      if (editingArticle) {
        await knowledgeApi.updateArticle(editingArticle.id, payload);
        setToastMessage('Đã cập nhật bài viết trong Kho tri thức.');
      } else {
        await knowledgeApi.createArticle(payload);
        setToastMessage('Đã lưu bài viết vào Kho tri thức.');
      }
      await refetchArticles();
      setEditingArticle(null);
      setNewTitle('');
      setNewDesc('');
      setNewContent('');
      setNewBadge('Hướng dẫn');
      setStepInputs(['', '']);
      setShowAddModal(false);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (error: any) {
      setToastMessage(error.response?.data?.detail || 'Không thể lưu bài viết. Vui lòng thử lại.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleEditArticle = (article: Article, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingArticle(article);
    setNewTitle(article.title);
    setNewCategory(article.category);
    setNewDesc(article.desc);
    setNewBadge(article.badge || '');
    setNewContent(article.content);
    setStepInputs(article.steps.length ? article.steps : ['']);
    setShowAddModal(true);
  };

  const handleDeleteArticle = async (articleId: number | string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này khỏi Kho tri thức?')) return;

    try {
      if (String(articleId).startsWith('custom-')) {
        const updated = customArticles.filter(article => article.id !== articleId);
        setCustomArticles(updated);
        localStorage.setItem('custom_knowledge_articles', JSON.stringify(updated));
      } else {
        await knowledgeApi.deleteArticle(articleId);
        await refetchArticles();
      }
      if (readingArticle?.id === articleId) setReadingArticle(null);
      setToastMessage('Đã xóa bài viết khỏi Kho tri thức.');
    } catch (error: any) {
      setToastMessage(error.response?.data?.detail || 'Không thể xóa bài viết. Vui lòng thử lại.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <Layout>
      <div className="w-full p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Kho tri thức
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tra cứu tài liệu kỹ thuật, hướng dẫn giải quyết sự cố và trợ lý AI giải đáp tức thì.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {canManageArticles && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Thêm bài viết mới</span>
              </button>
            )}

            {isRequester ? (
              <Link
                to="/tickets/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Tạo Ticket hỗ trợ</span>
              </Link>
            ) : (
              <Link
                to="/tickets"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all shrink-0"
              >
                <TicketIcon className="w-3.5 h-3.5" />
                <span>Xem danh sách Ticket</span>
              </Link>
            )}
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in slide-in-from-top duration-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-800 p-1">✕</button>
          </div>
        )}

        {/* Search & AI Query Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <form onSubmit={handleAskAi} className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu hoặc hỏi AI (vd: Cài máy in, Cấu hình VPN, Quên mật khẩu)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setAiQuestion(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAiQuestion('');
                    setAiAnswer(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isAskingAi || !searchQuery.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isAskingAi ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Hỏi Trợ lý AI</span>
            </button>
          </form>

          {/* AI Instant Answer Banner */}
          {aiAnswer && (
            <div className="mt-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 animate-in slide-in-from-top-2 duration-150 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Phản hồi từ AI ServiceDesk Copilot</span>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                        RAG Knowledge
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setAiAnswer(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-normal">
                    {aiAnswer}
                  </p>

                  {isRequester && (
                    <div className="pt-2 border-t border-indigo-100/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">Chưa giải quyết được sự cố?</span>
                      <Link
                        to="/tickets/new"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        <span>Tạo ticket hỗ trợ kỹ thuật</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-current" />
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Article Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedArticles.map((art) => {
            const artStats = statsMap[String(art.id)];
            const displayViews = artStats?.views !== undefined 
              ? `${artStats.views.toLocaleString('vi-VN')} lượt xem`
              : art.views;

            return (
              <div
                key={art.id}
                onClick={() => handleOpenArticle(art)}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group flex flex-col justify-between cursor-pointer shadow-2xs relative"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {art.categoryLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {art.badge && !art.badge.includes('ký duyệt') && !art.badge.includes('chờ') && !art.badge.includes('mẫu') && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">
                          {art.badge}
                        </span>
                      )}
                      {art.isCustom && canManageArticles && (
                        <>
                        {!String(art.id).startsWith('custom-') && (
                          <button type="button" onClick={(e) => handleEditArticle(art, e)} className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors" title="Sửa bài viết">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteArticle(art.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          title="Xóa bài viết tự tạo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {art.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                    {art.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{displayViews}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                    <span>Xem hướng dẫn</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Hiển thị <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredArticles.length)}</strong> trên tổng số <strong className="text-slate-800">{filteredArticles.length}</strong> bài viết
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3 shadow-2xs">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Không tìm thấy tài liệu phù hợp</h3>
            <p className="text-xs text-slate-500">Thử tìm kiếm với từ khóa khác hoặc bấm nút "Thêm bài viết mới" bên trên.</p>
          </div>
        )}





        {/* Article Reader Modal using Portal */}
        {readingArticle && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {readingArticle.categoryLabel}
                    </span>
                    <span className="text-[11px] text-slate-400">{readingArticle.time}</span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                      <Eye className="w-3 h-3 text-slate-400" />
                      <span>
                        {statsMap[String(readingArticle.id)]?.views !== undefined
                          ? `${statsMap[String(readingArticle.id)].views.toLocaleString('vi-VN')} lượt xem`
                          : readingArticle.views}
                      </span>
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 leading-snug">
                    {readingArticle.title}
                  </h2>
                  {readingArticle.isSampleUnapproved && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      Tài liệu này là bản mẫu đang chờ phê duyệt, chưa phải quy trình chính thức.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setReadingArticle(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {/* Thông tin metadata bài viết */}
                {readingArticle.content && (
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 text-xs sm:text-[13px] leading-relaxed text-slate-700">
                    <MarkdownView content={readingArticle.content} />
                  </div>
                )}

                {/* Danh sách các bước kỹ thuật chuẩn hóa */}
                {readingArticle.steps && readingArticle.steps.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="font-bold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Quy trình & Các bước thực hiện:</span>
                    </h4>
                    <div className="space-y-2">
                      {readingArticle.steps.map((step, idx) => {
                        const cleanStep = step.replace(/^[#\s\-*]+/, '').trim();
                        // Nếu bước có dạng "Tiêu đề: Nội dung" hoặc "Requester — kiểm tra:"
                        const matchParts = cleanStep.match(/^([^:—\-]+[:—\-])\s*(.*)$/);
                        return (
                          <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-200 transition-colors">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                              {idx + 1}
                            </span>
                            <div className="text-xs sm:text-[13px] text-slate-800 leading-relaxed">
                              {matchParts ? (
                                <>
                                  <strong className="text-indigo-950 font-semibold">{matchParts[1]}</strong>{' '}
                                  <span className="text-slate-700">{matchParts[2]}</span>
                                </>
                              ) : (
                                <span className="text-slate-700">{cleanStep}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Feedback & Copy */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-500 flex-wrap">
                  <span className="text-[11px]">Tài liệu có hữu ích không?</span>
                  <button
                    type="button"
                    onClick={() => handleVoteFeedback(readingArticle.id, true)}
                    className={`p-1.5 px-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-[11px] ${
                      userFeedbacks[String(readingArticle.id)] === 'yes'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${userFeedbacks[String(readingArticle.id)] === 'yes' ? 'fill-current' : ''}`} />
                    <span>Hữu ích</span>
                    {(statsMap[String(readingArticle.id)]?.helpful ?? 0) > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        userFeedbacks[String(readingArticle.id)] === 'yes' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 font-medium'
                      }`}>
                        {statsMap[String(readingArticle.id)]?.helpful}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVoteFeedback(readingArticle.id, false)}
                    className={`p-1.5 px-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-[11px] ${
                      userFeedbacks[String(readingArticle.id)] === 'no'
                        ? 'bg-rose-600 text-white border-rose-600 font-semibold shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                    }`}
                  >
                    <ThumbsDown className={`w-3.5 h-3.5 ${userFeedbacks[String(readingArticle.id)] === 'no' ? 'fill-current' : ''}`} />
                    <span>Chưa rõ</span>
                    {(statsMap[String(readingArticle.id)]?.not_helpful ?? 0) > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        userFeedbacks[String(readingArticle.id)] === 'no' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 font-medium'
                      }`}>
                        {statsMap[String(readingArticle.id)]?.not_helpful}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleCopyContent(readingArticle.steps.join('\n'))}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? 'Đã sao chép' : 'Sao chép hướng dẫn'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReadingArticle(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Create New Article Modal */}
        {showAddModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{editingArticle ? 'Sửa bài viết Kho tri thức' : 'Thêm bài viết mới vào Kho tri thức'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateArticleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Tiêu đề bài viết *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ví dụ: Hướng dẫn cài đặt Driver máy in màu..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Chủ đề / Danh mục</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 cursor-pointer"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="DEVICE">Thiết bị & Máy in</option>
                      <option value="AUTH">Tài khoản & Xác thực</option>
                      <option value="NETWORK">Mạng & VPN</option>
                      <option value="SOFTWARE">Phần mềm & Cấp quyền</option>
                      <option value="SECURITY">Bảo mật & 2FA</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Huy hiệu hiển thị</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Quan trọng, Phổ biến, Mới..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                      value={newBadge}
                      onChange={(e) => setNewBadge(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Tóm tắt ngắn gọn *</label>
                  <input
                    required
                    type="text"
                    placeholder="Mô tả ngắn gọn nội dung tài liệu..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Nội dung chi tiết giải thích</label>
                  <textarea
                    rows={3}
                    placeholder="Giải thích nguyên nhân hoặc lưu ý an toàn..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 resize-none"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Các bước thực hiện</label>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Thêm bước
                    </button>
                  </div>

                  <div className="space-y-2">
                    {stepInputs.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          placeholder={`Nội dung bước ${idx + 1}...`}
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                          value={step}
                          onChange={(e) => handleStepChange(idx, e.target.value)}
                        />
                        {stepInputs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setEditingArticle(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                  >
                    {editingArticle ? 'Cập nhật bài viết' : 'Lưu bài viết'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
        {/* Toast feedback popup */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2.5 px-4 py-3 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700/50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default KnowledgePage;
