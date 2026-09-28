from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.core.redis import redis_client
import redis.asyncio as redis

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis pool
    global redis_client
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception as e:
        print("[Redis] Pool init warning:", e)
        
    # Auto-ensure database columns exist (Idempotent schema migration)
    try:
        from app.core.database import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO categories (id, name, code, description, created_at, updated_at)
                VALUES ('a0929d53-6022-54d9-bdad-bc1dc67a05f4', 'Bảo mật & 2FA', 'SECURITY', 'Tài liệu bảo mật và xác thực hai yếu tố', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (code) DO NOTHING
            """))
            await conn.execute(text("ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS summary TEXT;"))
            await conn.execute(text("ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS steps JSON;"))
            await conn.execute(text("ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS badge VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS support_level VARCHAR(10);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_group VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_level VARCHAR(10) DEFAULT 'L1';"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS risk_flag VARCHAR(20) DEFAULT 'NORMAL';"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_reason TEXT;"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_evidence TEXT;"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_status VARCHAR(50) DEFAULT 'NONE';"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_reason TEXT;"))
            await conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS previous_agent_id VARCHAR(36);"))
            await conn.execute(text("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS uploader_id VARCHAR(36);"))
            await conn.execute(text("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_path VARCHAR(1024);"))
            await conn.execute(text("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_size INTEGER;"))
            await conn.execute(text("ALTER TABLE attachments ALTER COLUMN file_url DROP NOT NULL;"))
            await conn.execute(text("ALTER TABLE attachments ALTER COLUMN file_size_kb DROP NOT NULL;"))

            # Ensure pgvector extension and RAG tables
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_documents (
                    id VARCHAR(36) PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    file_hash VARCHAR(64) NOT NULL,
                    version VARCHAR(50) DEFAULT '1.0-SAMPLE',
                    status VARCHAR(50) DEFAULT 'SAMPLE_NEEDS_APPROVAL',
                    owner VARCHAR(255) DEFAULT 'Phòng CNTT - IT Service Desk',
                    designated_signer VARCHAR(255) DEFAULT 'Đoàn Minh Quân (Chờ xác nhận)',
                    effective_date VARCHAR(50) DEFAULT 'Chưa ban hành (Chờ ký duyệt)',
                    review_date VARCHAR(50) DEFAULT '27/03/2027',
                    chunk_count INTEGER DEFAULT 0,
                    metadata_json JSON,
                    uploaded_by VARCHAR(36),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id VARCHAR(36) PRIMARY KEY,
                    document_id VARCHAR(36) NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
                    article_id VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    audience VARCHAR(50) NOT NULL DEFAULT 'ALL',
                    visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
                    status VARCHAR(50) NOT NULL DEFAULT 'SAMPLE_NEEDS_APPROVAL',
                    version VARCHAR(50) DEFAULT '1.0-SAMPLE',
                    owner VARCHAR(255),
                    effective_date VARCHAR(50),
                    review_date VARCHAR(50),
                    chunk_index INTEGER DEFAULT 0,
                    content TEXT NOT NULL,
                    embedding vector(1536),
                    metadata_json JSON,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_audit_logs (
                    id VARCHAR(36) PRIMARY KEY,
                    action VARCHAR(50) NOT NULL,
                    actor_id VARCHAR(36),
                    actor_email VARCHAR(255),
                    actor_role VARCHAR(50),
                    document_id VARCHAR(36),
                    article_id VARCHAR(50),
                    details JSON,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rag_chunks_article_id ON rag_chunks(article_id);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rag_chunks_visibility ON rag_chunks(visibility);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rag_chunks_category ON rag_chunks(category);"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rag_chunks_doc_id ON rag_chunks(document_id);"))
        print("[Database] Schema check: users, tickets, and RAG vector tables ensured.")
    except Exception as e:
        print("[Database] Schema migration note:", e)

    # In dev/demo environment, auto-seed mock agents if needed
    if settings.DEBUG:
        try:
            from app.core.database import AsyncSessionLocal
            from scripts.seed_db import seed_support_agents
            async with AsyncSessionLocal() as session:
                await seed_support_agents(session)
        except Exception as e:
            print("[Database] Mock agent seeding note:", e)

    yield
    # Shutdown: Close Redis pool
    if redis_client:
        await redis_client.aclose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=None,
)

from fastapi.responses import HTMLResponse

@app.get(f"{settings.API_V1_PREFIX}/redoc", include_in_schema=False)
async def redoc_html():
    template = """<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>__APP_NAME__ — API Reference</title>
    <link rel="icon" type="image/png" href="/avatar/AI_support.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --scalar-font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        --scalar-font-code: 'JetBrains Mono', monospace;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html, body {
        width: 100%;
        min-height: 100%;
        margin: 0 !important;
        padding: 0 !important;
        font-family: var(--scalar-font);
        background: #ffffff !important;
        color: #0f172a;
        -webkit-font-smoothing: antialiased;
      }

      /* Clean Top Navigation Bar */
      .api-navbar {
        position: sticky;
        top: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 16px;
        background: #ffffff;
        border-bottom: 1px solid #e2e8f0;
        flex-wrap: nowrap;
      }
      @media (min-width: 768px) {
        .api-navbar {
          height: 52px;
          padding: 0 24px;
        }
      }

      .nav-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .nav-brand-link {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        min-width: 0;
      }
      .nav-logo-img {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .nav-brand-title {
        font-size: 14px;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: -0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @media (min-width: 768px) {
        .nav-logo-img {
          width: 28px;
          height: 28px;
        }
        .nav-brand-title {
          font-size: 15px;
        }
      }

      .nav-ver-tag {
        display: none;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: 9999px;
        background: #f1f5f9;
        color: #475569;
        font-size: 10.5px;
        font-weight: 600;
        flex-shrink: 0;
      }
      @media (min-width: 640px) {
        .nav-ver-tag {
          display: inline-flex;
        }
      }

      .nav-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .nav-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.15s ease;
      }
      .btn-swagger {
        display: none;
        background: #f8fafc;
        color: #475569;
        border: 1px solid #e2e8f0;
      }
      .btn-swagger:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
      @media (min-width: 640px) {
        .btn-swagger {
          display: inline-flex;
        }
      }

      .btn-home {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
      }
      .btn-home:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      /* Ensure Sidebar and its elements are 100% visible and beautifully spaced */
      .scalar-api-reference {
        --scalar-sidebar-width: 270px;
      }
      .sidebar {
        display: block !important;
      }
    </style>
  </head>
  <body>
    <header class="api-navbar">
      <div class="nav-left">
        <a href="/" class="nav-brand-link" title="Về trang chủ">
          <img src="/avatar/AI_support.png" alt="Logo" class="nav-logo-img" onerror="this.src='/avatar/AI_support.svg'" />
          <span class="nav-brand-title">__APP_NAME__ API Docs</span>
        </a>
        <span class="nav-ver-tag">v__APP_VERSION__</span>
      </div>

      <div class="nav-right">
        <a href="__API_PREFIX__/docs" class="nav-btn btn-swagger" title="Swagger UI">
          <span>Swagger</span>
        </a>
        <a href="/" class="nav-btn btn-home" title="Trang chủ">
          <span>Trang Chủ</span>
        </a>
      </div>
    </header>

    <!-- Modern Interactive Reference with Full Sidebar and Expanded Tags for Easy Selection -->
    <script
      id="api-reference"
      data-url="__API_PREFIX__/openapi.json"
      data-configuration='{
        "layout": "modern",
        "darkMode": false,
        "forceDarkModeState": "light",
        "hideDarkModeToggle": true,
        "theme": "purple",
        "hideDownloadButton": false,
        "showSidebar": true,
        "defaultOpenFirstTag": true,
        "defaultOpenAllTags": true,
        "searchHotKey": "k",
        "defaultHttpClient": {
          "targetKey": "shell",
          "clientKey": "curl"
        }
      }'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>"""
    html_content = template.replace("__APP_NAME__", settings.APP_NAME).replace("__APP_VERSION__", settings.APP_VERSION).replace("__API_PREFIX__", settings.API_V1_PREFIX)
    return HTMLResponse(content=html_content)

# Set up CORS
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://160.22.106.224",
    "https://160.22.106.224",
    "http://azmedia247.com",
    "https://azmedia247.com",
    "http://www.azmedia247.com",
    "https://www.azmedia247.com"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import RedirectResponse

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}

@app.get("/docs", include_in_schema=False)
@app.get("/api/docs", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url=f"{settings.API_V1_PREFIX}/docs")

@app.get("/redoc", include_in_schema=False)
@app.get("/api/redoc", include_in_schema=False)
async def redoc_redirect():
    return RedirectResponse(url=f"{settings.API_V1_PREFIX}/redoc")

from app.api.v1.router import api_router

# Include API routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
