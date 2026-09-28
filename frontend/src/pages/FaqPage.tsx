import { authApi } from "../services/authApi";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { 
  HelpCircle, Search, MessageSquare, Sparkles, ThumbsUp, ThumbsDown, 
  Share2, Check, ArrowRight, Plus, BookOpen, Clock, ShieldCheck, 
  ChevronRight, Bookmark, BookmarkCheck,
  Printer, Lock, Wifi, Cpu, Shield, CheckCircle2,
  X, RefreshCw, Send, LifeBuoy, Eye, Copy, Zap,
  CheckCircle, ArrowUpRight, Lightbulb, ArrowLeft, Trash2, Edit3
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { faqSyncApi, faqDeleteApi } from '../services/knowledgeApi';

export interface FAQItem {
  id: string;
  category: string;
  categoryLabel: string;
  question: string;
  answer: string;
  detailedSteps?: string[];
  tips?: string[];
  views: number;
  initialLikes: number;
  initialDislikes: number;
  updatedAt: string;
  tags: string[];
  priorityLevel?: 'P1' | 'P2' | 'P3' | 'P4';
}

const INITIAL_FAQS: FAQItem[] = [
  {
    id: 'faq-sla-1',
    category: 'SLA',
    categoryLabel: 'SLA & Quy trình',
    question: 'Thời gian cam kết phản hồi và xử lý sự cố (SLA) tại công ty là bao lâu?',
    answer: 'Hệ thống IT Service Desk áp dụng tiêu chuẩn cam kết chất lượng dịch vụ (SLA) phân theo mức độ khẩn cấp:\n\n• **P1 (Khẩn cấp - Critical)**: Phản hồi trong **15 phút**, xử lý dứt điểm tối đa **4 giờ** (Áp dụng: Sập mạng công ty, hệ thống core ERP tê liệt, VIP bị khóa tài khoản).\n• **P2 (Mức độ Cao - High)**: Phản hồi trong **30 phút**, xử lý tối đa **8 giờ** (Áp dụng: Lỗi phòng ban, máy chủ in ấn hỏng, lỗi phần mềm diện rộng).\n• **P3 (Trung bình - Medium)**: Phản hồi trong **2 giờ**, xử lý tối đa **24 giờ** (Áp dụng: Lỗi cá nhân, cần hỗ trợ cấu hình).\n• **P4 (Thấp - Low)**: Phản hồi trong **4 giờ**, xử lý tối đa **48 giờ** (Áp dụng: Tư vấn phần mềm, đăng ký mua mới thiết bị).',
    detailedSteps: [
      'Gửi ticket với tiêu đề rõ ràng và mức độ ảnh hưởng.',
      'AI Triage sẽ tự động phân tích và gán mức ưu tiên tương ứng.',
      'Theo dõi tiến độ và SLA timer ngay trên giao diện Ticket Detail.',
      'Nếu quá hạn SLA, hệ thống sẽ tự động Escalation (leo thang) lên Team Lead.'
    ],
    tips: [
      'Đối với sự cố P1 ảnh hưởng toàn công ty, vui lòng chọn mức độ P1 để IT nhận chuông cảnh báo khẩn.'
    ],
    views: 12,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['SLA', 'Quy trình', 'Khẩn cấp', 'Thời gian phản hồi'],
    priorityLevel: 'P1'
  },
  {
    id: 'faq-auth-1',
    category: 'AUTH',
    categoryLabel: 'Tài khoản & Đăng nhập',
    question: 'Tài khoản bị khóa sau khi nhập sai mật khẩu quá 5 lần thì phải làm sao?',
    answer: 'Hệ thống áp dụng chính sách bảo mật tự động khóa tài khoản tạm thời trong vòng **15 phút** nếu nhập sai thông tin xác thực liên tiếp 5 lần để phòng chống tấn công dò quét mật khẩu (Bruteforce).',
    detailedSteps: [
      'Cách 1: Chờ hết 15 phút, hệ thống sẽ tự động mở khóa và bạn có thể thử lại mật khẩu chính xác.',
      'Cách 2: Bấm vào liên kết "Quên mật khẩu" trên trang Đăng nhập để nhận mã OTP xác thực qua Email công ty.',
      'Cách 3: Nếu cần mở khóa gấp để xử lý công việc quan trọng, bấm nút "Gửi ticket mở khóa" bên dưới hoặc liên hệ Hotline IT nội bộ.'
    ],
    tips: [
      'Không nên tiếp tục nhập thử mật khẩu nhiều lần khi không chắc chắn vì thời gian khóa có thể kéo dài thêm.',
      'Nên kích hoạt ứng dụng Microsoft/Google Authenticator 2FA để tự mở khóa nhanh.'
    ],
    views: 8,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['Mật khẩu', 'Khóa tài khoản', '2FA', 'Bảo mật'],
    priorityLevel: 'P2'
  },
  {
    id: 'faq-device-1',
    category: 'DEVICE',
    categoryLabel: 'Thiết bị & Máy in',
    question: 'Tôi muốn mượn thiết bị trình chiếu / cáp chuyển đổi Type-C sang HDMI thì liên hệ ai?',
    answer: 'Phòng IT quản lý Tủ thiết bị dùng chung tại **Tầng 2 (Phòng 204)**, bao gồm: Máy chiếu di động, cáp chuyển Type-C / Mini DisplayPort sang HDMI/VGA, bút trình chiếu Logitech và micro không dây.',
    detailedSteps: [
      'Tạo 1 ticket yêu cầu loại "Yêu cầu Mượn Thiết bị" trước tối thiểu 30 phút so với giờ họp.',
      'Ghi rõ tên phòng họp, thời gian bắt đầu và thời gian dự kiến trả thiết bị.',
      'Đến bàn IT tầng 2 để ký nhận và nhận thiết bị đã được test sẵn.',
      'Sau buổi họp, bàn giao lại nguyên trạng và ký xác nhận hoàn trả.'
    ],
    tips: [
      'Vào các khung giờ cao điểm (sáng thứ 2, chiều thứ 6), nên gửi yêu cầu trước 1 ngày để đảm bảo có sẵn thiết bị.'
    ],
    views: 5,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm qua',
    tags: ['Mượn thiết bị', 'Cáp HDMI', 'Máy chiếu', 'Phòng họp'],
    priorityLevel: 'P4'
  },
  {
    id: 'faq-sw-1',
    category: 'SOFTWARE',
    categoryLabel: 'Phần mềm & Cấp quyền',
    question: 'Làm thế nào để xin quyền truy cập vào Thư mục dùng chung (Shared Folder / NAS)?',
    answer: 'Để đảm bảo an toàn thông tin theo chuẩn ISO 27001, việc cấp quyền vào các thư mục tài nguyên chung (NAS/File Server) bắt buộc phải có sự phê duyệt của Quản lý bộ phận sở hữu tài nguyên.',
    detailedSteps: [
      'Xác định chính xác đường dẫn thư mục cần truy cập (Ví dụ: \\\\nas01\\Marketing\\DesignProjects).',
      'Tạo ticket danh mục "Cấp quyền & Tài nguyên", đính kèm ảnh chụp màn hình email phê duyệt từ Trưởng bộ phận (Team Lead / Director).',
      'Kỹ thuật viên IT sẽ thêm tài khoản của bạn vào Security Group tương ứng trên Active Directory.',
      'Đăng xuất và đăng nhập lại Windows (hoặc khởi động lại máy) để quyền mới có hiệu lực.'
    ],
    tips: [
      'Nếu truy cập từ xa qua mạng gia đình, bạn phải kết nối VPN công ty trước khi mở đường dẫn NAS.'
    ],
    views: 9,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm qua',
    tags: ['NAS', 'Share Folder', 'Active Directory', 'Phân quyền'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-net-1',
    category: 'NETWORK',
    categoryLabel: 'Mạng & VPN',
    question: 'Làm thế nào để cài đặt và kết nối VPN khi làm việc từ xa (Work From Home)?',
    answer: 'VPN (Virtual Private Network) cho phép nhân viên truy cập an toàn vào hệ sinh thái nội bộ (ERP, Git, NAS, HRM) từ bất kỳ đâu.',
    detailedSteps: [
      'Tải ứng dụng FortiClient / OpenVPN từ cổng phần mềm nội bộ.',
      'Cấu hình Server Gateway: `vpn.company.vn` (Port: `10443`).',
      'Nhập Username và Password tài khoản công ty.',
      'Nhập mã OTP 6 số từ ứng dụng Authenticator trên điện thoại để hoàn tất kết nối.'
    ],
    tips: [
      'Kiểm tra tốc độ mạng gia đình trước khi kết nối VPN để đảm bảo đường truyền ổn định.',
      'Ngắt kết nối VPN sau khi hoàn thành công việc để tối ưu băng thông cho toàn công ty.'
    ],
    views: 14,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['VPN', 'WFH', 'Mạng nội bộ', 'FortiClient'],
    priorityLevel: 'P2'
  },
  {
    id: 'faq-sec-1',
    category: 'SECURITY',
    categoryLabel: 'Bảo mật & 2FA',
    question: 'Quy định đặt mật khẩu định kỳ và cách cấu hình bảo mật 2 lớp (2FA)?',
    answer: 'Mật khẩu tài khoản công ty có hiệu lực trong 90 ngày. Hệ thống sẽ gửi email nhắc nhở trước 7 ngày khi mật khẩu sắp hết hạn.',
    detailedSteps: [
      'Mật khẩu mới phải dài tối thiểu 10 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (@, #, $, !).',
      'Không được sử dụng lại 3 mật khẩu gần nhất hoặc chứa họ tên/ngày sinh cá nhân.',
      'Vào Cài đặt Tài khoản > Bảo mật > Chọn "Kích hoạt 2FA".',
      'Dùng ứng dụng Google Authenticator hoặc Microsoft Authenticator quét mã QR và lưu mã dự phòng.'
    ],
    tips: [
      'Tuyệt đối không chia sẻ mã OTP hoặc mật khẩu cho bất kỳ ai, kể cả nhân viên IT.'
    ],
    views: 7,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: '3 ngày trước',
    tags: ['Đổi mật khẩu', '2FA', 'Bảo mật', 'Chính sách IT'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-hw-011',
    category: 'DEVICE',
    categoryLabel: 'Thiết bị & Máy in',
    question: '[HW-011] Máy in không in hoặc báo trạng thái Offline thì xử lý thế nào?',
    answer: 'Khi máy in văn phòng báo Offline hoặc không nhận lệnh in, nguyên nhân phổ biến là hàng đợi Print Spooler bị kẹt hoặc mất kết nối mạng IP của máy in.',
    detailedSteps: [
      'Kiểm tra màn hình máy in xem có báo lỗi Sleep, hết giấy hoặc hết mực không.',
      'Nhấn phím Windows + R, gõ `services.msc`, tìm dịch vụ `Print Spooler`, click chuột phải chọn `Restart`.',
      'Kiểm tra dây cáp mạng LAN cắm sau máy in hoặc đèn tín hiệu Wi-Fi máy in có sáng xanh không.',
      'Nếu vẫn không in được, ping địa chỉ IP của máy in (VD: ping 192.168.1.200) để kiểm tra thông mạng.'
    ],
    tips: [
      'Tuyệt đối không tắt bật nguồn máy in liên tục nhiều lần trong vòng 30 giây.'
    ],
    views: 24,
    initialLikes: 3,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['HW-011', 'Máy in', 'Offline', 'Print Spooler', 'Không in'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-hw-012',
    category: 'DEVICE',
    categoryLabel: 'Thiết bị & Máy in',
    question: '[HW-012] Máy in bị kẹt giấy (Paper Jam) thì xử lý thế nào để không làm hỏng máy?',
    answer: 'Kẹt giấy xảy ra khi giấy bị ẩm, nhăn, đặt lệch khay nạp hoặc bao lụa bị khô mỡ. Khi gỡ kẹt phải kéo từ từ theo chiều quay của trục cuốn.',
    detailedSteps: [
      'Tắt nguồn máy in hoặc mở nắp trước để ngắt truyền động motor.',
      'Mở nắp hông / cụm sấy theo hướng dẫn mũi tên trên thân máy.',
      'Dùng cả 2 tay cầm đều mép giấy và kéo nhẹ nhàng theo chiều giấy chạy ra.',
      'Đóng chặt nắp máy in, bật lại nguồn và nhấn Resume để máy in tiếp.'
    ],
    tips: [
      'Không sử dụng giấy bị ẩm, nhăn hoặc tái sử dụng giấy có bấm ghim để in.'
    ],
    views: 19,
    initialLikes: 2,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['HW-012', 'Máy in', 'Kẹt giấy', 'Paper Jam', 'Bao lụa'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-hw-013',
    category: 'DEVICE',
    categoryLabel: 'Thiết bị & Máy in',
    question: '[HW-013] Khắc phục lỗi Driver máy in chưa cài hoặc sai phiên bản trên Windows/macOS?',
    answer: 'Lỗi driver khiến lệnh in bị lỗi, in ra ký tự lạ hoặc máy tính không nhận diện đúng các tính năng của máy in. Bạn cần tải đúng driver chính thức hoặc dùng Generic Driver của hãng.',
    detailedSteps: [
      'Xác định model máy in (tem ở mặt trước máy, ví dụ Canon LBP 2900 / HP LaserJet Pro / Ricoh).',
      'Vào Windows Settings > Printers & Scanners > "Add a printer using IP address".',
      'Nhập địa chỉ IP máy in của tầng bạn làm việc (192.168.1.200 - 202).',
      'Chọn Driver chính thức: Canon Generic Plus UFR II hoặc HP Universal Print Driver PCL6.',
      'In trang kiểm tra (Print Test Page) để xác nhận.'
    ],
    tips: [
      'Liên hệ IT để nhận file cài đặt tự động (.bat/.ps1) nếu máy tính không có quyền cài driver trực tiếp.'
    ],
    views: 15,
    initialLikes: 1,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['HW-013', 'Driver', 'Máy in', 'Cài máy in', 'Windows'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-hw-014',
    category: 'DEVICE',
    categoryLabel: 'Thiết bị & Máy in',
    question: '[HW-014] Bản in bị mờ nhạt, có vệt sọc đen hoặc lem mực khắp trang giấy?',
    answer: 'Vệt sọc đen hoặc in mờ thường do hộp mực sắp hết, drum (trống từ) bị xước hoặc thanh gạt mực bị mòn sau thời gian dài sử dụng.',
    detailedSteps: [
      'Mở nắp máy in, rút hộp mực ra và lắc nhẹ theo chiều ngang 3-4 lần rồi lắp lại để lượng mực phân bổ đều.',
      'Kiểm tra xem thanh drum (trống hình trụ màu xanh/xám) có vết xước hoặc bám bụi mực dơ không.',
      'Lau nhẹ thanh gạt / gương quét quang học bằng khăn mềm khô chuyên dụng.',
      'Nếu bản in vẫn lem sọc đen đậm kéo dài, hộp mực hoặc drum đã hỏng, cần tạo ticket để IT thay thế hộp mực mới.'
    ],
    tips: [
      'Tránh để cụm drum tiếp xúc với ánh sáng mặt trời trực tiếp quá 3 phút.'
    ],
    views: 12,
    initialLikes: 0,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['HW-014', 'Lem mực', 'In mờ', 'Sọc đen', 'Thay mực'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-acc-001',
    category: 'AUTH',
    categoryLabel: 'Tài khoản & Xác thực',
    question: '[ACC-001] Không đăng nhập được tài khoản công ty (Email, SSO, VPN, Service Desk)?',
    answer: 'Nguyên nhân phổ biến do gõ sai mật khẩu (bật Caps Lock / bàn phím tiếng Việt gõ dấu), mật khẩu hết hạn 90 ngày hoặc tài khoản bị khóa bảo mật tạm thời.',
    detailedSteps: [
      'Kiểm tra lại phím Caps Lock và bộ gõ tiếng Việt (Unikey/EVKey) trước khi nhập mật khẩu.',
      'Nếu nghi ngờ quên mật khẩu, truy cập trang đăng nhập và nhấn "Quên mật khẩu" để nhận mã OTP qua email.',
      'Nếu tài khoản bị khóa do nhập sai quá 5 lần, chờ 15 phút hoặc liên hệ IT để mở khóa nhanh.',
      'Kiểm tra xem thiết bị có kết nối mạng Internet hoặc mạng nội bộ bình thường không.'
    ],
    tips: [
      'Mật khẩu nội bộ hết hạn sau 90 ngày, bạn nên đổi mật khẩu trước khi hết hạn để tránh gián đoạn công việc.'
    ],
    views: 32,
    initialLikes: 4,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['ACC-001', 'Đăng nhập', 'Tài khoản', 'SSO', 'Khóa tài khoản'],
    priorityLevel: 'P2'
  },
  {
    id: 'faq-net-001',
    category: 'NETWORK',
    categoryLabel: 'Mạng & VPN',
    question: '[NET-001] Sóng Wi-Fi văn phòng chập chờn, báo No Internet hoặc Limited Access?',
    answer: 'Sự cố thường do xung đột địa chỉ IP cục bộ từ DHCP server hoặc bộ nhớ đệm DNS bị lỗi trên máy trạm.',
    detailedSteps: [
      'Tắt Wi-Fi trên máy, chờ 5 giây rồi kết nối lại vào mạng doanh nghiệp "AZMedia247-Enterprise-5G".',
      'Mở cmd dưới quyền Run as Administrator, chạy lần lượt: `ipconfig /release`, `ipconfig /flushdns`, `ipconfig /renew`.',
      'Khởi động lại card mạng hoặc thiết bị máy tính.',
      'Nếu toàn bộ khu vực phòng ban đều mất kết nối, báo ngay cho IT trực tầng.'
    ],
    tips: [
      'Ưu tiên kết nối mạng 5GHz thay vì 2.4GHz để giảm nhiễu sóng trong văn phòng.'
    ],
    views: 28,
    initialLikes: 3,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['NET-001', 'Wi-Fi', 'Mạng', 'No Internet', 'DNS'],
    priorityLevel: 'P2'
  },
  {
    id: 'faq-sw-001',
    category: 'SOFTWARE',
    categoryLabel: 'Phần mềm & Cấp quyền',
    question: '[SW-001] Ứng dụng công việc (Outlook, Excel, Teams, phần mềm kế toán) bị crash hoặc treo đơ?',
    answer: 'Hiện tượng crash hoặc Not Responding thường do xung đột add-in, dữ liệu cache bị lỗi hoặc thiếu tài nguyên RAM/CPU.',
    detailedSteps: [
      'Nhấn Ctrl + Shift + Esc để mở Task Manager, tìm ứng dụng bị treo và chọn "End task".',
      'Khởi động lại ứng dụng ở chế độ Safe Mode (VD: Giữ phím Ctrl khi mở Outlook hoặc Excel).',
      'Xóa bộ nhớ đệm cache tạm thời trong thư mục `%temp%` và `%appdata%`.',
      'Cập nhật bản vá mới nhất của phần mềm hoặc yêu cầu IT cài lại ứng dụng sạch.'
    ],
    tips: [
      'Lưu dữ liệu thường xuyên lên OneDrive / SharePoint để tránh mất mát khi ứng dụng gặp sự cố đột ngột.'
    ],
    views: 21,
    initialLikes: 2,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['SW-001', 'Crash', 'Outlook', 'Treo máy', 'Phần mềm'],
    priorityLevel: 'P3'
  },
  {
    id: 'faq-sec-002',
    category: 'SECURITY',
    categoryLabel: 'Bảo mật & 2FA',
    question: '[SEC-002] Nghi ngờ máy tính bị dính mã độc, virus hoặc tệp tin bị đổi đuôi lạ?',
    answer: 'Khi máy tính xuất hiện cảnh báo mã độc, tệp tin bị mã hóa đòi tiền chuộc hoặc trình duyệt tự động mở các trang web lạ, cần lập tức cô lập thiết bị để tránh lây lan mạng nội bộ.',
    detailedSteps: [
      'RÚT NGAY DÂY CÁP MẠNG LAN và TẮT KẾT NỐI WI-FI trên máy tính ngay lập tức.',
      'Không cắm thêm bất kỳ USB, ổ cứng di động nào vào máy tính.',
      'Không tự ý chuyển tiền hay làm theo bất kỳ yêu cầu nào hiển thị trên màn hình.',
      'Báo ngay cho Bộ phận An toàn thông tin (SOC) hoặc Đội ngũ IT qua Hotline khẩn cấp.'
    ],
    tips: [
      'Không mở tệp tin đính kèm có đuôi .exe, .scr, .vbs hoặc file zip từ người gửi lạ trong email.'
    ],
    views: 45,
    initialLikes: 8,
    initialDislikes: 0,
    updatedAt: 'Hôm nay',
    tags: ['SEC-002', 'Mã độc', 'Ransomware', 'Virus', 'Khẩn cấp'],
    priorityLevel: 'P1'
  }
];

// Helper to render bold markdown **text** and stylish bullet points
const FormattedAnswerText = ({ text }: { text: string }) => {
  const lines = text.split('\n');

  const renderInlineFormatted = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        
        if (content.includes('P1') || content.includes('Khẩn cấp')) {
          return (
            <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mr-1">
              {content}
            </span>
          );
        }
        if (content.includes('P2') || content.includes('Mức độ Cao')) {
          return (
            <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 mr-1">
              {content}
            </span>
          );
        }
        if (content.includes('P3') || content.includes('Trung bình')) {
          return (
            <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mr-1">
              {content}
            </span>
          );
        }
        if (content.includes('P4') || content.includes('Thấp')) {
          return (
            <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 mr-1">
              {content}
            </span>
          );
        }
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {content}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-sm text-slate-700 leading-relaxed font-normal">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          const itemText = trimmed.replace(/^[•\-]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0" />
              <div className="flex-1 leading-relaxed">
                {renderInlineFormatted(itemText)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineFormatted(line)}
          </p>
        );
      })}
    </div>
  );
};

export const FaqPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'ALL';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // User-scoped Bookmarks and Rating state
  const [savedFaqIds, setSavedFaqIds] = useState<string[]>([]);
  const [userLikes, setUserLikes] = useState<Record<string, 'like' | 'dislike'>>({});

  // Real Persistent Like / Dislike Count Map
  const [statsMap, setStatsMap] = useState<Record<string, { likes: number; dislikes: number }>>(() => {
    try {
      const saved = localStorage.getItem('faq_real_stats_counts_v2');
      if (saved) return JSON.parse(saved);
    } catch {}

    const initialMap: Record<string, { likes: number; dislikes: number }> = {};
    INITIAL_FAQS.forEach(f => {
      initialMap[f.id] = { likes: f.initialLikes, dislikes: f.initialDislikes };
    });
    return initialMap;
  });

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

  const userKey = currentUser?.id || currentUser?.email || '';

  // Synchronize user-specific likes and saved bookmarks when currentUser changes
  React.useEffect(() => {
    // Clear old global un-scoped items that leaked across accounts
    try {
      localStorage.removeItem('saved_faq_ids');
      localStorage.removeItem('faq_user_real_ratings');
    } catch {}

    if (!userKey) {
      setSavedFaqIds([]);
      setUserLikes({});
      return;
    }

    try {
      const saved = localStorage.getItem(`saved_faq_ids_${userKey}`);
      setSavedFaqIds(saved ? JSON.parse(saved) : []);
    } catch {
      setSavedFaqIds([]);
    }

    try {
      const ratings = localStorage.getItem(`faq_user_ratings_${userKey}`);
      setUserLikes(ratings ? JSON.parse(ratings) : {});
    } catch {
      setUserLikes({});
    }
  }, [userKey]);

  const userRole = currentUser?.role_name || cachedRole || "REQUESTER";
  const canManageFaqs = userRole === "ADMIN" || userRole === "TEAM_LEAD" || userRole === "SUPPORT_AGENT";

  // Pending FAQs state for Admin review
  const [pendingFaqs, setPendingFaqs] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem("pending_faqs_submissions_v1");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [activeFaqTab, setActiveFaqTab] = useState<"approved" | "pending">("approved");

  // Admin FAQ editing state
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [editCategory, setEditCategory] = useState('DEVICE');
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editPriority, setEditPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');

  const handleOpenEditModal = (faq: FAQItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFaq(faq);
    setEditCategory(faq.category || 'DEVICE');
    setEditQuestion(faq.question || '');
    setEditAnswer(faq.answer || '');
    setEditPriority((faq.priorityLevel as any) || 'P3');
  };

  const handleSaveEditFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq || !editQuestion.trim()) return;

    try {
      const res = await faqDeleteApi.updateFaq(editingFaq.id, {
        category: editCategory,
        question: editQuestion.trim(),
        answer: editAnswer.trim(),
        priorityLevel: editPriority
      });

      if (res?.item) {
        setFaqList(prev => prev.map(f => f.id === editingFaq.id ? { ...f, ...res.item } : f));
        setPendingFaqs(prev => prev.map(f => f.id === editingFaq.id ? { ...f, ...res.item } : f));
      }
      refetchServerFaqs();
      setEditingFaq(null);
      showToast("✓ Đã cập nhật câu hỏi thành công!");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Cập nhật câu hỏi thất bại.");
    }
  };

  const [faqList, setFaqList] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem('custom_faqs_list_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_FAQS;
  });

  // Sync with Server DB
  const { data: serverFaqs, refetch: refetchServerFaqs } = useQuery({
    queryKey: ["serverFaqsList"],
    queryFn: faqSyncApi.getAllFaqs,
    staleTime: 10 * 1000,
    refetchInterval: 5000 // Poll every 5s for new submissions
  });

  React.useEffect(() => {
    if (serverFaqs?.approved && serverFaqs.approved.length > 0) {
      setFaqList(serverFaqs.approved as any);
      localStorage.setItem("custom_faqs_list_v2", JSON.stringify(serverFaqs.approved));
    }
    if (serverFaqs?.pending) {
      setPendingFaqs(serverFaqs.pending as any);
      localStorage.setItem("pending_faqs_submissions_v1", JSON.stringify(serverFaqs.pending));
    }
  }, [serverFaqs]);

  // AI Assistant in FAQ
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  // New Question Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('DEVICE');
  const [newDetails, setNewDetails] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    { id: 'ALL', label: 'Tất cả chủ đề', icon: BookOpen, count: faqList.length },
    { id: 'SLA', label: 'SLA & Quy trình', icon: Clock, count: faqList.filter(f => f.category === 'SLA').length },
    { id: 'AUTH', label: 'Tài khoản & Đăng nhập', icon: Lock, count: faqList.filter(f => f.category === 'AUTH').length },
    { id: 'DEVICE', label: 'Thiết bị & Máy in', icon: Printer, count: faqList.filter(f => f.category === 'DEVICE').length },
    { id: 'NETWORK', label: 'Mạng & VPN', icon: Wifi, count: faqList.filter(f => f.category === 'NETWORK').length },
    { id: 'SOFTWARE', label: 'Phần mềm & Cấp quyền', icon: Cpu, count: faqList.filter(f => f.category === 'SOFTWARE').length },
    { id: 'SECURITY', label: 'Bảo mật & 2FA', icon: Shield, count: faqList.filter(f => f.category === 'SECURITY').length },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleSave = (faqId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentKey = currentUser?.id || currentUser?.email || 'guest';
    setSavedFaqIds(prev => {
      const next = prev.includes(faqId) ? prev.filter(x => x !== faqId) : [...prev, faqId];
      try {
        localStorage.setItem(`saved_faq_ids_${currentKey}`, JSON.stringify(next));
      } catch {}
      showToast(prev.includes(faqId) ? 'Đã bỏ lưu câu hỏi' : 'Đã lưu câu hỏi vào danh sách yêu thích ⭐');
      return next;
    });
  };

  // REAL LIKE & DISLIKE TOGGLE ENGINE
  const handleRate = (faqId: string, type: 'like' | 'dislike', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentKey = currentUser?.id || currentUser?.email || 'guest';
    const currentVote = userLikes[faqId];

    const currentStats = statsMap[faqId] || { likes: 0, dislikes: 0 };
    let newLikes = currentStats.likes;
    let newDislikes = currentStats.dislikes;

    let nextUserLikes = { ...userLikes };

    if (currentVote === type) {
      delete nextUserLikes[faqId];
      if (type === 'like') newLikes = Math.max(0, newLikes - 1);
      if (type === 'dislike') newDislikes = Math.max(0, newDislikes - 1);
      showToast('Đã hủy đánh giá câu trả lời');
    } else {
      nextUserLikes[faqId] = type;
      if (type === 'like') {
        newLikes += 1;
        if (currentVote === 'dislike') newDislikes = Math.max(0, newDislikes - 1);
        showToast('👍 Cảm ơn bạn đã đánh giá hữu ích!');
      } else {
        newDislikes += 1;
        if (currentVote === 'like') newLikes = Math.max(0, newLikes - 1);
        showToast('Đã ghi nhận phản hồi để cải thiện bài viết');
      }
    }

    const updatedMap = {
      ...statsMap,
      [faqId]: { likes: newLikes, dislikes: newDislikes }
    };

    setUserLikes(nextUserLikes);
    setStatsMap(updatedMap);
    try {
      localStorage.setItem(`faq_user_ratings_${currentKey}`, JSON.stringify(nextUserLikes));
      localStorage.setItem('faq_real_stats_counts_v2', JSON.stringify(updatedMap));
    } catch {}
  };

  const handleCopyLink = (faqId: string, question: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/faq/${faqId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(faqId);
    showToast('Đã sao chép liên kết câu hỏi vào clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateTicketFromFaq = (faq: FAQItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/tickets/new', {
      state: {
        prefillTitle: `[Hỗ trợ FAQ] Cần giải đáp thêm về: ${faq.question}`,
        prefillDescription: `Tôi cần đội ngũ IT hỗ trợ thêm về câu hỏi FAQ: "${faq.question}"\n\nNội dung thắc mắc / Tình trạng gặp phải:\n- Vấn đề gặp phải: \n- Thiết bị / Vị trí phòng ban: \n- Chi tiết cần kỹ thuật viên IT hỗ trợ: `,
        prefillCategory: faq.category === 'AUTH' ? 'Tài khoản' : faq.category === 'DEVICE' ? 'Phần cứng' : faq.category === 'NETWORK' ? 'Mạng' : 'Khác'
      }
    });
  };

  const handleAiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsAiSearching(true);
    setAiResponse(null);

    setTimeout(() => {
      const lower = q.toLowerCase();
      if (lower.includes('sla') || lower.includes('thời gian') || lower.includes('cam kết')) {
        setAiResponse(
          `⏱️ **Quy định SLA Service Desk:**\n` +
          `• **P1 - Khẩn cấp**: Phản hồi 15p, xử lý tối đa 4h.\n` +
          `• **P2 - Cao**: Phản hồi 30p, xử lý tối đa 8h.\n` +
          `• **P3 - Trung bình**: Phản hồi 2h, xử lý tối đa 24h.\n` +
          `• **P4 - Thấp**: Phản hồi 4h, xử lý tối đa 48h.`
        );
      } else if (lower.includes('mật khẩu') || lower.includes('khóa') || lower.includes('login')) {
        setAiResponse(
          `🔐 **Khắc phục tài khoản / Mật khẩu:**\n` +
          `1. Chờ **15 phút** nếu bị khóa do nhập sai quá 5 lần.\n` +
          `2. Sử dụng tính năng **Quên mật khẩu** trên màn hình đăng nhập để nhận mã xác thực qua Email.\n` +
          `3. Hoặc liên hệ IT Desk để được mở khóa ngay.`
        );
      } else if (lower.includes('vpn') || lower.includes('wfh') || lower.includes('từ xa')) {
        setAiResponse(
          `🌐 **Cấu hình VPN nội bộ:**\n` +
          `• Server Gateway: \`vpn.company.vn\` (Port: \`10443\`).\n` +
          `• Đăng nhập bằng Email và Password công ty kèm mã OTP 2FA từ ứng dụng Authenticator.`
        );
      } else {
        setAiResponse(
          `💡 **Gợi ý từ Trợ lý AI:**\n\nĐối với thắc mắc "${q}":\n` +
          `1. Kiểm tra lại kết nối mạng hoặc thử khởi động lại ứng dụng.\n` +
          `2. Tra cứu thêm trong **Kho tri thức**.\n` +
          `3. Nếu chưa khắc phục được, bạn có thể bấm **Gửi Ticket Yêu Cầu Mới** để kỹ thuật viên IT hỗ trợ trực tiếp.`
        );
      }
      setIsAiSearching(false);
    }, 400);
  };

  const handleApproveFaq = async (faqId: string) => {
    try {
      const res = await faqSyncApi.approveQuestion(faqId);
      if (res?.item) {
        setFaqList(prev => [res.item as any, ...prev]);
        setPendingFaqs(prev => prev.filter(f => f.id !== faqId));
      }
      refetchServerFaqs();
      showToast("✓ Đã duyệt và xuất bản câu hỏi lên Hỏi đáp & FAQ!");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Duyệt câu hỏi thất bại.");
    }
  };

  const handleDeleteApprovedFaq = async (faqId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn câu hỏi FAQ này không?")) return;
    try {
      await faqDeleteApi.deleteFaq(faqId);
      setFaqList(prev => prev.filter(f => f.id !== faqId));
      refetchServerFaqs();
      showToast("Đã xóa câu hỏi FAQ thành công.");
      if (id && id === faqId) {
        navigate("/faq");
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Xóa câu hỏi thất bại.");
    }
  };

  const handleRejectFaq = async (faqId: string) => {
    if (!confirm("Bạn có chắc muốn từ chối và xóa câu hỏi đóng góp này?")) return;
    try {
      await faqSyncApi.rejectQuestion(faqId);
      setPendingFaqs(prev => prev.filter(f => f.id !== faqId));
      refetchServerFaqs();
      showToast("Đã từ chối câu hỏi đóng góp.");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Xóa câu hỏi thất bại.");
    }
  };

  const handleSubmitNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    try {
      const res = await faqSyncApi.submitQuestion({
        category: newCategory,
        question: newQuestion.trim(),
        details: newDetails.trim()
      });

      setShowSubmitModal(false);
      setNewQuestion("");
      setNewDetails("");
      refetchServerFaqs();

      showToast("✓ Câu hỏi đã được gửi thành công và đang chờ Admin duyệt tay trước khi hiển thị!");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Gửi câu hỏi thất bại.");
    }
  };

  const [activeQuickTag, setActiveQuickTag] = useState<string | null>(null);

  const QUICK_TAGS = [
    { label: 'SLA xử lý', category: 'SLA', keyword: 'SLA' },
    { label: 'Quên mật khẩu', category: 'AUTH', keyword: 'mật khẩu' },
    { label: 'Mượn thiết bị', category: 'DEVICE', keyword: 'thiết bị' },
    { label: 'Quyền thư mục NAS', category: 'SOFTWARE', keyword: 'NAS' },
    { label: 'Cài đặt VPN', category: 'NETWORK', keyword: 'VPN' },
    { label: 'Bảo mật 2FA', category: 'SECURITY', keyword: '2FA' }
  ];

  const handleQuickTagClick = (tag: typeof QUICK_TAGS[0]) => {
    if (activeQuickTag === tag.label) {
      setActiveQuickTag(null);
      setSearchQuery('');
      setSelectedCategory('ALL');
      setSearchParams({});
    } else {
      setActiveQuickTag(tag.label);
      setSearchQuery(tag.keyword);
      setSelectedCategory(tag.category);
      setSearchParams({ category: tag.category });
      showToast(`🔍 Đã lọc theo: #${tag.label}`);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveQuickTag(null);
    setSelectedCategory('ALL');
    setSearchParams({});
  };

  const filteredFaqs = useMemo(() => {
    return faqList.filter(faq => {
      const matchCat = selectedCategory === 'ALL' || faq.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;

      const tokens = q.split(/\s+/).filter(Boolean);
      const searchableContent = (
        faq.question + ' ' + 
        faq.answer + ' ' + 
        faq.tags.join(' ') + ' ' + 
        faq.categoryLabel + ' ' + 
        (faq.detailedSteps ? faq.detailedSteps.join(' ') : '') + ' ' + 
        (faq.tips ? faq.tips.join(' ') : '')
      ).toLowerCase();

      const matchSearch = 
        searchableContent.includes(q) || 
        tokens.some(token => token.length >= 2 && searchableContent.includes(token));

      return matchCat && matchSearch;
    });
  }, [faqList, selectedCategory, searchQuery]);

  // If a specific FAQ is selected via URL /faq/:id
  const currentFaq = useMemo(() => {
    if (!id) return null;
    return faqList.find(f => f.id === id);
  }, [id, faqList]);

  // Related FAQs in the same category
  const relatedFaqs = useMemo(() => {
    if (!currentFaq) return [];
    return faqList.filter(f => f.id !== currentFaq.id && f.category === currentFaq.category).slice(0, 3);
  }, [currentFaq, faqList]);

  return (
    <Layout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. DEDICATED FAQ DETAIL PAGE VIEW */}
      {id ? (
        currentFaq ? (
          <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 pb-12 animate-in fade-in duration-200">
            {/* Main Article Canvas */}
            <article className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden p-6 sm:p-8 space-y-6">
              {/* Top Navigation Bar inside the article */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/faq')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Quay lại danh sách câu hỏi</span>
                </button>

                <div className="flex items-center gap-2 text-xs">
                  {canManageFaqs && (
                    <div className="flex items-center gap-1 mr-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(currentFaq, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Chỉnh sửa câu hỏi này"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteApprovedFaq(currentFaq.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa câu hỏi FAQ này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-md font-semibold text-[11px]">
                    {currentFaq.categoryLabel}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                    <Eye className="w-3.5 h-3.5 text-slate-400" /> {currentFaq.views} lượt xem
                  </span>
                </div>
              </div>

              {/* Article Header */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  {currentFaq.priorityLevel && (
                    <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${
                      currentFaq.priorityLevel === 'P1' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      currentFaq.priorityLevel === 'P2' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      Mức độ {currentFaq.priorityLevel}
                    </span>
                  )}
                  <span className="text-slate-400">• Cập nhật: {currentFaq.updatedAt}</span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1 ml-auto text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    <ShieldCheck className="w-3.5 h-3.5" /> Đã kiểm duyệt nội bộ
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug tracking-tight">
                  {currentFaq.question}
                </h1>
              </div>

              {/* Main Content Area */}
              <div className="space-y-6 text-slate-800">
                {/* 1. Main Explanation / Answer */}
                <div className="leading-relaxed text-sm sm:text-base font-normal">
                  <FormattedAnswerText text={currentFaq.answer} />
                </div>

                {/* 2. Step-by-Step Procedure */}
                {currentFaq.detailedSteps && currentFaq.detailedSteps.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                      <CheckCircle className="w-4 h-4 text-indigo-600" />
                      <span>Quy trình thực hiện chi tiết:</span>
                    </h3>

                    <div className="space-y-3 pl-1">
                      {currentFaq.detailedSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3.5 group">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200/80 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {idx + 1}
                          </span>
                          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-0.5 flex-1 font-normal">
                            <FormattedAnswerText text={step} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Important Tips Callout */}
                {currentFaq.tips && currentFaq.tips.length > 0 && (
                  <div className="bg-amber-50/70 border-l-4 border-amber-400 p-4 rounded-r-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>Lưu ý quan trọng từ đội ngũ IT:</span>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      {currentFaq.tips.map((tip, idx) => (
                        <p key={idx} className="text-xs text-amber-900/90 leading-relaxed">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Interactive Toolbar */}
              <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                {/* Feedback */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-medium">Câu trả lời này có hữu ích không?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleRate(currentFaq.id, 'like', e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        userLikes[currentFaq.id] === 'like'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${userLikes[currentFaq.id] === 'like' ? 'fill-white' : ''}`} />
                      <span>{(statsMap[currentFaq.id] || { likes: 0 }).likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleRate(currentFaq.id, 'dislike', e)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        userLikes[currentFaq.id] === 'dislike'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 hover:text-rose-700'
                      }`}
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 ${userLikes[currentFaq.id] === 'dislike' ? 'fill-white' : ''}`} />
                      <span>{(statsMap[currentFaq.id] || { dislikes: 0 }).dislikes}</span>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleToggleSave(currentFaq.id, e)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      savedFaqIds.includes(currentFaq.id)
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {savedFaqIds.includes(currentFaq.id) ? (
                      <BookmarkCheck className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{savedFaqIds.includes(currentFaq.id) ? 'Đã lưu' : 'Lưu bài'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(currentFaq.id, currentFaq.question, e)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedId === currentFaq.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
                    <span>Chia sẻ</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCreateTicketFromFaq(currentFaq, e)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    <span>Tạo Ticket hỗ trợ</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>

            {/* Related FAQs */}
            {relatedFaqs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Câu hỏi liên quan cùng chủ đề
                </h3>
                <div className="grid grid-cols-1 gap-2.5">
                  {relatedFaqs.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => navigate(`/faq/${rel.id}`)}
                      className="p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs group"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {rel.categoryLabel}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {rel.question}
                        </h4>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs max-w-lg mx-auto">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy câu hỏi này</h3>
            <p className="text-xs text-slate-500">Bài viết có thể đã bị xóa hoặc đường dẫn không chính xác.</p>
            <button
              type="button"
              onClick={() => navigate('/faq')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay về danh sách FAQ</span>
            </button>
          </div>
        )
      ) : (
        /* 2. FAQ LIST PAGE VIEW - FULL WIDTH & MODERN */
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 pb-12 animate-in fade-in duration-200">
          {/* Hero Header Card */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 p-5 sm:p-7 md:p-8 shadow-sm backdrop-blur-xs space-y-6">
            {/* Background Ambient Glows */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-200/25 via-purple-200/20 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-10 -mb-10 w-60 h-60 rounded-full bg-gradient-to-tr from-blue-100/25 via-cyan-100/15 to-transparent blur-2xl pointer-events-none" />

            <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-600/25 shrink-0">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                      Giải Đáp Thắc Mắc Kỹ Thuật
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal mt-0.5 max-w-2xl">
                      Tra cứu nhanh hướng dẫn xử lý sự cố thường gặp, quy định thời gian cam kết SLA và quy trình hỗ trợ IT nội bộ.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Đóng góp câu hỏi</span>
                </button>
                <Link
                  to="/knowledge"
                  className="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all duration-200 border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Kho tri thức</span>
                </Link>
              </div>
            </div>

            {/* Expansive Search Input Bar */}
            <form onSubmit={handleAiSearch} className="relative pt-2 border-t border-slate-200/60">
              <div className="relative flex items-center bg-white border border-slate-200/90 rounded-2xl p-1.5 sm:p-2 shadow-xs hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:shadow-md transition-all duration-200">
                <div className="pl-2.5 pr-1.5 text-slate-400 flex items-center shrink-0">
                  <Search className="w-5 h-5 text-indigo-500" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập vấn đề bạn cần tìm (vd: reset mật khẩu, xin quyền NAS, kết nối VPN, mượn thiết bị...)"
                  className="w-full px-2 py-2 bg-transparent text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none"
                />
                
                <div className="flex items-center gap-2 shrink-0 pr-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isAiSearching}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isAiSearching ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-100" />
                    )}
                    <span>Hỏi AI</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* AI Answer Box if generated */}
          {aiResponse && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border border-indigo-200/90 rounded-3xl p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Trợ lý AI Tự động Giải đáp</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiResponse(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                <FormattedAnswerText text={aiResponse} />
              </div>
              <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">Nội dung được tổng hợp tự động từ Cơ sở tri thức IT Service Desk.</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(aiResponse);
                    showToast('Đã sao chép câu trả lời của AI!');
                  }}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Navigation Pills - 1 Hàng Ngang Duy Nhất */}
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scrollbar-none py-1 flex-nowrap">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchParams(cat.id === 'ALL' ? {} : { category: cat.id });
                  }}
                  className={`group shrink-0 flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/25 scale-[1.02]'
                      : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs hover:shadow-xs hover:-translate-y-0.5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                  <span>{cat.label}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold transition-colors ${
                    isSelected 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-700'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* FAQ List Cards */}
          <div className="space-y-3">
            {/* Admin Moderation Controls */}
            {canManageFaqs && (
              <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveFaqTab("approved")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeFaqTab === "approved"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Đã kiểm duyệt ({faqList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFaqTab("pending")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    activeFaqTab === "pending"
                      ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>Chờ duyệt đóng góp</span>
                  {pendingFaqs.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      activeFaqTab === "pending" ? "bg-white text-amber-700" : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}>
                      {pendingFaqs.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {canManageFaqs && activeFaqTab === "pending" ? (
              <div className="space-y-4">
                {pendingFaqs.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">Không có câu hỏi nào chờ duyệt</h3>
                    <p className="text-xs text-slate-500">Tất cả đóng góp của người dùng đã được duyệt xong.</p>
                  </div>
                ) : (
                  pendingFaqs.map((p) => (
                    <div key={p.id} className="p-5 bg-amber-50/40 border border-amber-200/90 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-md">
                          {p.categoryLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">{p.updatedAt}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{p.question}</h3>
                      <p className="text-xs text-slate-600 whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200">
                        {p.answer}
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa nội dung</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectFaq(p.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl cursor-pointer"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveFaq(p.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt tay & Xuất bản</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Danh sách câu hỏi</span>
                  <span className="text-xs font-normal text-slate-400">({filteredFaqs.length})</span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Đã kiểm duyệt</span>
                </div>
              </div>
            )}

            {activeFaqTab === "approved" && (filteredFaqs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">Không tìm thấy câu hỏi phù hợp</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Thử tìm kiếm với từ khóa khác hoặc đóng góp câu hỏi mới để IT hỗ trợ bạn trực tiếp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Gửi câu hỏi mới</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredFaqs.map((faq) => {
                  const isSaved = savedFaqIds.includes(faq.id);

                  return (
                    <div
                      key={faq.id}
                      onClick={() => navigate(`/faq/${faq.id}`)}
                      className="p-4 sm:p-5 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all duration-150 cursor-pointer shadow-2xs group flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {faq.categoryLabel}
                          </span>
                          {faq.priorityLevel && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              faq.priorityLevel === 'P1' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              faq.priorityLevel === 'P2' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              Mức {faq.priorityLevel}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">• {faq.views} xem</span>
                          <span className="text-[11px] text-slate-400">• {faq.updatedAt}</span>
                        </div>

                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                          {faq.question}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canManageFaqs && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(faq, e)}
                              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteApprovedFaq(faq.id, e)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa câu hỏi này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleToggleSave(faq.id, e)}
                          title={isSaved ? 'Bỏ lưu' : 'Lưu câu hỏi'}
                          className={`p-2 rounded-xl transition-all cursor-pointer ${
                            isSaved 
                              ? 'bg-amber-50 text-amber-600 border border-amber-300' 
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/60'
                          }`}
                        >
                          {isSaved ? <BookmarkCheck className="w-4 h-4 fill-amber-500 text-amber-600" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                        <div className="p-2 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>


        </div>
      )}

      {/* Modal: Đóng góp câu hỏi mới */}
            {/* Admin Edit Modal */}
      {editingFaq && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Quản Trị: Chỉnh Sửa Câu Hỏi FAQ</h3>
                  <p className="text-xs text-slate-500">Cập nhật nội dung câu hỏi, câu trả lời và mức độ ưu tiên</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFaq(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFaq} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chủ đề / Danh mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                  >
                    <option value="SLA">SLA & Quy trình</option>
                    <option value="AUTH">Tài khoản & Đăng nhập</option>
                    <option value="DEVICE">Thiết bị & Máy in</option>
                    <option value="NETWORK">Mạng & VPN</option>
                    <option value="SOFTWARE">Phần mềm & Cấp quyền</option>
                    <option value="SECURITY">Bảo mật & 2FA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mức độ ưu tiên (SLA)
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                  >
                    <option value="P1">P1 - Khẩn cấp (Critical)</option>
                    <option value="P2">P2 - Cao (High)</option>
                    <option value="P3">P3 - Trung bình (Medium)</option>
                    <option value="P4">P4 - Thấp (Low)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Câu hỏi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung câu trả lời / Hướng dẫn xử lý <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFaq(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Cập nhật câu hỏi</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showSubmitModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Đóng Góp Câu Hỏi Mới</h3>
                  <p className="text-xs text-slate-500">Giúp làm phong phú thêm cơ sở tri thức chung</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewQuestion} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chủ đề / Danh mục <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                >
                  <option value="SLA">SLA & Quy trình</option>
                  <option value="AUTH">Tài khoản & Đăng nhập</option>
                  <option value="DEVICE">Thiết bị & Máy in</option>
                  <option value="NETWORK">Mạng & VPN</option>
                  <option value="SOFTWARE">Phần mềm & Cấp quyền</option>
                  <option value="SECURITY">Bảo mật & 2FA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Câu hỏi / Thắc mắc cụ thể <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ví dụ: Làm sao để cài đặt máy in tầng 3 qua mạng WiFi?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả chi tiết hoặc giải pháp bạn đã biết (Tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="Cung cấp thêm thông tin hoặc hướng dẫn sơ bộ nếu bạn đã nắm được cách xử lý..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Lưu câu hỏi</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
};

export default FaqPage;
