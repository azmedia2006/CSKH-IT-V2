import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User

router = APIRouter()

# Schema
class KnowledgeArticle(BaseModel):
    id: int | str
    category: str
    categoryLabel: str
    title: str
    desc: str
    views: str
    time: str
    badge: Optional[str] = None
    content: str
    steps: List[str]
    isCustom: Optional[bool] = False

class FAQItem(BaseModel):
    id: str
    category: str
    categoryLabel: str
    question: str
    answer: str
    detailedSteps: List[str]
    tips: List[str]
    views: int
    initialLikes: int
    initialDislikes: int
    updatedAt: str
    tags: List[str]
    priorityLevel: str

# Centralized Internal Knowledge Articles (Stored securely on backend)
INTERNAL_ARTICLES = [
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
]

INTERNAL_FAQS = [
    {
        "id": "faq-sla-1",
        "category": "SLA",
        "categoryLabel": "SLA & Quy trình",
        "question": "Thời gian cam kết phản hồi và xử lý sự cố (SLA) tại công ty là bao lâu?",
        "answer": "Hệ thống IT Service Desk áp dụng tiêu chuẩn cam kết chất lượng dịch vụ (SLA) phân theo mức độ khẩn cấp:\n\n• **P1 (Khẩn cấp - Critical)**: Phản hồi trong **15 phút**, xử lý dứt điểm tối đa **4 giờ** (Áp dụng: Sập mạng công ty, hệ thống core ERP tê liệt, VIP bị khóa tài khoản).\n• **P2 (Mức độ Cao - High)**: Phản hồi trong **30 phút**, xử lý tối đa **8 giờ** (Áp dụng: Lỗi phòng ban, máy chủ in ấn hỏng, lỗi phần mềm diện rộng).\n• **P3 (Trung bình - Medium)**: Phản hồi trong **2 giờ**, xử lý tối đa **24 giờ** (Áp dụng: Lỗi cá nhân, cần hỗ trợ cấu hình).\n• **P4 (Thấp - Low)**: Phản hồi trong **4 giờ**, xử lý tối đa **48 giờ** (Áp dụng: Tư vấn phần mềm, đăng ký mua mới thiết bị).",
        "detailedSteps": [
            "Gửi ticket với tiêu đề rõ ràng và mức độ ảnh hưởng.",
            "AI Triage sẽ tự động phân tích và gán mức ưu tiên tương ứng.",
            "Theo dõi tiến độ và SLA timer ngay trên giao diện Ticket Detail.",
            "Nếu quá hạn SLA, hệ thống sẽ tự động Escalation (leo thang) lên Team Lead."
        ],
        "tips": [
            "Đối với sự cố P1 ảnh hưởng toàn công ty, vui lòng chọn mức độ P1 để IT nhận chuông cảnh báo khẩn."
        ],
        "views": 12,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": [
            "SLA",
            "Quy trình",
            "Khẩn cấp",
            "Thời gian phản hồi"
        ],
        "priorityLevel": "P1"
    },
    {
        "id": "faq-auth-1",
        "category": "AUTH",
        "categoryLabel": "Tài khoản & Đăng nhập",
        "question": "Tài khoản bị khóa sau khi nhập sai mật khẩu quá 5 lần thì phải làm sao?",
        "answer": "Hệ thống áp dụng chính sách bảo mật tự động khóa tài khoản tạm thời trong vòng **15 phút** nếu nhập sai thông tin xác thực liên tiếp 5 lần để phòng chống tấn công dò quét mật khẩu (Bruteforce).",
        "detailedSteps": [
            "Cách 1: Chờ hết 15 phút, hệ thống sẽ tự động mở khóa và bạn có thể thử lại mật khẩu chính xác.",
            "Cách 2: Bấm vào liên kết \"Quên mật khẩu\" trên trang Đăng nhập để nhận mã OTP xác thực qua Email công ty.",
            "Cách 3: Nếu cần mở khóa gấp để xử lý công việc quan trọng, bấm nút \"Gửi ticket mở khóa\" bên dưới hoặc liên hệ Hotline IT nội bộ."
        ],
        "tips": [
            "Không nên tiếp tục nhập thử mật khẩu nhiều lần khi không chắc chắn vì thời gian khóa có thể kéo dài thêm.",
            "Nên kích hoạt ứng dụng Microsoft/Google Authenticator 2FA để tự mở khóa nhanh."
        ],
        "views": 8,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": [
            "Mật khẩu",
            "Khóa tài khoản",
            "2FA",
            "Bảo mật"
        ],
        "priorityLevel": "P2"
    },
    {
        "id": "faq-device-1",
        "category": "DEVICE",
        "categoryLabel": "Thiết bị & Máy in",
        "question": "Tôi muốn mượn thiết bị trình chiếu / cáp chuyển đổi Type-C sang HDMI thì liên hệ ai?",
        "answer": "Phòng IT quản lý Tủ thiết bị dùng chung tại **Tầng 2 (Phòng 204)**, bao gồm: Máy chiếu di động, cáp chuyển Type-C / Mini DisplayPort sang HDMI/VGA, bút trình chiếu Logitech và micro không dây.",
        "detailedSteps": [
            "Tạo 1 ticket yêu cầu loại \"Yêu cầu Mượn Thiết bị\" trước tối thiểu 30 phút so với giờ họp.",
            "Ghi rõ tên phòng họp, thời gian bắt đầu và thời gian dự kiến trả thiết bị.",
            "Đến bàn IT tầng 2 để ký nhận và nhận thiết bị đã được test sẵn.",
            "Sau buổi họp, bàn giao lại nguyên trạng và ký xác nhận hoàn trả."
        ],
        "tips": [
            "Vào các khung giờ cao điểm (sáng thứ 2, chiều thứ 6), nên gửi yêu cầu trước 1 ngày để đảm bảo có sẵn thiết bị."
        ],
        "views": 5,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm qua",
        "tags": [
            "Mượn thiết bị",
            "Cáp HDMI",
            "Máy chiếu",
            "Phòng họp"
        ],
        "priorityLevel": "P4"
    },
    {
        "id": "faq-sw-1",
        "category": "SOFTWARE",
        "categoryLabel": "Phần mềm & Cấp quyền",
        "question": "Làm thế nào để xin quyền truy cập vào Thư mục dùng chung (Shared Folder / NAS)?",
        "answer": "Để đảm bảo an toàn thông tin theo chuẩn ISO 27001, việc cấp quyền vào các thư mục tài nguyên chung (NAS/File Server) bắt buộc phải có sự phê duyệt của Quản lý bộ phận sở hữu tài nguyên.",
        "detailedSteps": [
            "Xác định chính xác đường dẫn thư mục cần truy cập (Ví dụ: \\\\nas01\\Marketing\\DesignProjects).",
            "Tạo ticket danh mục \"Cấp quyền & Tài nguyên\", đính kèm ảnh chụp màn hình email phê duyệt từ Trưởng bộ phận (Team Lead / Director).",
            "Kỹ thuật viên IT sẽ thêm tài khoản của bạn vào Security Group tương ứng trên Active Directory.",
            "Đăng xuất và đăng nhập lại Windows (hoặc khởi động lại máy) để quyền mới có hiệu lực."
        ],
        "tips": [
            "Nếu truy cập từ xa qua mạng gia đình, bạn phải kết nối VPN công ty trước khi mở đường dẫn NAS."
        ],
        "views": 9,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm qua",
        "tags": [
            "NAS",
            "Share Folder",
            "Active Directory",
            "Phân quyền"
        ],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-net-1",
        "category": "NETWORK",
        "categoryLabel": "Mạng & VPN",
        "question": "Làm thế nào để cài đặt và kết nối VPN khi làm việc từ xa (Work From Home)?",
        "answer": "VPN (Virtual Private Network) cho phép nhân viên truy cập an toàn vào hệ sinh thái nội bộ (ERP, Git, NAS, HRM) từ bất kỳ đâu.",
        "detailedSteps": [
            "Tải ứng dụng FortiClient / OpenVPN từ cổng phần mềm nội bộ.",
            "Cấu hình Server Gateway: `vpn.company.vn` (Port: `10443`).",
            "Nhập Username và Password tài khoản công ty.",
            "Nhập mã OTP 6 số từ ứng dụng Authenticator trên điện thoại để hoàn tất kết nối."
        ],
        "tips": [
            "Kiểm tra tốc độ mạng gia đình trước khi kết nối VPN để đảm bảo đường truyền ổn định.",
            "Ngắt kết nối VPN sau khi hoàn thành công việc để tối ưu băng thông cho toàn công ty."
        ],
        "views": 14,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": [
            "VPN",
            "WFH",
            "Mạng nội bộ",
            "FortiClient"
        ],
        "priorityLevel": "P2"
    },
    {
        "id": "faq-sec-1",
        "category": "SECURITY",
        "categoryLabel": "Bảo mật & 2FA",
        "question": "Quy định đặt mật khẩu định kỳ và cách cấu hình bảo mật 2 lớp (2FA)?",
        "answer": "Mật khẩu tài khoản công ty có hiệu lực trong 90 ngày. Hệ thống sẽ gửi email nhắc nhở trước 7 ngày khi mật khẩu sắp hết hạn.",
        "detailedSteps": [
            "Mật khẩu mới phải dài tối thiểu 10 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (@, #, $, !).",
            "Không được sử dụng lại 3 mật khẩu gần nhất hoặc chứa họ tên/ngày sinh cá nhân.",
            "Vào Cài đặt Tài khoản > Bảo mật > Chọn \"Kích hoạt 2FA\".",
            "Dùng ứng dụng Google Authenticator hoặc Microsoft Authenticator quét mã QR và lưu mã dự phòng."
        ],
        "tips": [
            "Tuyệt đối không chia sẻ mã OTP hoặc mật khẩu cho bất kỳ ai, kể cả nhân viên IT."
        ],
        "views": 7,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "3 ngày trước",
        "tags": [
            "Đổi mật khẩu",
            "2FA",
            "Bảo mật",
            "Chính sách IT"
        ],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-hw-011",
        "category": "DEVICE",
        "categoryLabel": "Thiết bị & Máy in",
        "question": "[HW-011] Máy in không in hoặc báo trạng thái Offline thì xử lý thế nào?",
        "answer": "Sự cố máy in Offline thường do dịch vụ Print Spooler bị gián đoạn, mất kết nối mạng IP nội bộ hoặc cáp kết nối bị lỏng. Bạn có thể kiểm tra nguồn, khởi động lại dịch vụ Print Spooler và xác nhận IP máy in.",
        "detailedSteps": [
            "Kiểm tra máy in đã bật nguồn, đèn báo Ready (xanh lá) và cáp mạng LAN hoặc USB cắm chắc chắn.",
            "Nhấn tổ hợp phím Win + R, gõ 'services.msc' và tìm dịch vụ 'Print Spooler'.",
            "Nhấp chuột phải vào 'Print Spooler' và chọn 'Restart' để làm mới hàng đợi in.",
            "Vào Windows Settings > Devices > Printers & Scanners, nhấp vào máy in > chọn 'Open queue' > vào menu 'Printer' và bỏ chọn 'Use Printer Offline'.",
            "In thử trang kiểm tra (Print Test Page). Nếu vẫn offline, khởi động lại máy in hoặc tạo ticket hỗ trợ."
        ],
        "tips": [
            "Địa chỉ IP của máy in từng tầng (Tầng 1: .200, Tầng 2: .201, Tầng 3: .202) được dán trực tiếp trên thân máy."
        ],
        "views": 25,
        "initialLikes": 3,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["HW-011", "Máy in", "Offline", "Print Spooler", "Thiết bị"],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-hw-012",
        "category": "DEVICE",
        "categoryLabel": "Thiết bị & Máy in",
        "question": "[HW-012] Máy in bị kẹt giấy (Paper Jam) thì xử lý thế nào để không làm hỏng máy?",
        "answer": "Khi kẹt giấy, tuyệt đối không giật mạnh giấy ngược chiều cuốn vì có thể làm rách bao lụa hoặc gãy thanh gạt mực. Cần mở nắp hông/sau và kéo giấy đều hai tay theo chiều quay tự nhiên của trục cuốn.",
        "detailedSteps": [
            "Tắt công tắc nguồn máy in hoặc chuyển sang chế độ Standby trước khi thao tác an toàn.",
            "Mở nắp trước hoặc nắp hông máy in theo hướng dẫn mũi tên chỉ dẫn trên thân máy.",
            "Rút cụm cartridge (hộp mực) ra đặt trên mặt phẳng sạch nếu giấy kẹt bên dưới hộp mực.",
            "Dùng cả hai tay nhẹ nhàng kéo đều mép giấy theo chiều di chuyển bình thường của trục cuốn.",
            "Lắp lại hộp mực, đóng chặt nắp và nhấn nút Resume/OK trên máy in."
        ],
        "tips": [
            "Không sử dụng giấy bị ẩm, nhăn hoặc tái sử dụng giấy có bấm ghim để in."
        ],
        "views": 19,
        "initialLikes": 2,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["HW-012", "Máy in", "Kẹt giấy", "Paper Jam", "Bao lụa"],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-hw-013",
        "category": "DEVICE",
        "categoryLabel": "Thiết bị & Máy in",
        "question": "[HW-013] Khắc phục lỗi Driver máy in chưa cài hoặc sai phiên bản trên Windows/macOS?",
        "answer": "Lỗi driver khiến lệnh in bị lỗi, in ra ký tự lạ hoặc máy tính không nhận diện đúng các tính năng của máy in. Bạn cần tải đúng driver chính thức hoặc dùng Generic Driver của hãng.",
        "detailedSteps": [
            "Xác định model máy in (tem ở mặt trước máy, ví dụ Canon LBP 2900 / HP LaserJet Pro / Ricoh).",
            "Vào Windows Settings > Printers & Scanners > 'Add a printer using IP address'.",
            "Nhập địa chỉ IP máy in của tầng bạn làm việc (192.168.1.200 - 202).",
            "Chọn Driver chính thức: Canon Generic Plus UFR II hoặc HP Universal Print Driver PCL6.",
            "In trang kiểm tra (Print Test Page) để xác nhận."
        ],
        "tips": [
            "Liên hệ IT để nhận file cài đặt tự động (.bat/.ps1) nếu máy tính không có quyền cài driver trực tiếp."
        ],
        "views": 15,
        "initialLikes": 1,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["HW-013", "Driver", "Máy in", "Cài máy in", "Windows"],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-hw-014",
        "category": "DEVICE",
        "categoryLabel": "Thiết bị & Máy in",
        "question": "[HW-014] Bản in bị mờ nhạt, có vệt sọc đen hoặc lem mực khắp trang giấy?",
        "answer": "Vệt sọc đen hoặc in mờ thường do hộp mực sắp hết, drum (trống từ) bị xước hoặc thanh gạt mực bị mòn sau thời gian dài sử dụng.",
        "detailedSteps": [
            "Mở nắp máy in, rút hộp mực ra và lắc nhẹ theo chiều ngang 3-4 lần rồi lắp lại để lượng mực phân bổ đều.",
            "Kiểm tra xem thanh drum (trống hình trụ màu xanh/xám) có vết xước hoặc bám bụi mực dơ không.",
            "Lau nhẹ thanh gạt / gương quét quang học bằng khăn mềm khô chuyên dụng.",
            "Nếu bản in vẫn lem sọc đen đậm kéo dài, hộp mực hoặc drum đã hỏng, cần tạo ticket để IT thay thế hộp mực mới."
        ],
        "tips": [
            "Tránh để cụm drum tiếp xúc với ánh sáng mặt trời trực tiếp quá 3 phút."
        ],
        "views": 12,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["HW-014", "Lem mực", "In mờ", "Sọc đen", "Thay mực"],
        "priorityLevel": "P3"
    },
    {
        "id": "faq-acc-001",
        "category": "AUTH",
        "categoryLabel": "Tài khoản & Xác thực",
        "question": "[ACC-001] Không đăng nhập được tài khoản công ty (Email, SSO, VPN, Service Desk)?",
        "answer": "Nguyên nhân phổ biến do gõ sai mật khẩu (bật Caps Lock / bàn phím tiếng Việt gõ dấu), mật khẩu hết hạn 90 ngày hoặc tài khoản bị khóa bảo mật tạm thời.",
        "detailedSteps": [
            "Kiểm tra lại phím Caps Lock và bộ gõ tiếng Việt (Unikey/EVKey) trước khi nhập mật khẩu.",
            "Nếu nghi ngờ quên mật khẩu, truy cập trang đăng nhập và nhấn 'Quên mật khẩu' để nhận mã OTP qua email.",
            "Nếu tài khoản bị khóa do nhập sai quá 5 lần, chờ 15 phút hoặc liên hệ IT để mở khóa nhanh.",
            "Kiểm tra xem thiết bị có kết nối mạng Internet hoặc mạng nội bộ bình thường không."
        ],
        "tips": [
            "Mật khẩu nội bộ hết hạn sau 90 ngày, bạn nên đổi mật khẩu trước khi hết hạn để tránh gián đoạn công việc."
        ],
        "views": 32,
        "initialLikes": 4,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["ACC-001", "Đăng nhập", "Tài khoản", "SSO", "Khóa tài khoản"],
        "priorityLevel": "P2"
    },
    {
        "id": "faq-net-001",
        "category": "NETWORK",
        "categoryLabel": "Mạng & VPN",
        "question": "[NET-001] Sóng Wi-Fi văn phòng chập chờn, báo No Internet hoặc Limited Access?",
        "answer": "Sự cố thường do xung đột địa chỉ IP cục bộ từ DHCP server hoặc bộ nhớ đệm DNS bị lỗi trên máy trạm.",
        "detailedSteps": [
            "Tắt Wi-Fi trên máy, chờ 5 giây rồi kết nối lại vào mạng doanh nghiệp 'AZMedia247-Enterprise-5G'.",
            "Mở cmd dưới quyền Run as Administrator, chạy lần lượt: `ipconfig /release`, `ipconfig /flushdns`, `ipconfig /renew`.",
            "Khởi động lại card mạng hoặc thiết bị máy tính.",
            "Nếu toàn bộ khu vực phòng ban đều mất kết nối, báo ngay cho IT trực tầng."
        ],
        "tips": [
            "Ưu tiên kết nối mạng 5GHz thay vì 2.4GHz để giảm nhiễu sóng trong văn phòng."
        ],
        "views": 28,
        "initialLikes": 2,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["NET-001", "Wi-Fi", "Mạng", "DNS", "Flush DNS"],
        "priorityLevel": "P2"
    },
    {
        "id": "faq-sw-001",
        "category": "SOFTWARE",
        "categoryLabel": "Phần mềm & Cấp quyền",
        "question": "[SW-001] Ứng dụng công việc (Outlook, Excel, Teams, phần mềm kế toán) bị crash hoặc treo đơ?",
        "answer": "Lỗi crash ứng dụng thường do xung đột add-in, file tạm bị lỗi hoặc thiếu tài nguyên RAM do mở quá nhiều tab trình duyệt.",
        "detailedSteps": [
            "Nhấn Ctrl + Shift + Esc để mở Task Manager, tìm ứng dụng bị treo và nhấn 'End task'.",
            "Nhấn Win + R, gõ `%temp%` và xóa các file rác tạm thời trong thư mục Temp.",
            "Khởi động lại ứng dụng ở chế độ Safe Mode (ví dụ: giữ phím Ctrl khi mở Outlook/Excel).",
            "Nếu ứng dụng kế toán bị văng liên tục, kiểm tra đường truyền VPN và database nội bộ."
        ],
        "tips": [
            "Thường xuyên lưu file (Ctrl + S) hoặc bật tính năng AutoSave trên OneDrive/Sharepoint."
        ],
        "views": 21,
        "initialLikes": 1,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["SW-001", "Crash", "Treo máy", "Outlook", "Excel", "Teams"],
        "priorityLevel": "P2"
    },
    {
        "id": "faq-sec-002",
        "category": "SECURITY",
        "categoryLabel": "Bảo mật & 2FA",
        "question": "[SEC-002] Nghi ngờ máy tính bị dính mã độc, virus hoặc tệp tin bị đổi đuôi lạ?",
        "answer": "Khi nghi ngờ mã độc hoặc ransomware, hành động ưu tiên cao nhất là ngắt kết nối mạng ngay lập tức để tránh lây lan trong mạng nội bộ.",
        "detailedSteps": [
            "Rút ngay dây cáp mạng LAN hoặc ngắt kết nối Wi-Fi ngay lập tức.",
            "Không tự ý cắm USB hoặc thiết bị ngoại vi khác vào máy.",
            "Ghi lại hiện tượng (thông báo đòi tiền chuộc, tên file bị đổi đuôi, cửa sổ lạ tự bật).",
            "Báo ngay cho Phòng An toàn thông tin / IT Service Desk (Hotline khẩn cấp) để tiếp nhận xử lý."
        ],
        "tips": [
            "Tuyệt đối không tải hoặc mở các tệp đính kèm không rõ nguồn gốc từ email lạ."
        ],
        "views": 18,
        "initialLikes": 3,
        "initialDislikes": 0,
        "updatedAt": "Hôm nay",
        "tags": ["SEC-002", "Mã độc", "Virus", "Ransomware", "Bảo mật"],
        "priorityLevel": "P1"
    }
]

