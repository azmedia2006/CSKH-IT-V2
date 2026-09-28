# 🚀 Hướng Dẫn Cài Đặt & Vận Hành Hệ Thống IT Service Desk Tích Hợp AI (Nhóm 10)

Hệ thống quản lý hỗ trợ khách hàng và dịch vụ CNTT nội bộ (**IT Service Desk**) tích hợp Trợ lý Trí tuệ Nhân tạo (**AI Engine**) tự động hóa phân loại yêu cầu, tính toán SLA, gán quyền xử lý thông minh và gợi ý phản hồi kỹ thuật.

---

## 🌐 1. Thông Tin Triển Khai & Truy Cập Hệ Thống

Hệ thống được cấu hình chạy qua Nginx Reverse Proxy tích hợp chứng chỉ SSL và tối ưu hóa nén Gzip.

| Dịch vụ | Đường dẫn (URL) | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Web Trực Tuyến** | [https://azmedia247.com](https://azmedia247.com) | Cổng thông tin hỗ trợ, Portal Khách hàng & Dashboard Quản trị |
| **Swagger API Docs** | [https://azmedia247.com/api/v1/docs](https://azmedia247.com/api/v1/docs) | Tài liệu API tương tác trực tiếp |
| **ReDoc API Docs** | [https://azmedia247.com/api/v1/redoc](https://azmedia247.com/api/v1/redoc) | Tài liệu API chuẩn OpenAPI / ReDoc |

### 🔑 Danh Sách Tài Khoản Thử Nghiệm Theo Phân Quyền (Roles)

| Vai trò (Role) | Email Đăng nhập | Mật khẩu | Quyền hạn & Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (ADMIN)** | `admin@cskh.vn` | `Admin@123` | Quản trị toàn hệ thống, cấu hình AI, quản lý người dùng, xử lý các sự cố khẩn cấp P1. |
| **Trưởng nhóm (TEAM_LEAD)** | `lead@cskh.vn` | `Lead@123` | Giám sát vận hành, phân bổ công việc, xử lý sự cố cấp cao P2 và cảnh báo vi phạm SLA. |
| **Kỹ thuật viên (SUPPORT_AGENT)** | `agent@cskh.vn` | `Agent@123` | Tiếp nhận và giải quyết ticket P3/P4, sử dụng AI Copilot để gợi ý trả lời & tóm tắt. |
| **Người dùng (REQUESTER)** | `user@company.vn` | `User@123` | Gửi yêu cầu hỗ trợ kỹ thuật (tạo ticket), tra cứu tri thức & theo dõi tiến độ xử lý. |

---

## 🤖 2. Cơ Chế AI & Phân Quyền Tiếp Nhận Ticket

Hệ thống áp dụng luồng phân định rõ ràng giữa người gửi yêu cầu và đội ngũ kỹ thuật:
- **Người tạo Ticket:** Chỉ tài khoản vai trò **Khách hàng (REQUESTER)** mới có quyền tạo ticket yêu cầu trợ giúp. Giao diện Admin/Agent được thiết kế tối ưu chỉ tập trung vào việc quản lý, giám sát và giải quyết sự cố.
- **AI Triage & Tự Động Phân Cấp Xử Lý (Auto-Assignment):**
  - Khi có ticket mới, AI phân tích nội dung để xác định danh mục và độ ưu tiên (`P1`, `P2`, `P3`, `P4`).
  - **Mức P1 (Critical - Khẩn cấp toàn hệ thống):** Tự động điều phối đến **Admin** (`admin@cskh.vn`).
  - **Mức P2 (High - Mức độ cao / diện rộng):** Tự động điều phối đến **IT Team Lead** (`lead@cskh.vn`).
  - **Mức P3 / P4 (Medium / Low - Sự cố cá nhân / hỗ trợ thường):** Tự động phân công cho **Support Agent** (`agent@cskh.vn`).
  - Kết hợp thuật toán **Cân bằng tải (Load Balancing)** theo số lượng ticket đang xử lý để tránh quá tải cho nhân sự.

---

## 📋 3. Yêu Cầu Môi Trường (Prerequisites)

- **Docker & Docker Compose** (khuyến nghị trên môi trường Production & Staging).
- Hoặc môi trường phát triển cục bộ:
  - **Python 3.11+**
  - **Node.js 20+ & npm**
  - **MySQL 8.0+ / MariaDB** hoặc **PostgreSQL**
  - **Redis Server 7+**

---

## 🐳 4. Vận Hành Nhanh Với Docker Compose

### Bước 1: Điều hướng vào thư mục dự án
```bash
cd /root/CSKH/CSKH
```

### Bước 2: Khởi động hệ thống
```bash
docker compose up -d --build
```

### Bước 3: Khởi tạo dữ liệu mẫu (Seeding)
```bash
# Khởi tạo roles, chính sách SLA, danh mục và các tài khoản mẫu
docker compose exec backend python scripts/seed_db.py

# Khởi tạo danh sách ticket mẫu để kiểm tra báo cáo & KPI
docker compose exec backend python scripts/seed_tickets.py
```

### Bước 4: Build và cập nhật Frontend
```bash
docker compose exec frontend npm run build
docker compose restart nginx frontend
```

---

## ⚙️ 5. Cấu Hình Biến Môi Trường (`.env`)

Mẫu cấu hình môi trường chuẩn tại `backend/.env`:

```ini
# Database & Cache
DATABASE_URL=mysql+aiomysql://root:password@mysql_host:3306/servicedesk
REDIS_URL=redis://redis:6379/0

# Server & JWT Authentication
HOST=0.0.0.0
PORT=8000
JWT_SECRET_KEY=super-secret-key-for-local-dev
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI Provider Configuration (Google Gemini / OpenAI / Groq)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Cấu hình gửi thông báo Email / OTP (SMTP Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME="IT Service Desk"
SMTP_TLS=true
```

---

## 🗂️ 6. Cấu Trúc Thư Mục Dự Án

```text
CSKH/
├── backend/                  # Ứng dụng Backend FastAPI
│   ├── alembic/             # Migrations cơ sở dữ liệu
│   ├── app/
│   │   ├── ai/              # AI Engine (Triage, Copilot, PII Masker, Gemini/OpenAI Client)
│   │   ├── api/v1/          # RESTful Endpoints (auth, tickets, reports, users, settings)
│   │   ├── core/            # Config, kết nối DB, Redis, Security JWT
│   │   ├── models/          # SQLAlchemy Models (Ticket, User, Role, SLA, Category, Comment...)
│   │   ├── schemas/         # Pydantic Schemas validation
│   │   └── services/        # Nghiệp vụ xử lý ticket, phân luồng SLA, auto-assignment
│   ├── scripts/             # Scripts seed dữ liệu khởi tạo ban đầu
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Ứng dụng Frontend React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/      # UI components, Layout, ChatWidget, ProtectedRoute
│   │   ├── pages/           # TicketsPage, DashboardPage, CustomersPage, KnowledgePage...
│   │   ├── services/        # Axios API clients
│   │   └── types/           # Định nghĩa kiểu dữ liệu TypeScript
│   ├── Dockerfile
│   └── package.json
├── nginx.conf                # Cấu hình Nginx Reverse Proxy, SSL & Gzip Compression
├── docker-compose.yml        # Điều phối các dịch vụ Docker (Backend, Frontend, Nginx, Redis)
└── README.md                 # Hướng dẫn chi tiết hệ thống
```
