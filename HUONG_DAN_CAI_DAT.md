# 🚀 Hướng Dẫn Cài Đặt & Vận Hành Hệ Thống IT Service Desk Tích Hợp AI (Nhóm 10)

Hệ thống quản lý hỗ trợ khách hàng và dịch vụ nội bộ (IT Service Desk) tích hợp Trợ lý Trí tuệ nhân tạo (AI Engine) tự động phân loại, tính toán SLA và gợi ý phản hồi.

---

## 📋 1. Yêu Cầu Môi Trường (Prerequisites)

Để chạy dự án một cách nhanh chóng và ổn định nhất, máy tính cần cài sẵn:
- **Docker & Docker Desktop** (Khuyên dùng - tự động cài đặt toàn bộ DB, Redis, Backend, Frontend).
- Hoặc nếu chạy thủ công:
  - **Python 3.11+**
  - **Node.js 20+ & npm**
  - **MySQL 8.0+**
  - **Redis Server**

---

## 🐳 2. Hướng Dẫn Chạy Nhanh Bằng Docker Compose (Khuyên Dùng)

### Bước 1: Mở Terminal tại thư mục dự án
```bash
cd d:\du_an\CSKH
```

### Bước 2: Build và khởi động toàn bộ hệ thống
```bash
docker compose up -d --build
```
> Lệnh này sẽ tự động tải và khởi chạy 4 containers:
> 1. `cskh-db-1`: MySQL 8.0 (Port 3306)
> 2. `cskh-redis-1`: Redis Cache & Blacklist (Port 6379)
> 3. `cskh-backend-1`: FastAPI Backend (Port 8000)
> 4. `cskh-frontend-1`: React + Vite + Tailwind (Port 5173)

### Bước 3: Khởi tạo Dữ liệu Mẫu (Database Seeding)
Sau khi container đã khởi động, chạy lệnh sau để tạo tài khoản Admin và các dữ liệu ban đầu:

```bash
# 1. Tạo vai trò (Roles), danh mục (Categories), chính sách SLA và tài khoản Admin
docker compose exec backend python scripts/seed_db.py

# 2. Tạo danh sách Ticket mẫu để kiểm tra Dashboard & Biểu đồ
docker compose exec backend python scripts/seed_tickets.py
```

---

## 🌐 3. Thông Tin Truy Cập Hệ Thống

| Dịch vụ | Đường dẫn (URL) | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Frontend** | [http://localhost:5173](http://localhost:5173) | Đăng nhập, Dashboard, Quản lý Ticket, Cài đặt |
| **Swagger API Docs** | [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs) | Tài liệu API tương tác trực tiếp |
| **ReDoc API Docs** | [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc) | Tài liệu API chi tiết dạng tài liệu |

### 🔑 Danh Sách Tài Khoản Thử Nghiệm Theo Từng Vai Trò (Roles):

| Vai trò (Role) | Email Đăng nhập | Mật khẩu | Tên người dùng / Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (ADMIN)** | `admin@cskh.vn` | `Admin@123` | Toàn quyền Dashboard, phân quyền, cấu hình AI & SLA |
| **Trưởng nhóm (TEAM_LEAD)** | `lead@cskh.vn` | `Lead@123` | Giám sát Agent, duyệt ticket P1/SLA, xem thống kê |
| **Kỹ thuật viên (SUPPORT_AGENT)** | `agent@cskh.vn` | `Agent@123` | Xử lý ticket, dùng AI Copilot trả lời & tóm tắt |
| **Người dùng (REQUESTER)** | `user@company.vn` | `User@123` | Cổng User Portal, gửi yêu cầu mới & theo dõi tiến độ |
| **Người dùng (REQUESTER 2)** | `mai.tran@company.vn` | `User@123` | Nhân viên Marketing gửi ticket yêu cầu hỗ trợ |

---

## 🛠️ 4. Hướng Dẫn Cài Đặt Thủ Công (Không Dùng Docker)

### 4.1. Cấu hình & Chạy Backend (FastAPI)
```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo môi trường ảo Python
python -m venv venv
venv\Scripts\activate  # Trên Windows (hoặc: source venv/bin/activate trên Linux/macOS)

# 3. Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# 4. Chạy migration tạo bảng Database
alembic upgrade head

# 5. Khởi tạo dữ liệu
python scripts/seed_db.py
python scripts/seed_tickets.py

# 6. Khởi động Backend Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4.2. Cấu hình & Chạy Frontend (React + Vite)
```bash
# 1. Mở terminal mới và di chuyển vào frontend
cd frontend

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ phát triển
npm run dev
```

---

## ⚙️ 5. Cấu Hình Môi Trường (.env)

Nếu muốn tích hợp API Key AI thật (Google Gemini hoặc OpenAI), tạo/chỉnh sửa file `.env` tại thư mục `backend/`:

```ini
# Cấu hình Database & Redis
DATABASE_URL=mysql+aiomysql://cskh:local-dev-password@localhost:3306/servicedesk
REDIS_URL=redis://localhost:6379/0

# Bảo mật JWT
JWT_SECRET_KEY=super-secret-key-for-local-dev
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Cấu hình AI Provider (openai / gemini / mock)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Cấu hình Gửi OTP qua Gmail (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASSWORD=your_16_digit_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
SMTP_FROM_NAME="IT Service Desk"
SMTP_TLS=true
```

---

## 🗂️ 6. Cấu Trúc Thư Mục Dự Án

```text
CSKH/
├── backend/                  # FastAPI Application
│   ├── alembic/             # Database Migrations
│   ├── app/
│   │   ├── api/v1/          # Endpoints (auth, tickets, reports, users)
│   │   ├── core/            # Config, DB connection, Redis, Security
│   │   ├── models/          # SQLAlchemy Models (9 thực thể)
│   │   ├── schemas/         # Pydantic Schemas
│   │   └── services/        # Logic nghiệp vụ & AI Engine (Triage, Copilot, PII Masker)
│   ├── scripts/             # Scripts seed dữ liệu mẫu
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React + Vite + Tailwind Application
│   ├── src/
│   │   ├── components/      # Layout, ProtectedRoute, UI components
│   │   ├── pages/           # LoginPage, DashboardPage, TicketsPage, CustomersPage, SettingsPage...
│   │   ├── services/        # Axios API clients
│   │   └── types/           # TypeScript Type Definitions
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml        # File điều phối Docker Containers
└── HUONG_DAN_CAI_DAT.md     # Tài liệu hướng dẫn cài đặt này
```

---

## 💡 7. Một Số Lệnh Thường Dùng Khi Vận Hành

```bash
# Xem log trực tiếp của Backend:
docker compose logs -f backend

# Xem log trực tiếp của Frontend:
docker compose logs -f frontend

# Khởi động lại toàn bộ containers:
docker compose restart

# Dừng toàn bộ hệ thống:
docker compose down
```