from pathlib import Path
import json

ARTICLE_STATS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "article_stats.json"

def _load_article_stats() -> dict:
    if ARTICLE_STATS_FILE.exists():
        try:
            with open(ARTICLE_STATS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def _save_article_stats(stats: dict):
    ARTICLE_STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ARTICLE_STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

from app.models.rag import RAGChunk
import re

RAG_CAT_MAP = {
    "RUNBOOK_HARDWARE": ("DEVICE", "Thiết bị & Máy in"),
    "RUNBOOK_ACCOUNT": ("AUTH", "Tài khoản & Xác thực"),
    "RUNBOOK_NETWORK": ("NETWORK", "Mạng & VPN"),
    "RUNBOOK_SOFTWARE": ("SOFTWARE", "Phần mềm & Cấp quyền"),
    "RUNBOOK_SECURITY": ("SECURITY", "Bảo mật & 2FA"),
    "POLICY": ("SECURITY", "Chính sách & Quy định"),
    "RUNBOOK_OPERATIONS": ("DEVICE", "Vận hành & Thiết bị"),
    "GENERAL": ("GENERAL", "Hướng dẫn kỹ thuật"),
    "SLA_RULES": ("SLA", "SLA & Quy trình"),
    "FLOOR_LAYOUT": ("DEVICE", "Sơ đồ & Hạ tầng"),
    "AI_GOVERNANCE": ("SOFTWARE", "Quản trị AI & Dịch vụ"),
}

def _parse_rag_chunk(c: RAGChunk):
    cat_key, cat_label = RAG_CAT_MAP.get(c.category, ("GENERAL", "Hướng dẫn chung"))
    lines = [l.strip() for l in c.content.split("\n") if l.strip()]
    meta_info = []
    steps = []
    
    for line in lines:
        if line.startswith("###") or line.startswith("#"):
            continue
        if any(line.startswith(prefix) for prefix in [
            "Mã bài:", "Danh mục:", "Đối tượng:", "Dấu hiệu cần nhận biết:", "Câu hỏi và dữ kiện tiếp nhận:"
        ]):
            meta_info.append(line)
        elif re.match(r"^(?:Requester|L1|L2|Admin|Kỹ thuật|Bước|\d+[\.\)])\s*[-—:]?", line):
            clean_step = re.sub(r"^(?:Bước\s*\d+[\.\-:]*|\d+[\.\)]\s*)\s*", "", line)
            steps.append(clean_step)
        elif len(line) > 15 and not line.startswith("http"):
            steps.append(line)

    clean_content_parts = []
    for m in meta_info:
        if ":" in m:
            k, v = m.split(":", 1)
            clean_content_parts.append(f"**{k.strip()}:** {v.strip()}")
        else:
            clean_content_parts.append(m)
            
    formatted_content = "\n\n".join(clean_content_parts) if clean_content_parts else c.content
    
    # Description for card
    desc = ""
    for m in meta_info:
        if m.startswith("Dấu hiệu cần nhận biết:"):
            desc = m.replace("Dấu hiệu cần nhận biết:", "").strip()
            break
    if not desc:
        desc = steps[0] if steps else c.title
    if len(desc) > 160:
        desc = desc[:160] + "..."
        
    return KnowledgeArticle(
        id=c.article_id,
        category=cat_key,
        categoryLabel=cat_label,
        title=f"[{c.article_id}] {c.title}",
        desc=desc,
        views="0 lượt xem",
        time="Cập nhật hôm nay",
        badge=None,
        content=formatted_content,
        steps=steps,
        isCustom=False
    )

@router.get("/articles", response_model=List[KnowledgeArticle])
async def get_articles(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Trả về danh sách tài liệu hướng dẫn nội bộ kết hợp toàn bộ tri thức RAG DOCX"""
    articles: List[KnowledgeArticle] = []
    seen_ids = set()
    stats = _load_article_stats()

    # 1. Bổ sung các bài viết từ RAG Chunks trong Database
    try:
        stmt = (
            select(RAGChunk)
            .distinct(RAGChunk.article_id)
            .order_by(RAGChunk.article_id)
        )
        res = await db.execute(stmt)
        rag_chunks = res.scalars().all()
        for c in rag_chunks:
            if not c.article_id or len(c.article_id) < 2:
                continue
            if c.article_id in seen_ids:
                continue
            seen_ids.add(c.article_id)
            art = _parse_rag_chunk(c)
            # Gán lượt xem thực tế nếu có
            st = stats.get(c.article_id)
            if st and st.get("views"):
                art.views = f"{st['views']} lượt xem"
            else:
                art.views = "0 lượt xem"
            articles.append(art)
    except Exception:
        pass

    # 2. Bổ sung các bài viết thủ công / mẫu nếu chưa có
    for a in INTERNAL_ARTICLES:
        aid = str(a["id"])
        if aid not in seen_ids:
            seen_ids.add(aid)
            art_obj = KnowledgeArticle(**a)
            st = stats.get(aid)
            if st and st.get("views"):
                art_obj.views = f"{st['views']} lượt xem"
            articles.append(art_obj)

    return articles

@router.get("/articles/{article_id}", response_model=KnowledgeArticle)
async def get_article_detail(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết một bài viết tài liệu nội bộ theo ID hoặc mã bài viết (e.g. HW-011)"""
    stats = _load_article_stats()
    st = stats.get(article_id)

    # 1. Tra cứu theo ID trong INTERNAL_ARTICLES
    for a in INTERNAL_ARTICLES:
        if str(a["id"]) == str(article_id):
            art = KnowledgeArticle(**a)
            if st and st.get("views"):
                art.views = f"{st['views']} lượt xem"
            return art

    # 2. Tra cứu trong RAG Chunks Database
    stmt = select(RAGChunk).where(RAGChunk.article_id == article_id)
    res = await db.execute(stmt)
    chunk = res.scalars().first()
    if chunk:
        art = _parse_rag_chunk(chunk)
        if st and st.get("views"):
            art.views = f"{st['views']} lượt xem"
        return art

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy bài viết '{article_id}'.")

@router.get("/faqs", response_model=List[FAQItem])
async def get_faqs(current_user: User = Depends(get_current_user)):
    """Trả về danh sách câu hỏi thường gặp nội bộ (Yêu cầu xác thực tài khoản)"""
    store = _load_faqs_store()
    return store.get("approved", INTERNAL_FAQS)

# --- FAQ Submission & Moderation Endpoints (Synchronized via Database/File) ---
from pathlib import Path
import json

FAQ_DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "faqs_store.json"

def _load_faqs_store() -> dict:
    store = {"approved": INTERNAL_FAQS, "pending": []}
    if FAQ_DATA_FILE.exists():
        try:
            with open(FAQ_DATA_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                loaded_approved = loaded.get("approved", [])
                # Merge loaded with INTERNAL_FAQS so new RAG FAQs are always present
                approved_ids = {f.get("id") for f in loaded_approved}
                for f in INTERNAL_FAQS:
                    if f.get("id") not in approved_ids:
                        loaded_approved.append(f)
                store = {
                    "approved": loaded_approved,
                    "pending": loaded.get("pending", [])
                }
        except Exception:
            pass
    return store

def _save_faqs_store(data: dict):
    FAQ_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FAQ_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class FaqSubmitRequest(BaseModel):
    category: str
    question: str
    details: Optional[str] = ""

class FaqActionRequest(BaseModel):
    faq_id: str

class FaqUpdateRequest(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    priorityLevel: Optional[str] = None

@router.get("/faqs/all")
async def get_all_faqs_for_user(current_user: User = Depends(get_current_user)):
    """Trả về danh sách FAQs đã duyệt và danh sách chờ duyệt (nếu là Admin/Staff)"""
    store = _load_faqs_store()
    user_role = getattr(current_user.role, "role_name", None) or getattr(current_user, "role_name", None) or ""
    is_staff = user_role in ["ADMIN", "TEAM_LEAD", "SUPPORT_AGENT"]
    return {
        "approved": store.get("approved", INTERNAL_FAQS),
        "pending": store.get("pending", []) if is_staff else []
    }

@router.post("/faqs/submit")
async def submit_faq_question(
    request: FaqSubmitRequest,
    current_user: User = Depends(get_current_user)
):
    """Khách hàng hoặc nhân viên gửi đóng góp câu hỏi mới"""
    store = _load_faqs_store()
    cat_map = {
        "SLA": "SLA & Quy trình",
        "AUTH": "Tài khoản & Đăng nhập",
        "DEVICE": "Thiết bị & Máy in",
        "NETWORK": "Mạng & VPN",
        "SOFTWARE": "Phần mềm & Cấp quyền",
        "SECURITY": "Bảo mật & 2FA"
    }
    cat_label = cat_map.get(request.category, "Hỗ trợ Kỹ thuật")
    
    new_item = {
        "id": f"faq-sub-{int(time.time() * 1000)}",
        "category": request.category,
        "categoryLabel": cat_label,
        "question": request.question.strip(),
        "answer": request.details.strip() if request.details else "Câu hỏi này đang được đội ngũ IT ServiceDesk tiếp nhận và biên soạn hướng dẫn chi tiết.",
        "detailedSteps": [
            "Đang chờ biên soạn quy trình thực hiện chi tiết."
        ],
        "tips": [
            "Vui lòng theo dõi cập nhật sau khi được phê duyệt."
        ],
        "views": 1,
        "initialLikes": 0,
        "initialDislikes": 0,
        "updatedAt": "Vừa xong",
        "tags": ["Đóng góp mới", cat_label],
        "priorityLevel": "P3"
    }

    # Mọi câu hỏi gửi lên đều đưa vào danh sách Chờ duyệt để Admin duyệt tay
    store["pending"].insert(0, new_item)
    _save_faqs_store(store)
    return {"success": True, "status": "pending", "item": new_item, "message": "Câu hỏi đã được gửi vào danh sách chờ duyệt. Quản trị viên (Admin) sẽ duyệt tay trước khi xuất bản!"}

@router.post("/faqs/approve")
async def approve_faq_question(
    request: FaqActionRequest,
    current_user: User = Depends(get_current_user)
):
    """Admin hoặc Team Lead duyệt câu hỏi đóng góp để hiển thị công khai"""
    user_role = getattr(current_user.role, "role_name", None) or getattr(current_user, "role_name", None) or ""
    if user_role not in ["ADMIN", "TEAM_LEAD"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ Quản trị viên (Admin) hoặc Trưởng nhóm mới có quyền phê duyệt câu hỏi.")
    
    store = _load_faqs_store()
    pending = store.get("pending", [])
    target_idx = None
    for idx, item in enumerate(pending):
        if item["id"] == request.faq_id:
            target_idx = idx
            break
    
    if target_idx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi trong hàng đợi.")
    
    approved_item = pending.pop(target_idx)
    approved_item["updatedAt"] = "Vừa duyệt"
    store["approved"].insert(0, approved_item)
    _save_faqs_store(store)
    return {"success": True, "message": "Đã duyệt và xuất bản câu hỏi thành công!", "item": approved_item}

@router.post("/faqs/reject")
async def reject_faq_question(
    request: FaqActionRequest,
    current_user: User = Depends(get_current_user)
):
    """Admin hoặc Team Lead từ chối câu hỏi đóng góp"""
    user_role = getattr(current_user.role, "role_name", None) or getattr(current_user, "role_name", None) or ""
    if user_role not in ["ADMIN", "TEAM_LEAD"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ Quản trị viên (Admin) hoặc Trưởng nhóm mới có quyền từ chối câu hỏi.")
    
    store = _load_faqs_store()
    store["pending"] = [f for f in store.get("pending", []) if f["id"] != request.faq_id]
    _save_faqs_store(store)
    return {"success": True, "message": "Đã từ chối câu hỏi đóng góp."}

@router.put("/faqs/{faq_id}")
async def update_faq_question(
    faq_id: str,
    request: FaqUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Chỉ Admin mới có quyền chỉnh sửa câu hỏi FAQ (câu hỏi, câu trả lời, danh mục, mức ưu tiên)"""
    user_role = getattr(current_user.role, "role_name", None) or getattr(current_user, "role_name", None) or ""
    if user_role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ Quản trị viên (Admin) mới có quyền sửa câu hỏi FAQ.")

    store = _load_faqs_store()
    cat_map = {
        "SLA": "SLA & Quy trình",
        "AUTH": "Tài khoản & Đăng nhập",
        "DEVICE": "Thiết bị & Máy in",
        "NETWORK": "Mạng & VPN",
        "SOFTWARE": "Phần mềm & Cấp quyền",
        "SECURITY": "Bảo mật & 2FA"
    }

    updated_target = None
    for item in store.get("approved", []):
        if str(item.get("id")) == str(faq_id):
            if request.question is not None:
                item["question"] = request.question.strip()
            if request.answer is not None:
                item["answer"] = request.answer.strip()
            if request.category is not None:
                item["category"] = request.category
                item["categoryLabel"] = cat_map.get(request.category, item.get("categoryLabel", "Hỗ trợ Kỹ thuật"))
            if request.priorityLevel is not None:
                item["priorityLevel"] = request.priorityLevel
            item["updatedAt"] = "Đã chỉnh sửa"
            updated_target = item
            break

    if not updated_target:
        for item in store.get("pending", []):
            if str(item.get("id")) == str(faq_id):
                if request.question is not None:
                    item["question"] = request.question.strip()
                if request.answer is not None:
                    item["answer"] = request.answer.strip()
                if request.category is not None:
                    item["category"] = request.category
                    item["categoryLabel"] = cat_map.get(request.category, item.get("categoryLabel", "Hỗ trợ Kỹ thuật"))
                if request.priorityLevel is not None:
                    item["priorityLevel"] = request.priorityLevel
                item["updatedAt"] = "Đã chỉnh sửa"
                updated_target = item
                break

    if not updated_target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi FAQ cần sửa.")

    _save_faqs_store(store)
    return {"success": True, "message": "Đã cập nhật thông tin câu hỏi thành công!", "item": updated_target}

@router.delete("/faqs/{faq_id}")
async def delete_approved_faq(
    faq_id: str,
    current_user: User = Depends(get_current_user)
):
    """Chỉ Admin mới có quyền xóa một câu hỏi FAQ đã được duyệt/xuất bản"""
    user_role = getattr(current_user.role, "role_name", None) or getattr(current_user, "role_name", None) or ""
    if user_role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ Quản trị viên (Admin) mới có quyền xóa bài viết FAQ.")

    store = _load_faqs_store()
    approved = store.get("approved", [])
    store["approved"] = [f for f in approved if str(f.get("id")) != str(faq_id)]
    _save_faqs_store(store)
    return {"success": True, "message": "Đã xóa câu hỏi FAQ thành công."}


# --- Article Engagement: Views & Feedback (Helpful / Unclear) ---

class ArticleFeedbackRequest(BaseModel):
    helpful: bool

@router.post("/articles/{article_id}/view")
async def increment_article_view(
    article_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Ghi nhận lượt xem thực tế của bài viết"""
    stats = _load_article_stats()
    item_stats = stats.get(article_id, {"views": 0, "helpful": 0, "not_helpful": 0})
    item_stats["views"] = item_stats.get("views", 0) + 1
    stats[article_id] = item_stats
    _save_article_stats(stats)
    return {
        "success": True, 
        "article_id": article_id, 
        "views": item_stats["views"],
        "views_text": f"{item_stats['views']} lượt xem"
    }

@router.post("/articles/{article_id}/feedback")
async def submit_article_feedback(
    article_id: str,
    req: ArticleFeedbackRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Ghi nhận đánh giá Hữu ích hoặc Chưa rõ của người dùng"""
    stats = _load_article_stats()
    item_stats = stats.get(article_id, {"views": 1, "helpful": 0, "not_helpful": 0})
    if req.helpful:
        item_stats["helpful"] = item_stats.get("helpful", 0) + 1
    else:
        item_stats["not_helpful"] = item_stats.get("not_helpful", 0) + 1
    stats[article_id] = item_stats
    _save_article_stats(stats)
    return {
        "success": True, 
        "article_id": article_id, 
        "helpful": item_stats["helpful"],
        "not_helpful": item_stats["not_helpful"],
        "message": "Cảm ơn bạn đã phản hồi! Đóng góp này giúp hoàn thiện tài liệu hỗ trợ."
    }

@router.get("/articles/stats/all")
async def get_all_article_stats(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Lấy danh sách thống kê lượt xem và đánh giá của tất cả bài viết"""
    return _load_article_stats()
